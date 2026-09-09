#import "LEESafeAreaStore.h"
#import <Lynx/LynxContext.h>
#import <Lynx/LynxEnv.h>
#import <Lynx/LynxLifecycleDispatcher.h>
#import <Lynx/LynxView.h>
#import <Lynx/LynxViewClient.h>
#import <os/lock.h>

#pragma mark - Observer

/**
 * Невидимая вьюха на весь LynxView. Чинит одноразовый снимок
 * LynxEnv::setKeyWindowAndStatusBar (lynx-family/lynx#299): поворот, split view,
 * Dynamic Island. Pinned к bounds родителя через autoresizingMask, поэтому её
 * safeAreaInsets равны safeAreaInsets самого LynxView.
 */
@interface LEESafeAreaObserverView : UIView
@end

@implementation LEESafeAreaObserverView

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    self.userInteractionEnabled = NO;
    self.hidden = NO;  // hidden=YES отключает обновление safe area
    self.alpha = 0.0;
    self.backgroundColor = UIColor.clearColor;
    self.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  }
  return self;
}

- (void)lee_publish {
  // До attach к окну и до первого layout safeAreaInsets равны нулю. Проверено на
  // симуляторе: без этой проверки observer публикует gen с нулями между двумя
  // верными, и JS получает лишний ре-рендер с нулевыми инсетами.
  if (self.window == nil || CGRectIsEmpty(self.bounds)) return;
  LEESnapshot current = LEESafeAreaStore.snapshot;
  [LEESafeAreaStore publishInsets:self.safeAreaInsets keyboardHeight:current.keyboardHeight];
}

- (void)safeAreaInsetsDidChange {
  [super safeAreaInsetsDidChange];
  [self lee_publish];
}

- (void)layoutSubviews {
  [super layoutSubviews];
  [self lee_publish];
}

- (void)didMoveToWindow {
  [super didMoveToWindow];
  [self lee_publish];
}

@end

#pragma mark - Lifecycle hook

@interface LEELifecycleHook : NSObject <LynxViewLifecycle>
@end

@implementation LEELifecycleHook

+ (instancetype)shared {
  static LEELifecycleHook *hook = nil;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    hook = [LEELifecycleHook new];
  });
  return hook;
}

- (void)lynxViewDidStartLoading:(LynxView *)view {
  LEELog(@"lynxViewDidStartLoading view=%p window=%p main=%d", view, view.window, NSThread.isMainThread);
  if (!NSThread.isMainThread) {
    // Хост зовёт loadTemplate с главной очереди (Sparkling: SPKWrapperLynxView.load()).
    // Если нет, регистрируем без чтения окна: значение доедет из кеша.
    [LEESafeAreaStore registerLynxView:view];
    return;
  }
  [LEESafeAreaStore lee_warmFromWindow:view.window];
  [LEESafeAreaStore registerLynxView:view];
  [LEESafeAreaStore attachObserverToLynxView:view];
}

@end

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
  // Не из +load напрямую: LynxEnv.sharedInstance зовёт initDevTool по рефлексии,
  // а на момент нашего +load чужие образы могут быть ещё не загружены.
  [nc addObserver:self
         selector:@selector(lee_onDidFinishLaunching:)
             name:UIApplicationDidFinishLaunchingNotification
           object:nil];
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

+ (void)lee_onDidFinishLaunching:(NSNotification *)note {
  [self installLifecycleHook];
}

+ (void)installLifecycleHook {
  static BOOL installed = NO;
  if (installed) return;
  if (!NSThread.isMainThread) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self installLifecycleHook];
    });
    return;
  }
  installed = YES;
  [[LynxEnv sharedInstance].lifecycleDispatcher addLifecycleClient:[LEELifecycleHook shared]];
  LEELog(@"lifecycle hook installed");
}

+ (UIWindow *)lee_keyWindow {
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
  return window;
}

/** Прогрев кеша до первого LynxView: окно view, иначе key window. */
+ (void)lee_warmFromWindow:(UIWindow *)window {
  UIWindow *w = window ?: [self lee_keyWindow];
  if (!w) return;
  UIEdgeInsets insets = w.safeAreaInsets;
  BOOL zero = UIEdgeInsetsEqualToEdgeInsets(insets, UIEdgeInsetsZero);
  // Нули публикуем только если ничего лучше ещё не было.
  if (zero && [self snapshot].generation > 0) return;
  [self publishInsets:insets keyboardHeight:[self snapshot].keyboardHeight];
}

+ (void)attachObserverToLynxView:(UIView *)lynxView {
  if (!lynxView) return;
  for (UIView *sub in lynxView.subviews) {
    if ([sub isKindOfClass:LEESafeAreaObserverView.class]) return;
  }
  LEESafeAreaObserverView *observer =
      [[LEESafeAreaObserverView alloc] initWithFrame:lynxView.bounds];
  [lynxView addSubview:observer];
  [lynxView sendSubviewToBack:observer];
  [observer lee_publish];
}

+ (void)lee_resync:(NSNotification *)note {
  if (!NSThread.isMainThread) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self lee_resync:note];
    });
    return;
  }
  UIWindow *window = [self lee_keyWindow];
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
  LEELog(@"publish gen=%ld top=%.1f bottom=%.1f left=%.1f right=%.1f kb=%.1f views=%lu",
         (long)gSnapshot.generation, insets.top, insets.bottom, insets.left, insets.right,
         keyboard, (unsigned long)gViews.count);

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
  BOOL fresh = ![gViews containsObject:lynxView];
  [gViews addObject:lynxView];
  LEELog(@"registerLynxView view=%p fresh=%d gen=%ld", lynxView, fresh, (long)[self snapshot].generation);
  if (fresh && [self snapshot].generation > 0 && [lynxView isKindOfClass:LynxView.class]) {
    [(LynxView *)lynxView
        updateGlobalPropsWithDictionary:@{@"safeArea" : [self snapshotDictionary]}];
  }
}

+ (void)registerContext:(id)lynxContext {
  if (lynxContext) [gContexts addObject:lynxContext];
}

@end
