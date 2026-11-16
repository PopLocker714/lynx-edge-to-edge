#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/** Per-LynxView snapshots. UIKit/registry/delivery are main-queue owned. */
@interface LEESafeAreaStore : NSObject
/** Thread-safe cache read; nil/unknown owner returns generation zero. No UIKit access. */
+ (NSDictionary<NSString *, id> *)snapshotDictionaryForView:(nullable UIView *)view;
/** Early lifecycle registration preserves initial globalProps for attached Sparkling views. */
+ (void)installLifecycleHook;
+ (void)registerLynxView:(UIView *)view;
+ (void)registerContext:(id)context;
+ (void)attachObserverToLynxView:(UIView *)view;
+ (void)resyncView:(UIView *)view;
@end

NS_ASSUME_NONNULL_END
