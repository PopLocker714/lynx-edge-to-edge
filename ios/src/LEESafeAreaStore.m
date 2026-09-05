#import "LEESafeAreaStore.h"
#import <Lynx/LynxContext.h>
#import <Lynx/LynxView.h>
#import <os/lock.h>

static LEESnapshot gSnapshot = {0, 0, 0, 0, 0, 0};
static NSHashTable<UIView *> *gViews = nil;
static NSHashTable *gContexts = nil;
static os_unfair_lock gLock = OS_UNFAIR_LOCK_INIT;

@implementation LEESafeAreaStore

/**
 * +load выполняется при загрузке образа, задолго до первого LynxView.
 * Здесь поднимаем ОКОННЫЙ уровень точности: keyWindow.safeAreaInsets.
 * Точный, повью-шный уровень включится позже, когда появится модуль и мы
 * вставим LEESafeAreaObserverView в сам LynxView.
 */
+ (void)load {
  gViews = [NSHashTable weakObjectsHashTable];
  gContexts = [NSHashTable weakObjectsHashTable];
  NSNotificationCenter *nc = NSNotificationCenter.defaultCenter;
  // Одного safeAreaInsetsDidChange мало: react-native-safe-area-context
  // в проде слушает весь этот набор, отдельные случаи иначе не ловятся.
  for (NSNotificationName name in @[
         UIApplicationDidBecomeActiveNotification,
         UIWindowDidBecomeVisibleNotification,
         UIKeyboardDidShowNotification,
         UIKeyboardDidHideNotification,
         UIKeyboardDidChangeFrameNotification,
       ]) {
    [nc addObserver:self selector:@selector(lee_resync:) name:name object:nil];
  }
}

+ (void)lee_resync:(NSNotification *)note {
  if (!NSThread.isMainThread) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self lee_resync:note];
    });
    return;
  }
  UIWindow *window = nil;
  if (@available(iOS 13.0, *)) {
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
      if (![scene isKindOfClass:UIWindowScene.class]) continue;
      for (UIWindow *w in ((UIWindowScene *)scene).windows) {
        if (w.isKeyWindow) {
          window = w;
          break;
        }
      }
      if (window) break;
    }
  }
  if (!window) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    window = UIApplication.sharedApplication.keyWindow;
#pragma clang diagnostic pop
  }
  if (!window) return;

  CGFloat keyboard = 0;
  NSValue *frameValue = note.userInfo[UIKeyboardFrameEndUserInfoKey];
  if (frameValue) {
    CGRect frame = [window convertRect:frameValue.CGRectValue fromWindow:nil];
    CGFloat overlap = CGRectGetMaxY(window.bounds) - CGRectGetMinY(frame);
    keyboard = MAX(0, MIN(overlap, CGRectGetHeight(window.bounds)));
    if ([note.name isEqualToString:UIKeyboardDidHideNotification]) keyboard = 0;
  } else {
    keyboard = gSnapshot.keyboardHeight;
  }
  [self publishInsets:window.safeAreaInsets keyboardHeight:keyboard];
}

+ (LEESnapshot)snapshot {
  os_unfair_lock_lock(&gLock);
  LEESnapshot copy = gSnapshot;
  os_unfair_lock_unlock(&gLock);
  return copy;
}

+ (NSDictionary<NSString *, id> *)snapshotDictionary {
  LEESnapshot s = [self snapshot];
  return @{
    @"top" : @(s.top),
    @"right" : @(s.right),
    @"bottom" : @(s.bottom),
    @"left" : @(s.left),
    @"keyboardHeight" : @(s.keyboardHeight),
    @"generation" : @(s.generation),
    // Контейнер Sparkling пинит LynxView к сырому view контроллера
    // (make.left.right.bottom.equalTo(self.view)), а схема шаблона несёт
    // hide_status_bar=1, поэтому topOffset == 0. Окно всегда edge-to-edge.
    @"edgeToEdge" : @YES,
  };
}

+ (void)publishInsets:(UIEdgeInsets)insets keyboardHeight:(CGFloat)keyboard {
  NSCAssert(NSThread.isMainThread, @"publishInsets only from the main queue");
  os_unfair_lock_lock(&gLock);
  BOOL same = gSnapshot.top == insets.top && gSnapshot.right == insets.right &&
              gSnapshot.bottom == insets.bottom && gSnapshot.left == insets.left &&
              gSnapshot.keyboardHeight == keyboard;
  if (same && gSnapshot.generation != 0) {
    os_unfair_lock_unlock(&gLock);
    return;
  }
  gSnapshot = (LEESnapshot){insets.top, insets.right, insets.bottom, insets.left,
                            keyboard, gSnapshot.generation + 1};
  os_unfair_lock_unlock(&gLock);

  NSDictionary *dict = [self snapshotDictionary];
  for (UIView *view in gViews.allObjects) {
    if ([view isKindOfClass:LynxView.class]) {
      // Мерж по верхнему ключу на iOS НЕ ПРОВЕРЕН (T33): движок заменяет,
      // мержит обвязка. Проверить на устройстве в день 6 до выпуска.
      [(LynxView *)view updateGlobalPropsWithDictionary:@{@"safeArea" : dict}];
    }
  }
  for (id ctx in gContexts.allObjects) {
    // Только дельты: sendGlobalEvent до готовности рантайма дропается.
    [(LynxContext *)ctx sendGlobalEvent:@"safeareainsetschange" withParams:@[ dict ]];
  }
}

+ (void)registerLynxView:(UIView *)lynxView {
  if (!lynxView) return;
  [gViews addObject:lynxView];
  if ([lynxView isKindOfClass:LynxView.class]) {
    [(LynxView *)lynxView
        updateGlobalPropsWithDictionary:@{@"safeArea" : [self snapshotDictionary]}];
  }
}

+ (void)registerContext:(id)lynxContext {
  if (lynxContext) [gContexts addObject:lynxContext];
}

@end
