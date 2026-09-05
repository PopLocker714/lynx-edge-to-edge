# @lynx-lab/edge-to-edge

> **English** · [Русский](./README.ru.md)

Safe area insets, edge-to-edge window and system bars for [Lynx](https://lynxjs.org).
`react-native-edge-to-edge` plus `react-native-safe-area-context`, in one package.

> **Status: pre-release.** The API can still move before 1.0. What is already
> verified on a Pixel 9 and in the Lynx sources is documented in
> [lynx-lab](https://github.com/PopLocker714/lynx-lab); the rest is being built.

## Why

`env(safe-area-inset-*)` is always `0` on Android: the setter is stripped out of
`liblynx.so` and `ENV` is not registered as a dynamic style dependency in the engine
([lynx-family/lynx#299](https://github.com/lynx-family/lynx/issues/299)). Nothing in
the ecosystem enables edge-to-edge on Android or updates insets on rotation on iOS.

This package delivers insets through `lynx.__globalProps.safeArea`, pushed from the
Android side *before* the JS runtime starts, so the very first frame already has the
right numbers. Migration from `env()` is a search-and-replace: `env(` → `var(--`.

## Install

```sh
bun add @lynx-lab/edge-to-edge
```

**Android** — nothing else. A `ContentProvider` merged from the library manifest
enables edge-to-edge and starts publishing insets before `Application.onCreate`.

**iOS** — `pod install`.

## Usage

```tsx
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from '@lynx-lab/edge-to-edge/react'

export function App() {
  return (
    <SafeAreaProvider>
      <Screen />
    </SafeAreaProvider>
  )
}
```

```css
/* every inset is a CSS variable, inherited by the whole subtree */
.header { padding-top: var(--safe-area-inset-top); }
```

Full documentation lands with 0.1.0.

## License

MIT
