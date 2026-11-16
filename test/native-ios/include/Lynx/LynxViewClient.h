#import "LynxView.h"
@protocol LynxViewLifecycle <NSObject>
- (void)lynxViewDidStartLoading:(LynxView *)view;
@end
