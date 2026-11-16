# @lynx-lab/edge-to-edge

> **English** · [Русский](./README.ru.md)

[![CI](https://github.com/PopLocker714/lynx-edge-to-edge/actions/workflows/ci.yml/badge.svg)](https://github.com/PopLocker714/lynx-edge-to-edge/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/PopLocker714/lynx-edge-to-edge?color=blue)](./LICENSE)

Safe area insets, edge-to-edge window and system bars for [Lynx](https://lynxjs.org).
`react-native-edge-to-edge` plus `react-native-safe-area-context`, in one package.

> **Pre-release / candidate.** Native ownership was changed in this revision. Historical
> device results do not establish readiness of this artifact; the current consumer matrix is
> [documented separately](./docs/compatibility.md).

## Platform support

| Capability | Android | iOS |
|---|---|---|
| Safe-area updates / rotation | Implemented; per view | Implemented; per view |
| Keyboard overlap | API 30+; zero below | Implemented; multi-scene/floating QA pending |
| System-bar style / visibility | Implemented | No-op; native host controls status bar |
| Early globalProps | Owner-window seed, then precise view geometry | Attached owner-window seed, then precise view geometry |

| Checked profile | Status for this revision |
|---|---|
| Sparkling 2.1.0-rc.36 / Lynx 3.9 / ReactLynx 0.125 / Rsbuild 2 | Debug/Release and native geometry checked; scenario limits below |
| Historical ReactLynx 0.116 / Rsbuild 1 | Historical evidence only |
| Other Lynx hosts / minimum OS | Unverified |

## Purpose

The package delivers changing insets through `lynx.__globalProps.safeArea` and CSS custom properties.
An early seed belongs only to the known owner window; embedded views become precise after layout.
An unattached iOS view waits for attach/layout. First-frame behavior is checked per host;
there is no universal first-frame guarantee for arbitrary geometry.
The first visible frame remains unverified on this candidate. Android Release rotation
was blocked by the device tool; iOS Release keyboard had no host input to exercise.
See the exact archive and configuration results in [compatibility](./docs/compatibility.md).

## Install

```sh
bun add @lynx-lab/edge-to-edge
```

**Android** — the manifest `ContentProvider` installs Activity observation before
`Application.onCreate`; it publishes when a window/view is available.

The checked Sparkling host can retain a stale generated autolink registry after
adding a library. Regenerate the consumer variants before building, then verify
that the native module and provider are present:

```sh
./gradlew :app:generateDebugLynxLibraryRegistry :app:generateReleaseLynxLibraryRegistry --rerun-tasks
```

**iOS** — `pod install`. Nothing else.

Requirements: Lynx ≥ 3.9.0, ReactLynx ≥ 0.116, Autolink enabled in the host
(the Sparkling `rc` template has it; `latest` does not).

## Usage

```tsx
import { SafeAreaProvider, SafeAreaView, SystemBars } from '@lynx-lab/edge-to-edge/react'

export function App() {
    return (
        <SafeAreaProvider>
            <SystemBars style="auto" />
            <SafeAreaView><view /></SafeAreaView>
        </SafeAreaProvider>
    )
}
```

Then either CSS or JS, both reactive:

```css
/* one CSS variable per inset, inherited by the whole subtree */
.header { padding-top: var(--safe-area-inset-top); }
.footer { padding-bottom: var(--safe-area-inset-bottom); }
```

```tsx
import { useSafeAreaInsets, useKeyboardHeight } from '@lynx-lab/edge-to-edge/react'

export function Screen() {
    const insets = useSafeAreaInsets()      // { top, right, bottom, left } in dp / pt
    const keyboard = useKeyboardHeight()    // 0 when hidden
    return <view style={`padding-top:${insets.top}px;padding-bottom:${Math.max(insets.bottom, keyboard)}px`} />
}
```

`<SafeAreaView edges={['top', 'bottom']} mode="padding" avoidKeyboard>` applies the
insets as padding or margin for you.

## API

### `@lynx-lab/edge-to-edge/react`

| Export | What it does |
|---|---|
| `SafeAreaProvider` | One `<view>` that sets `--safe-area-inset-top/right/bottom/left` and `--safe-area-keyboard-height` |
| `SafeAreaView` | Applies insets as `padding` (default) or `margin`; `edges`, `avoidKeyboard` |
| `SystemBars` | Android system-bar style and visibility; nested instances stack, the deepest wins; iOS no-op |
| `useSafeAreaInsets()` | `EdgeInsets`, re-renders on change |
| `useSafeAreaSnapshot()` | Insets plus `keyboardHeight`, `generation`, `edgeToEdge`, `source` |
| `useKeyboardHeight()` | Keyboard height in dp / pt, Android API 30+ and iOS |

### `@lynx-lab/edge-to-edge`

| Export | What it does |
|---|---|
| `getSafeAreaInsets()`, `getSafeAreaSnapshot()` | Synchronous read; works on both threads, on the main thread it reads `lynx.__globalProps` |
| `subscribeSafeArea(listener)` | Delivers the current value immediately, then every change. Background thread only |
| `refreshSafeArea()` | Re-applies the window and re-reads the insets; for hosts where the provider did not run |
| `setSystemBarStyle('auto' \| 'inverted' \| 'light' \| 'dark')` | Android status and navigation bar icon color; iOS no-op |
| `setSystemBarHidden(boolean)` | Android: hide/show both bars and update insets; iOS no-op |
| `safeAreaCssVarString(snapshot)` | The CSS custom-property string `SafeAreaProvider` uses |

`generation` is a monotonic counter shared by every delivery channel; a gap means an
update was lost and you should re-read.

## Platform notes

**Android.** Edge-to-edge is enabled the same way `androidx.activity` does it,
including `layoutInDisplayCutoutMode`, which is what actually fixes landscape with a
cutout. On `targetSdk >= 35` the system enforces edge-to-edge and the package only
reports insets. Insets are `systemBars() | displayCutout()`; the keyboard is a
separate field, like iOS. Below API 30 `keyboardHeight` is always `0`.

**iOS.** The native host controls the `LynxView` frame and whether content extends
under system UI. The package reports insets through an observer view inside the
`LynxView`; safe-area updates do not require hiding or restyling system bars.
`setSystemBarStyle`, `setSystemBarHidden` and `<SystemBars>` are **Android-only
controls in v1**; on iOS their native setters are no-ops.

Configure the iOS status bar in the owning view controller using
[`preferredStatusBarStyle` and `prefersStatusBarHidden`](https://developer.apple.com/documentation/uikit/uiviewcontroller).
This package does not require `UIViewControllerBasedStatusBarAppearance = NO` or
change the host's status-bar policy. The iOS navigation bar belongs to the app;
the [Home indicator](https://developer.apple.com/documentation/uikit/uiviewcontroller/prefershomeindicatorautohidden)
has a separate system-controlled auto-hide preference. Neither is the Android
system navigation bar addressed by this API.

The current iOS snapshot reports `edgeToEdge: true` as a host assumption, not as
a measurement of the view's geometry. Use the reported insets for layout.

**Multiple `LynxView`s.** Every view gets its own `globalProps`, so several views with
different insets work. The registry lives for the process; snapshots and generations belong to each view.

## Manual registration

If your host does not use Autolink:

```kotlin
LynxEnv.inst().registerModule("LynxEdgeToEdgeModule", LynxEdgeToEdgeModule::class.java)
```

```objc
[config registerModule:LynxEdgeToEdgeModule.class];
```

Android hosts without the `ContentProvider` (opted out via `tools:node="remove"`) can
call `EdgeToEdge.install(application)` themselves, or rely on `refreshSafeArea()`.

## Testing

`@lynx-lab/edge-to-edge/testing` exports `createFakeEdgeToEdge()`, a fake native module
plus `lynx.__globalProps` and `GlobalEventEmitter`, for unit tests and for Lynx Explorer
where the native half is absent.


## More documentation

- [Implementation and ownership](./docs/implementation.md)
- [Compatibility and host updates](./docs/compatibility.md)
- [Contribution and checks](./CONTRIBUTING.md)

Imperative bar calls retain at most one style and one visibility entry. Each call overrides earlier
entries only for its field; component updates retain their position and unmount restores the next entry.

## License

MIT
