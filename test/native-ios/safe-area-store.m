#import "LEESafeAreaStore.h"
#import <Lynx/LynxContext.h>
#import <Lynx/LynxEnv.h>

@implementation UIView
- (instancetype)initWithFrame:(CGRect)frame {
    if ((self = [super init])) {
        _bounds = frame;
        _subviews = [NSMutableArray new];
    }
    return self;
}
- (void)addSubview:(UIView *)view {
    view.superview = self;
    view.window = self.window;
    view.safeAreaInsets = self.safeAreaInsets;
    [self.subviews addObject:view];
}
- (void)sendSubviewToBack:(UIView *)view {
    (void)view;
}
- (void)safeAreaInsetsDidChange {
}
- (void)layoutSubviews {
}
- (void)didMoveToWindow {
}
- (void)setNeedsLayout {
}
- (CGRect)convertRect:(CGRect)rect fromView:(UIView *)view {
    (void)view;
    return rect;
}
@end
@implementation UIWindow
- (CGRect)convertRect:(CGRect)rect fromWindow:(UIWindow *)window {
    (void)window;
    return rect;
}
@end
@implementation NSValue (CGRectAdapter)
- (CGRect)CGRectValue {
    return NSRectToCGRect(self.rectValue);
}
@end
@implementation LynxView
- (void)updateGlobalPropsWithDictionary:(NSDictionary *)properties {
    if (!self.updates)
        self.updates = [NSMutableArray new];
    [self.updates addObject:properties];
}
@end
@implementation LynxContext
- (LynxView *)getLynxView {
    return self.view;
}
- (void)sendGlobalEvent:(NSString *)name withParams:(NSArray *)parameters {
    NSCAssert([name isEqualToString:@"safeareainsetschange"], @"event contract");
    if (!self.events)
        self.events = [NSMutableArray new];
    [self.events addObject:parameters];
}
@end
@implementation LynxLifecycleDispatcher
- (void)addLifecycleClient:(id<LynxViewLifecycle>)client {
    (void)client;
}
@end
@implementation LynxEnv
+ (instancetype)sharedInstance {
    static LynxEnv *environment;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        environment = [LynxEnv new];
        environment.lifecycleDispatcher = [LynxLifecycleDispatcher new];
    });
    return environment;
}
@end

static LynxView *owner(UIWindow *window, CGFloat top) {
    LynxView *view = [[LynxView alloc] initWithFrame:CGRectMake(0, 0, 400, 800)];
    view.window = window;
    view.safeAreaInsets = (UIEdgeInsets){top, 0, 12, 0};
    [LEESafeAreaStore registerLynxView:view];
    [LEESafeAreaStore attachObserverToLynxView:view];
    [view.subviews.firstObject layoutSubviews];
    return view;
}
static double top(UIView *view) {
    return [[LEESafeAreaStore snapshotDictionaryForView:view][@"top"] doubleValue];
}
int main(void) {
    @autoreleasepool {
        UIWindow *firstWindow = [[UIWindow alloc] initWithFrame:CGRectMake(0, 0, 400, 800)];
        firstWindow.safeAreaInsets = (UIEdgeInsets){60, 0, 34, 0};
        UIWindow *secondWindow = [[UIWindow alloc] initWithFrame:CGRectMake(0, 0, 400, 800)];
        secondWindow.safeAreaInsets = (UIEdgeInsets){30, 0, 20, 0};
        LynxView *first = owner(firstWindow, 10);
        LynxView *second = owner(secondWindow, 0);
        NSCAssert(top(first) == 10 && top(second) == 0, @"per-view snapshots");
        LynxContext *a = [LynxContext new];
        a.view = first;
        LynxContext *b = [LynxContext new];
        b.view = second;
        [LEESafeAreaStore registerContext:a];
        [LEESafeAreaStore registerContext:b];
        NSUInteger oldCount = first.updates.count;
        second.subviews.firstObject.safeAreaInsets = (UIEdgeInsets){8, 0, 12, 0};
        [second.subviews.firstObject safeAreaInsetsDidChange];
        NSCAssert(first.updates.count == oldCount && a.events.count == 0,
                  @"no cross-owner delivery");
        NSCAssert(b.events.count == 1 && top(second) == 8, @"own context receives delta");
        [NSNotificationCenter.defaultCenter
            postNotificationName:UIApplicationDidBecomeActiveNotification
                          object:nil];
        NSCAssert(top(first) == 10 && top(second) == 8, @"resync preserves precise view geometry");
        NSCAssert(first.updates.count == oldCount && b.events.count == 1, @"dedup on resync");
        LynxView *unattached = [[LynxView alloc] initWithFrame:CGRectMake(0, 0, 400, 800)];
        [LEESafeAreaStore registerLynxView:unattached];
        NSCAssert([[LEESafeAreaStore snapshotDictionaryForView:unattached][@"generation"]
                      integerValue] == 0,
                  @"unknown window stays neutral");
        NSCAssert([[LEESafeAreaStore snapshotDictionaryForView:nil][@"generation"] integerValue] ==
                      0,
                  @"nil owner stays neutral");
        dispatch_group_t group = dispatch_group_create();
        dispatch_group_async(group, dispatch_get_global_queue(QOS_CLASS_DEFAULT, 0), ^{
            for (NSUInteger i = 0; i < 1000; i++)
                NSCAssert(top(first) == 10, @"background cache read");
        });
        dispatch_group_wait(group, DISPATCH_TIME_FOREVER);
        puts("PASS actual iOS store: owner isolation, addressed delivery, precise resync, neutral "
             "owner, background reads");
    }
    return 0;
}
