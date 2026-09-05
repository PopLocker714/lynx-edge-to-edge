#import "LynxEdgeToEdgeModule.h"
#import "LEESafeAreaStore.h"
#import <Lynx/LynxContext.h>
#import <Lynx/LynxView.h>
#import <UIKit/UIKit.h>

#pragma mark - Наблюдатель

/**
 * Невидимая вьюха на весь LynxView. Чинит одноразовый снимок
 * LynxEnv::setKeyWindowAndStatusBar (вызывается ровно раз, без наблюдателя
 * за поворотом, split view и Dynamic Island): lynx-family/lynx#299.
 *
 * Pinned к bounds родителя через autoresizingMask, поэтому её safeAreaInsets
 * равны safeAreaInsets самого LynxView.
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
  LEESnapshot current = LEESafeAreaStore.snapshot;
  [LEESafeAreaStore publishInsets:self.safeAreaInsets
                   keyboardHeight:current.keyboardHeight];
}

- (void)safeAreaInsetsDidChange {
  [super safeAreaInsetsDidChange];
  [self lee_publish];  // поворот, split view, Dynamic Island
}

- (void)layoutSubviews {
  [super layoutSubviews];
  [self lee_publish];  // одного safeAreaInsetsDidChange не хватает
}

- (void)didMoveToWindow {
  [super didMoveToWindow];
  if (self.window) [self lee_publish];
}

@end

#pragma mark - Модуль

@implementation LynxEdgeToEdgeModule {
  __weak LynxContext *_context;
}

+ (NSString *)name {
  return @"LynxEdgeToEdgeModule";
}

// Таблица проверяется руками: запись с несуществующим селектором молча
// пропускается при конструировании и падает пойманным исключением при вызове.
// Имена без ARC selector family (new/copy/init/alloc/mutableCopy), см. T10.
+ (NSDictionary<NSString *, NSString *> *)methodLookup {
  return @{
    @"getSnapshot" : NSStringFromSelector(@selector(getSnapshot)),
    @"refresh" : NSStringFromSelector(@selector(refresh:)),
    @"setSystemBarStyle" : NSStringFromSelector(@selector(setSystemBarStyle:navigationBar:)),
    @"setSystemBarHidden" : NSStringFromSelector(@selector(setSystemBarHidden:navigationBar:)),
  };
}

- (instancetype)initWithLynxContext:(LynxContext *)context {
  if (self = [super init]) {
    _context = context;
    [LEESafeAreaStore registerContext:context];
    // Модуль создаётся на JS-потоке: к UIKit только через главную очередь (T5).
    dispatch_async(dispatch_get_main_queue(), ^{
      [self lee_attach];
    });
  }
  return self;
}

- (void)lee_attach {
  LynxView *lynxView = [_context getLynxView];
  if (!lynxView) return;
  [LEESafeAreaStore registerLynxView:lynxView];

  for (UIView *sub in lynxView.subviews) {
    if ([sub isKindOfClass:LEESafeAreaObserverView.class]) return;  // уже стоит
  }
  LEESafeAreaObserverView *observer =
      [[LEESafeAreaObserverView alloc] initWithFrame:lynxView.bounds];
  [lynxView addSubview:observer];
  [lynxView sendSubviewToBack:observer];
  [observer lee_publish];
}

#pragma mark - Мостовые методы

/** Синхронно, без хопа: читает тёплый кеш, прогретый из +load. */
- (NSDictionary *)getSnapshot {
  return [LEESafeAreaStore snapshotDictionary];
}

- (void)refresh:(LynxCallbackBlock)callback {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self lee_attach];
    callback([LEESafeAreaStore snapshotDictionary]);
  });
}

/**
 * v1: честные no-op. Config-плагинов у Sparkling нет, Info.plist пакет
 * инжектить не может, а без UIViewControllerBasedStatusBarAppearance=NO
 * стиль бара с уровня UIApplication не применяется. README говорит это
 * прямым текстом. v1.1 добавит путь через plist-ключ.
 */
- (void)setSystemBarStyle:(NSString *)statusBar navigationBar:(NSString *)navigationBar {
}

- (void)setSystemBarHidden:(BOOL)statusBar navigationBar:(BOOL)navigationBar {
}

@end
