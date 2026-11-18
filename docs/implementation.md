# Implementation

[Русский](./implementation.ru.md)

The existing layout stays small: TypeScript core owns subscription/cache and bar precedence;
`src/react` owns ReactLynx effects; Kotlin and Objective-C own OS integration.
Public peer ranges and the source-TSX React export are preserved.

## Ownership and threads

Android lifecycle callbacks and pre-draw hooks run on the UI thread. A weak registry belongs
to each Activity; each LynxView has its own immutable snapshot and generation. Geometry is
window obstruction intersected with the view bounds, in dp. Cache reads/writes use a short
lock; delivery occurs after unlocking. `getSnapshot` resolves only `LynxContext.getLynxView`
identity and reads this cache. Module initialization, refresh and bar commands hop to UI.
`refreshSafeArea` installs lifecycle callbacks and idempotently attaches the current Activity,
so observation continues without the manifest provider. Destruction removes its hooks/state.
Discovery is bounded to 240 pre-draw frames after attachment/resume; a host adding a view later
must call `refreshSafeArea`. Already discovered views keep receiving geometry updates.

Before layout, Android seeds each discovered view from its own window. This is intended for
Sparkling's full-window view; embedded views become precise after layout. Unknown owners get
generation zero, never another view's cache. First-frame behavior needs consumer QA for each
host. API <30 reports keyboard height zero; API 30+ uses IME obstruction overlap.

On iOS the process-lived hook installs on launch; it seeds globalProps synchronously before
runtime loading when the owning view has a window. An unattached view waits for layout rather
than guessing a global key window. A transparent observer tracks that view's safe area.
Notifications resync measured observers; they never replace precise insets with window insets.
Snapshots are weak-keyed by view and guarded by `os_unfair_lock`; registry, UIKit and event
delivery stay on the main queue. Sync getters only read owner identity/cache, without
`dispatch_sync(main)`. Contexts are weak and receive only their own view's events.
Keyboard frames are attributed to a registered first-responder window, then intersected with
each view. Multi-scene/floating keyboard behavior still needs device QA.

`edgeToEdge: true` on iOS is a host contract, not measured geometry. The owning UIViewController
controls status-bar style/visibility. All package bar setters remain no-ops on iOS. App navigation
bars and the Home indicator are separate concepts.

## iOS host loading contract

In the checked Sparkling `2.1.0-rc.36` baseline, `SPKViewController.viewDidLoad` starts loading
before window attachment. The library therefore cannot seed the initial render: 3/3 simulator
recordings showed zero fallback insets before the later globalProps correction.

Probe `a11a4dd` uses public `SPKContainerView` in a full-window host adapter: attach the container,
complete layout with an owning window, then load the template exactly once. It preserves lifecycle
callbacks and uses no timer, hidden-content workaround or remount. This ordering lets the existing
library hook seed the initial render. The window seed applies only to this probe's full-window
bounds; it is not a general contract for embedded views. Default Sparkling still needs a host adapter.

On iOS 27 Release, the first recorded new content had nonzero insets/generation 1 in 3/3 recordings.
This bounded simulator result does not prove every displayed frame; physical first-frame QA,
arbitrary embedded views and other hosts remain unverified. A native keyboard fixture passed
show/hide on the simulator; physical Release keyboard QA remains open.
See [recorded evidence](https://github.com/PopLocker714/lynx-lab/blob/docs/package-standards/docs/evidence/ios-simulator-2026-11-18/results.json).

## JavaScript and React

Reads prefer per-view globalProps, then native cache, then zero fallback. A generation-zero
refresh cannot overwrite a warmed snapshot. Generations are monotonic within one view/runtime.
`SystemBars` creates its stack entry in an effect, never during render/MTS. Updates keep its
position; unmount removes the latest entry. Imperative calls keep at most one style and one
visibility entry and move only the called field above existing entries. New component mounts
can override them. Mutating bar APIs are background-thread only.

The React export intentionally remains TSX: the consumer's ReactLynx compiler transforms view
JSX. An automatic JSX output migration requires separate consumer evidence. Unit hook adapters
exercise effects and cleanup but do not prove scheduling in the native runtime.

## Sources and review

The system-bar entry stack adapts `zoontek/react-native-edge-to-edge`; navigation scrim
values come from AndroidX/React Native. Safe Area Context informed the React API; a direct
native port was not identified in the reviewed source comparison. The package includes
[third-party notices and licenses](../THIRD_PARTY_NOTICES.md). Pinned references describe
the 2026-11-18 attribution review, not the unknown original source commits. Historical
provenance remains incomplete. Do not copy new native code without a pinned source and
license review.
Lynx 3.9 public context/view APIs were inspected locally; Android and iOS ownership rules:

- [Android window insets](https://developer.android.com/develop/ui/views/layout/edge-to-edge)
- [AndroidX EdgeToEdge source](https://github.com/androidx/androidx/blob/androidx-main/activity/activity/src/main/java/androidx/activity/EdgeToEdge.kt)
- [Apple safeAreaInsets](https://developer.apple.com/documentation/uikit/uiview/safeareainsets)
- [Apple status-bar updates](https://developer.apple.com/documentation/uikit/uiviewcontroller/setneedsstatusbarappearanceupdate())
