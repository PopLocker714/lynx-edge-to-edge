#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

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

@end

NS_ASSUME_NONNULL_END
