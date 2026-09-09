# @lynx-lab/edge-to-edge

> **English** · [Русский](./README.ru.md)

[![CI](https://github.com/PopLocker714/lynx-edge-to-edge/actions/workflows/ci.yml/badge.svg)](https://github.com/PopLocker714/lynx-edge-to-edge/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/PopLocker714/lynx-edge-to-edge?color=blue)](./LICENSE)

Safe area insets, edge-to-edge window and system bars for [Lynx](https://lynxjs.org).
`react-native-edge-to-edge` plus `react-native-safe-area-context`, in one package.

> **Status: pre-release.** The API can still move before 1.0. Everything below is
> verified on a Pixel 9 (Android 17), an Android 16 emulator and an iPhone 17 simulator
> (iOS 26.5) against the stock Sparkling `rc` template and Lynx 3.9.0. The evidence
> lives in [lynx-lab](https://github.com/PopLocker714/lynx-lab).

## Why

`env(safe-area-inset-*)` is always `0` on Android: the setter is stripped from
`liblynx.so` and `ENV` is not registered as a dynamic style dependency in the engine
([lynx-family/lynx#299](https://github.com/lynx-family/lynx/issues/299)). Nothing in
the ecosystem enables edge-to-edge on Android, and on iOS the insets are read once
and never updated on rotation.

This package pushes the insets into `lynx.__globalProps.safeArea` *before the JS
runtime starts*, so the very first frame already has the right numbers on both
threads. Updates arrive through the same channel. Migrating existing CSS is a
search-and-replace: `env(` → `var(--`.

## Install

```sh
bun add @lynx-lab/edge-to-edge
```

**Android** — nothing else. A `ContentProvider` merged from the library manifest
enables edge-to-edge and starts publishing insets before `Application.onCreate`.

One thing the Lynx Gradle plugin gets wrong: the generated autolink registry
(`app/build/generated/source/lynxLibraryRegistry/`) is not regenerated when you add
a library, so the native module stays unregistered until you delete that directory or
run `./gradlew clean` once after `bun add`. Insets still work without the module; only
`refreshSafeArea()` and the system-bar setters need it.

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
      <Screen />
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

function Screen() {
  const insets = useSafeAreaInsets()      // { top, right, bottom, left } in dp / pt
  const keyboard = useKeyboardHeight()    // 0 when hidden
  return <view style={`padding-top:${insets.top}px`} />
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
| `SystemBars` | Declarative system-bar style and visibility; nested instances stack, the deepest wins |
| `useSafeAreaInsets()` | `EdgeInsets`, re-renders on change |
| `useSafeAreaSnapshot()` | Insets plus `keyboardHeight`, `generation`, `edgeToEdge`, `source` |
| `useKeyboardHeight()` | Keyboard height in dp / pt, Android API 30+ and iOS |

### `@lynx-lab/edge-to-edge`

| Export | What it does |
|---|---|
| `getSafeAreaInsets()`, `getSafeAreaSnapshot()` | Synchronous read; works on both threads, on the main thread it reads `lynx.__globalProps` |
| `subscribeSafeArea(listener)` | Delivers the current value immediately, then every change. Background thread only |
| `refreshSafeArea()` | Re-applies the window and re-reads the insets; for hosts where the provider did not run |
| `setSystemBarStyle('auto' \| 'inverted' \| 'light' \| 'dark')` | Status and navigation bar icon color |
| `setSystemBarHidden(boolean)` | Hide or show both bars; insets update accordingly |
| `safeAreaCssVarString(snapshot)` | The CSS custom-property string `SafeAreaProvider` uses |

`generation` is a monotonic counter shared by every delivery channel; a gap means an
update was lost and you should re-read.

## What is verified where

| | Android | iOS |
|---|---|---|
| Insets on the very first frame, both threads | Pixel 9, emulator | iPhone 17 simulator |
| Rotation, display cutout on the side | Pixel 9 (`left = 65.9`) | simulator (`left = right = 62`) |
| Gesture vs three-button navigation | emulator (`bottom` 24 → 48) | n/a |
| Keyboard height | emulator (`ime()`, 336 dp) | not yet |
| `setSystemBarStyle`, `setSystemBarHidden` | emulator, `dumpsys window` and screenshots | **no-op in v1**, see below |
| Release build under R8 | emulator | not yet |
| Second `LynxView` in the same process | Pixel 9 | not yet |

## Platform notes

**Android.** Edge-to-edge is enabled the same way `androidx.activity` does it,
including `layoutInDisplayCutoutMode`, which is what actually fixes landscape with a
cutout. On `targetSdk >= 35` the system enforces edge-to-edge and the package only
reports insets. Insets are `systemBars() | displayCutout()`; the keyboard is a
separate field, like iOS. Below API 30 `keyboardHeight` is always `0`.

**iOS.** Sparkling already draws under the bars, so there is nothing to enable. The
package reports the insets and keeps them fresh on rotation, split view and Dynamic
Island through an invisible observer view inside the `LynxView`. `setSystemBarStyle`
and `setSystemBarHidden` are honest no-ops in v1: Sparkling has no config plugins, the
package cannot inject `Info.plist`, and without `UIViewControllerBasedStatusBarAppearance = NO`
the setters would do nothing anyway.

**Multiple `LynxView`s.** Every view gets its own `globalProps`, so several views with
different insets work. The store is per process.

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

## License

MIT
