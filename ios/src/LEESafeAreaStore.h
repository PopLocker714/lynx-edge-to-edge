#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

#if DEBUG
#define LEELog(fmt, ...) NSLog((@"[LynxEdgeToEdge] " fmt), ##__VA_ARGS__)
#else
#define LEELog(fmt, ...)
#endif

typedef struct {
  CGFloat top, right, bottom, left;
  CGFloat keyboardHeight;
  NSInteger generation;
} LEESnapshot;

/**
 * Процесс-глобальный тёплый кеш. Аналог Android-провайдера: греется из +load,
 * ещё до того как появится хоть один LynxView, чтобы синхронный getSnapshot
 * не отдавал нули на холодном старте.
 */
@interface LEESafeAreaStore : NSObject

@property(class, readonly) LEESnapshot snapshot;

+ (NSDictionary<NSString *, id> *)snapshotDictionary;

/** Только с главной очереди. Публикует, если значения изменились. */
+ (void)publishInsets:(UIEdgeInsets)insets keyboardHeight:(CGFloat)keyboard;

/** LynxView регистрирует себя, чтобы получать updateGlobalPropsWithDictionary:. */
+ (void)registerLynxView:(UIView *)lynxView;
+ (void)registerContext:(id)lynxContext;

/**
 * Глобальный клиент LynxViewLifecycle через LynxEnv.lifecycleDispatcher: LynxView.mm
 * подключает его к диспетчеру каждого view, а lynxViewDidStartLoading: приходит
 * синхронно в начале loadTemplateFromURL: (LynxTemplateRender.mm:591 @3.9.0), то есть
 * ДО старта JS-рантайма. Это iOS-аналог ActivityLifecycleCallbacks + onActivityPostStarted.
 * Ставится из +load на UIApplicationDidFinishLaunching; модуль зовёт повторно как страховку.
 */
+ (void)installLifecycleHook;

/** Невидимая observer-вьюха внутри LynxView. Идемпотентно. Только с главной очереди. */
+ (void)attachObserverToLynxView:(UIView *)lynxView;

@end

NS_ASSUME_NONNULL_END
