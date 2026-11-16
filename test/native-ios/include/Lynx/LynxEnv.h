#import "LynxLifecycleDispatcher.h"
@interface LynxEnv : NSObject
@property(nonatomic, strong) LynxLifecycleDispatcher *lifecycleDispatcher;
+ (instancetype)sharedInstance;
@end
