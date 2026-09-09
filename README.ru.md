# @lynx-lab/edge-to-edge

> [English](./README.md) · **Русский**

Safe area, инсеты, edge-to-edge и системные бары для [Lynx](https://lynxjs.org).
`react-native-edge-to-edge` плюс `react-native-safe-area-context` в одном пакете.

> **Статус: pre-release.** API ещё может двигаться до 1.0. Что уже проверено на
> Pixel 9 и по исходникам Lynx, задокументировано в
> [lynx-lab](https://github.com/PopLocker714/lynx-lab); остальное в работе.

## Зачем

`env(safe-area-inset-*)` на Android всегда `0`: сеттер вырезан из `liblynx.so`,
а `ENV` не зарегистрирован в движке как динамическая зависимость стиля
([lynx-family/lynx#299](https://github.com/lynx-family/lynx/issues/299)). Ничто в
экосистеме не включает edge-to-edge на Android и не обновляет инсеты на повороте на iOS.

Пакет доставляет инсеты через `lynx.__globalProps.safeArea`, пушем с Android-стороны
*до* старта JS-рантайма, поэтому уже первый кадр получает правильные числа. Миграция
с `env()` это поиск-замена: `env(` → `var(--`.

## Установка

```sh
bun add @lynx-lab/edge-to-edge
```

**Android** — больше ничего. `ContentProvider` из манифеста библиотеки включает
edge-to-edge и начинает публиковать инсеты ещё до `Application.onCreate`.

Одна особенность Gradle-плагина Lynx: сгенерированный autolink-реестр
(`app/build/generated/source/lynxLibraryRegistry/`) не перегенерируется при добавлении
библиотеки, и нативный модуль остаётся незарегистрированным, пока вы не удалите этот
каталог или не выполните `./gradlew clean` один раз после `bun add`. Инсеты работают
и без модуля; он нужен только `refreshSafeArea()` и сеттерам системных баров.

**iOS** — `pod install`.

## Использование

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
/* каждый инсет это CSS-переменная, наследуется всем поддеревом */
.header { padding-top: var(--safe-area-inset-top); }
```

Полная документация выйдет вместе с 0.1.0.

## Лицензия

MIT
