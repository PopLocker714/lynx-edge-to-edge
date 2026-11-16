#import <Foundation/Foundation.h>
#import <Lynx/LynxContext.h>
#import <Lynx/LynxContextModule.h>
#import <Lynx/LynxModule.h>

NS_ASSUME_NONNULL_BEGIN

// Макрос LynxNativeModule появился в Lynx 3.9.0. На 3.6.0 (latest-шаблон) его нет,
// и тогда `@LynxNativeModule("...")` это `@` плюс неизвестный идентификатор (T20).
// Объявляем сами ровно тем же, чем это делает Lynx: раскрывается в
// `@class LynxNativeModuleMarker;` и нужен только для регулярки гема autolink.
#ifndef LynxNativeModule
#define LynxNativeModule(module_name) class LynxNativeModuleMarker;
#endif

/**
 * iOS-половина `@lynx-lab/edge-to-edge`.
 *
 * Conform к LynxContextModule обязателен: CommonModuleCreator проверяет именно
 * этот протокол и сам зовёт `initWithLynxContext:`. Autolink регистрирует
 * модуль БЕЗ param, поэтому `initWithParam:` не вызовется никогда (T28).
 */
@LynxNativeModule("LynxEdgeToEdgeModule") @interface LynxEdgeToEdgeModule
    : NSObject<LynxContextModule>
@end

NS_ASSUME_NONNULL_END
