#import <UIKit/UIKit.h>
@interface LynxView : UIView
@property(nonatomic, strong) NSMutableArray<NSDictionary *> *updates;
- (void)updateGlobalPropsWithDictionary:(NSDictionary *)properties;
@end
