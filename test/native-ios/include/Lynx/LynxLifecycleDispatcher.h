#import "LynxViewClient.h"
@interface LynxLifecycleDispatcher : NSObject
- (void)addLifecycleClient:(id<LynxViewLifecycle>)client;
@end
