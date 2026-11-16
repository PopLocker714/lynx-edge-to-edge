#import "LEESafeAreaStore.h"
#import <Lynx/LynxContext.h>
#import <Lynx/LynxEnv.h>
#import <Lynx/LynxLifecycleDispatcher.h>
#import <Lynx/LynxView.h>
#import <Lynx/LynxViewClient.h>
#import <os/lock.h>

// Only snapshots cross threads. No lock is held while calling UIKit or Lynx.
static NSMapTable<UIView *, NSDictionary *> *snapshots;
static NSHashTable<UIView *> *views;
static NSHashTable<LynxContext *> *contexts;
static os_unfair_lock snapshotLock = OS_UNFAIR_LOCK_INIT;
static CGRect keyboardFrame;
static __weak UIWindow *keyboardWindow;

@interface LEESafeAreaStore ()
+ (void)publishView:(UIView *)view insets:(UIEdgeInsets)insets;
@end

@interface LEESafeAreaObserverView : UIView
@property(nonatomic) BOOL measured;
@end

@implementation LEESafeAreaObserverView
- (instancetype)initWithFrame:(CGRect)frame {
    if ((self = [super initWithFrame:frame])) {
        self.userInteractionEnabled = NO;
        // hidden would prevent safe-area notifications.
        self.alpha = 0;
        self.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    }
    return self;
}
- (void)publish {
    if (!self.window || !self.superview || CGRectIsEmpty(self.bounds))
        return;
    self.measured = YES;
    [LEESafeAreaStore publishView:self.superview insets:self.safeAreaInsets];
}
- (void)safeAreaInsetsDidChange {
    [super safeAreaInsetsDidChange];
    [self publish];
}
- (void)layoutSubviews {
    [super layoutSubviews];
    [self publish];
}
- (void)didMoveToWindow {
    [super didMoveToWindow];
    self.measured = NO;
    // Wait for layout: didMoveToWindow can expose temporary zero safe-area insets.
}
@end

@interface LEELifecycleHook : NSObject <LynxViewLifecycle>
@end
@implementation LEELifecycleHook
- (void)lynxViewDidStartLoading:(LynxView *)view {
    if (!NSThread.isMainThread) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [LEESafeAreaStore registerLynxView:view];
            [LEESafeAreaStore attachObserverToLynxView:view];
        });
        return;
    }
    [LEESafeAreaStore registerLynxView:view];
    [LEESafeAreaStore attachObserverToLynxView:view];
}
@end

static BOOL containsFirstResponder(UIView *view) {
    if (view.isFirstResponder)
        return YES;
    for (UIView *child in view.subviews) {
        if (containsFirstResponder(child))
            return YES;
    }
    return NO;
}

