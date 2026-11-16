#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
typedef struct {
    CGFloat top, left, bottom, right;
} UIEdgeInsets;
typedef NSUInteger UIViewAutoresizing;
static const UIViewAutoresizing UIViewAutoresizingFlexibleWidth = 1;
static const UIViewAutoresizing UIViewAutoresizingFlexibleHeight = 2;
@class UIWindow;
@interface UIView : NSObject
@property(nonatomic) CGRect bounds;
@property(nonatomic) UIEdgeInsets safeAreaInsets;
@property(nonatomic, weak) UIWindow *window;
@property(nonatomic, weak) UIView *superview;
@property(nonatomic) BOOL userInteractionEnabled;
@property(nonatomic) CGFloat alpha;
@property(nonatomic) UIViewAutoresizing autoresizingMask;
@property(nonatomic) BOOL isFirstResponder;
@property(nonatomic, strong) NSMutableArray<UIView *> *subviews;
- (instancetype)initWithFrame:(CGRect)frame;
- (void)addSubview:(UIView *)view;
- (void)sendSubviewToBack:(UIView *)view;
- (void)safeAreaInsetsDidChange;
- (void)layoutSubviews;
- (void)didMoveToWindow;
- (void)setNeedsLayout;
- (CGRect)convertRect:(CGRect)rect fromView:(UIView *)view;
@end
@interface UIWindow : UIView
- (CGRect)convertRect:(CGRect)rect fromWindow:(UIWindow *)window;
@end
@interface NSValue (CGRectAdapter)
@property(readonly) CGRect CGRectValue;
@end
#define UIApplicationDidFinishLaunchingNotification @"UIApplicationDidFinishLaunching"
#define UIApplicationDidBecomeActiveNotification @"UIApplicationDidBecomeActive"
#define UIWindowDidBecomeVisibleNotification @"UIWindowDidBecomeVisible"
#define UIKeyboardDidShowNotification @"UIKeyboardDidShow"
#define UIKeyboardDidHideNotification @"UIKeyboardDidHide"
#define UIKeyboardDidChangeFrameNotification @"UIKeyboardDidChangeFrame"
#define UIKeyboardFrameEndUserInfoKey @"UIKeyboardFrameEnd"
