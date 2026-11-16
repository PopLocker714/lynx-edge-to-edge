#import "LynxEdgeToEdgeModule.h"
#import "LEESafeAreaStore.h"
#import <Lynx/LynxContext.h>
#import <Lynx/LynxView.h>
#import <UIKit/UIKit.h>

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
        // Страховка для хостов, где UIApplicationDidFinishLaunching уже прошёл
        // до загрузки нашего образа (динамическая подгрузка библиотеки).
        [LEESafeAreaStore installLifecycleHook];
        // Модуль создаётся на JS-потоке: к UIKit только через главную очередь (T5).
        dispatch_async(dispatch_get_main_queue(), ^{
            [self lee_attach];
        });
    }
    return self;
}

/** Поздний путь: хук lifecycle уже сделал то же самое до старта JS, здесь идемпотентно. */
- (void)lee_attach {
    LynxView *lynxView = [_context getLynxView];
    if (!lynxView)
        return;
    [LEESafeAreaStore registerContext:_context];
    [LEESafeAreaStore registerLynxView:lynxView];
    [LEESafeAreaStore attachObserverToLynxView:lynxView];
    [LEESafeAreaStore resyncView:lynxView];
}

#pragma mark - Мостовые методы

/** Синхронно, без хопа: читает тёплый кеш, прогретый из +load. */
- (NSDictionary *)getSnapshot {
    return [LEESafeAreaStore snapshotDictionaryForView:[_context getLynxView]];
}

- (void)refresh:(LynxCallbackBlock)callback {
    dispatch_async(dispatch_get_main_queue(), ^{
        [self lee_attach];
        callback([LEESafeAreaStore snapshotDictionaryForView:[self->_context getLynxView]]);
    });
}

/**
 * v1: Android-only controls; iOS setters intentionally have no native effect.
 * The owning UIViewController controls status-bar style/visibility. Safe-area
 * reporting does not require changing that policy. The iOS navigation bar and
 * Home indicator are not equivalents of Android's system navigation bar.
 */
- (void)setSystemBarStyle:(NSString *)statusBar navigationBar:(NSString *)navigationBar {
    (void)statusBar;
    (void)navigationBar;
}

- (void)setSystemBarHidden:(BOOL)statusBar navigationBar:(BOOL)navigationBar {
    (void)statusBar;
    (void)navigationBar;
}

@end
