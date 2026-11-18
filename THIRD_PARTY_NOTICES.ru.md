> [English](./THIRD_PARTY_NOTICES.md) · **Русский**

# Уведомления о сторонних материалах

Собственный код Lynx Lab распространяется под [MIT](./LICENSE). Перечисленные сторонние
материалы сохраняют исходные авторские права и лицензии. Неизменённые тексты лицензий
входят в `licenses/` и публикуемый пакет.

Источники проверены 2026-11-18. Это точные версии для текущей проверки атрибуции,
**не** неизвестные commits первоначального переноса. Историческое происхождение
восстановлено не полностью.

## React Native Edge to Edge

Copyright (c) 2024 Mathieu Acthernoene. [Лицензия MIT](./licenses/react-native-edge-to-edge-MIT.txt).

API стека записей и приоритет последней записи в `src/system-bars.ts`, вместе с компонентом
`SystemBars` в `src/react/index.tsx`, адаптированы для Lynx. Изменения включают native bridge,
объединение обновлений микрозадачей, отдельные императивные записи и очистку эффектов.
Исходная реализация React Native в пакет не включена.

Проверенный источник: [SystemBars.ts](https://github.com/zoontek/react-native-edge-to-edge/blob/1c213bf5cd60a8852bad20a135cbd50a91069a9a/src/SystemBars.ts).

## Цвета навигационных панелей AndroidX и React Native

Copyright 2023 The Android Open Source Project.
[Apache License 2.0](./licenses/AndroidX-Apache-2.0.txt).

Copyright (c) Meta Platforms, Inc. and affiliates.
[Лицензия MIT](./licenses/react-native-MIT.txt).

`LIGHT_NAV_SCRIM` и `DARK_NAV_SCRIM` в
`android/src/main/java/dev/lynxlab/edgetoedge/EdgeToEdge.kt` воспроизводят светлый и тёмный
цвета навигационных панелей из AndroidX/React Native. Вместо `Color.argb` используются
целые значения ARGB. Поиск Lynx view, владение ими и доставка снимков состояния вокруг
этих констант реализованы специально для пакета.

Проверенные источники: [AndroidX EdgeToEdge.kt](https://github.com/androidx/androidx/blob/2d78fd6ed70cf0f37d5494c87c7f2cf0bd2e04e9/activity/activity/src/main/java/androidx/activity/EdgeToEdge.kt), [React Native WindowUtil.kt](https://github.com/facebook/react-native/blob/13b3b853b863908035956369ce205d463384e7cc/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/view/WindowUtil.kt).

## React Native Safe Area Context

Copyright (c) 2019 Th3rd Wave.
[Лицензия MIT](./licenses/react-native-safe-area-context-MIT.txt).

Проект послужил ориентиром для названий provider/view/hooks и выбора сторон для padding
или margin. React-адаптер Lynx использует CSS-строки и внешнее хранилище снимков; native
store использует владение Lynx view и lifecycle hooks. При сравнении с проверенными
файлами прямой перенос native-кода не обнаружен. Лицензия сохранена для консервативной
атрибуции этого ориентира, а не как доказательство полного исторического происхождения.

Проверенный источник: [react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context/tree/2468ed0394339097697ca960299a3484607ff8d3), включая
`src/SafeAreaContext.tsx`, `src/SafeAreaView.web.tsx`, `ios/RNCSafeAreaProvider.m` и Android
`SafeAreaUtils.kt`.
