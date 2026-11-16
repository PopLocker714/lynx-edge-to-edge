#import "LynxView.h"
@interface LynxContext : NSObject
@property(nonatomic, weak) LynxView *view;
@property(nonatomic, strong) NSMutableArray<NSArray *> *events;
- (LynxView *)getLynxView;
- (void)sendGlobalEvent:(NSString *)name withParams:(NSArray *)parameters;
@end
