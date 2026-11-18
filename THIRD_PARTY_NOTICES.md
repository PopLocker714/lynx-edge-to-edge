> **English** · [Русский](./THIRD_PARTY_NOTICES.ru.md)

# Third-party notices

Original Lynx Lab code is covered by [MIT](./LICENSE). Third-party material below retains
its original copyright and license. Unmodified license texts are included in `licenses/`
and in the published package.

These references were inspected on 2026-11-18. They pin sources for this attribution review,
**not** the unknown commits used by the original port. Historical derivation has not been
fully reconstructed.

## React Native Edge to Edge

Copyright (c) 2024 Mathieu Acthernoene. [MIT license](./licenses/react-native-edge-to-edge-MIT.txt).

The entry-stack API and last-entry-wins behavior in `src/system-bars.ts`, together with
`SystemBars` in `src/react/index.tsx`, were adapted for Lynx. Changes include the native
bridge, microtask batching, separate imperative entries and effect cleanup. The original
React Native implementation is not bundled.

Audited source: [SystemBars.ts](https://github.com/zoontek/react-native-edge-to-edge/blob/1c213bf5cd60a8852bad20a135cbd50a91069a9a/src/SystemBars.ts).

## AndroidX and React Native navigation scrims

Copyright 2023 The Android Open Source Project.
[Apache License 2.0](./licenses/AndroidX-Apache-2.0.txt).

Copyright (c) Meta Platforms, Inc. and affiliates.
[MIT license](./licenses/react-native-MIT.txt).

`LIGHT_NAV_SCRIM` and `DARK_NAV_SCRIM` in
`android/src/main/java/dev/lynxlab/edgetoedge/EdgeToEdge.kt` reproduce the light and dark
navigation scrim values from AndroidX/React Native. They use packed ARGB integers rather
than `Color.argb` calls. The surrounding Lynx view discovery, ownership and snapshot
delivery are package-specific implementations.

Audited sources: [AndroidX EdgeToEdge.kt](https://github.com/androidx/androidx/blob/2d78fd6ed70cf0f37d5494c87c7f2cf0bd2e04e9/activity/activity/src/main/java/androidx/activity/EdgeToEdge.kt), [React Native WindowUtil.kt](https://github.com/facebook/react-native/blob/13b3b853b863908035956369ce205d463384e7cc/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/view/WindowUtil.kt).

## React Native Safe Area Context

Copyright (c) 2019 Th3rd Wave.
[MIT license](./licenses/react-native-safe-area-context-MIT.txt).

The provider/view/hook naming and edge-selective padding or margin API were informed by
this project. The Lynx React adapter uses CSS strings and an external snapshot store;
the native store uses Lynx view ownership and lifecycle hooks. No direct native source
port was identified in comparison with the audited files. The license is retained as a
conservative attribution of this design reference, not proof of complete historical provenance.

Audited source: [react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context/tree/2468ed0394339097697ca960299a3484607ff8d3), including
`src/SafeAreaContext.tsx`, `src/SafeAreaView.web.tsx`, `ios/RNCSafeAreaProvider.m` and Android
`SafeAreaUtils.kt`.