@implementation LEESafeAreaStore
+ (void)load {
    snapshots = [NSMapTable weakToStrongObjectsMapTable];
    views = [NSHashTable weakObjectsHashTable];
    contexts = [NSHashTable weakObjectsHashTable];
    NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
    [center addObserver:self
               selector:@selector(didFinishLaunching:)
                   name:UIApplicationDidFinishLaunchingNotification
                 object:nil];
    for (NSNotificationName name in @[
             UIApplicationDidBecomeActiveNotification, UIWindowDidBecomeVisibleNotification,
             UIKeyboardDidShowNotification, UIKeyboardDidHideNotification,
             UIKeyboardDidChangeFrameNotification
         ]) {
        [center addObserver:self selector:@selector(resync:) name:name object:nil];
    }
}
+ (void)didFinishLaunching:(NSNotification *)notification {
    (void)notification;
    [self installLifecycleHook];
}
+ (void)installLifecycleHook {
    if (!NSThread.isMainThread) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self installLifecycleHook];
        });
        return;
    }
    static LEELifecycleHook *hook;
    if (hook)
        return;
    hook = [LEELifecycleHook new];
    [[LynxEnv sharedInstance].lifecycleDispatcher addLifecycleClient:hook];
}
+ (NSDictionary<NSString *, id> *)snapshotDictionaryForView:(UIView *)view {
    os_unfair_lock_lock(&snapshotLock);
    NSDictionary *value = view ? [snapshots objectForKey:view] : nil;
    os_unfair_lock_unlock(&snapshotLock);
    return value ?: @{
        @"top" : @0,
        @"right" : @0,
        @"bottom" : @0,
        @"left" : @0,
        @"keyboardHeight" : @0,
        @"generation" : @0,
        @"edgeToEdge" : @YES
    };
}
+ (void)publishView:(UIView *)view insets:(UIEdgeInsets)insets {
    NSCAssert(NSThread.isMainThread, @"UI ownership requires main queue");
    CGFloat keyboard = 0;
    if (keyboardWindow && view.window == keyboardWindow && !CGRectIsEmpty(keyboardFrame)) {
        CGRect frame = [keyboardWindow convertRect:keyboardFrame fromWindow:nil];
        CGRect local = [view convertRect:frame fromView:keyboardWindow];
        CGRect overlap = CGRectIntersection(view.bounds, local);
        if (!CGRectIsNull(overlap))
            keyboard = CGRectGetHeight(overlap);
    }
    NSDictionary *current = [self snapshotDictionaryForView:view];
    if ([current[@"generation"] integerValue] > 0 && [current[@"top"] doubleValue] == insets.top &&
        [current[@"right"] doubleValue] == insets.right &&
        [current[@"bottom"] doubleValue] == insets.bottom &&
        [current[@"left"] doubleValue] == insets.left &&
        [current[@"keyboardHeight"] doubleValue] == keyboard)
        return;
    NSDictionary *value = @{
        @"top" : @(insets.top),
        @"right" : @(insets.right),
        @"bottom" : @(insets.bottom),
        @"left" : @(insets.left),
        @"keyboardHeight" : @(keyboard),
        @"generation" : @([current[@"generation"] integerValue] + 1),
        // Declared host contract, not a measured claim about status-bar configuration.
        @"edgeToEdge" : @YES
    };
    os_unfair_lock_lock(&snapshotLock);
    [snapshots setObject:value forKey:view];
    os_unfair_lock_unlock(&snapshotLock);
    [(LynxView *)view updateGlobalPropsWithDictionary:@{@"safeArea" : value}];
    for (LynxContext *context in contexts.allObjects) {
        if ([context getLynxView] == view) {
            [context sendGlobalEvent:@"safeareainsetschange" withParams:@[ value ]];
        }
    }
}
+ (void)registerLynxView:(UIView *)view {
    NSCAssert(NSThread.isMainThread, @"Registry requires main queue");
    if (![view isKindOfClass:LynxView.class])
        return;
    [views addObject:view];
    // Never guess a global keyWindow: another scene may own it.
    if ([[self snapshotDictionaryForView:view][@"generation"] integerValue] == 0 && view.window) {
        [self publishView:view insets:view.window.safeAreaInsets];
    }
}
+ (void)registerContext:(id)context {
    NSCAssert(NSThread.isMainThread, @"Registry requires main queue");
    if (context)
        [contexts addObject:context];
}
+ (void)attachObserverToLynxView:(UIView *)view {
    NSCAssert(NSThread.isMainThread, @"UIKit requires main queue");
    for (UIView *child in view.subviews) {
        if ([child isKindOfClass:LEESafeAreaObserverView.class])
            return;
    }
    LEESafeAreaObserverView *observer = [[LEESafeAreaObserverView alloc] initWithFrame:view.bounds];
    [view addSubview:observer];
    [view sendSubviewToBack:observer];
}
+ (void)resyncView:(UIView *)view {
    NSCAssert(NSThread.isMainThread, @"UIKit requires main queue");
    if (!view.window)
        return;
    for (UIView *child in view.subviews) {
        if ([child isKindOfClass:LEESafeAreaObserverView.class]) {
            LEESafeAreaObserverView *observer = (LEESafeAreaObserverView *)child;
            if (observer.measured)
                [observer publish];
            else
                [observer setNeedsLayout];
            return;
        }
    }
}
+ (void)resync:(NSNotification *)notification {
    if (!NSThread.isMainThread) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self resync:notification];
        });
        return;
    }
    if ([notification.name isEqualToString:UIKeyboardDidHideNotification]) {
        keyboardWindow = nil;
        keyboardFrame = CGRectZero;
    } else if (notification.userInfo[UIKeyboardFrameEndUserInfoKey]) {
        keyboardFrame = [notification.userInfo[UIKeyboardFrameEndUserInfoKey] CGRectValue];
        // Keyboard notifications do not identify a scene. Attribute only to a verified
        // first-responder window among registered views; never broadcast keyboard height.
        keyboardWindow = nil;
        for (UIView *view in views.allObjects) {
            if (view.window && containsFirstResponder(view.window)) {
                keyboardWindow = view.window;
                break;
            }
        }
    }
    for (UIView *view in views.allObjects)
        [self resyncView:view];
}
@end
