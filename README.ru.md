# @lynx-lab/edge-to-edge

> [English](./README.md) · **Русский**

[![CI](https://github.com/PopLocker714/lynx-edge-to-edge/actions/workflows/ci.yml/badge.svg)](https://github.com/PopLocker714/lynx-edge-to-edge/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/PopLocker714/lynx-edge-to-edge?color=blue)](./LICENSE)

Safe area, инсеты, edge-to-edge и системные бары для [Lynx](https://lynxjs.org).
`react-native-edge-to-edge` плюс `react-native-safe-area-context` в одном пакете.

> **Статус: pre-release.** API ещё может двигаться до 1.0. Всё ниже проверено на
> Pixel 9 (Android 17), эмуляторе Android 16 и симуляторе iPhone 17 (iOS 26.5) на
> стоковом `rc`-шаблоне Sparkling и Lynx 3.9.0. Доказательства лежат в
> [lynx-lab](https://github.com/PopLocker714/lynx-lab).

## Зачем

`env(safe-area-inset-*)` на Android всегда `0`: сеттер вырезан из `liblynx.so`, а `ENV`
не зарегистрирован в движке как динамическая зависимость стиля
([lynx-family/lynx#299](https://github.com/lynx-family/lynx/issues/299)). Ничто в
экосистеме не включает edge-to-edge на Android, а на iOS инсеты читаются один раз и
на повороте не обновляются.

Пакет кладёт инсеты в `lynx.__globalProps.safeArea` *до старта JS-рантайма*, поэтому уже
первый кадр на обоих потоках получает правильные числа. Обновления приходят тем же
каналом. Миграция существующего CSS это поиск-замена: `env(` → `var(--`.

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

**iOS** — `pod install`. Больше ничего.

Требования: Lynx ≥ 3.9.0, ReactLynx ≥ 0.116, включённый Autolink в хосте
(в `rc`-шаблоне Sparkling он есть, в `latest` нет).

## Использование

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

Дальше CSS или JS, оба реактивны:

```css
/* по CSS-переменной на инсет, наследуются всем поддеревом */
.header { padding-top: var(--safe-area-inset-top); }
.footer { padding-bottom: var(--safe-area-inset-bottom); }
```

```tsx
import { useSafeAreaInsets, useKeyboardHeight } from '@lynx-lab/edge-to-edge/react'

function Screen() {
  const insets = useSafeAreaInsets()      // { top, right, bottom, left } в dp / pt
  const keyboard = useKeyboardHeight()    // 0, когда скрыта
  return <view style={`padding-top:${insets.top}px`} />
}
```

`<SafeAreaView edges={['top', 'bottom']} mode="padding" avoidKeyboard>` применяет инсеты
как padding или margin за вас.

## API

### `@lynx-lab/edge-to-edge/react`

| Экспорт | Что делает |
|---|---|
| `SafeAreaProvider` | Один `<view>`, который задаёт `--safe-area-inset-top/right/bottom/left` и `--safe-area-keyboard-height` |
| `SafeAreaView` | Применяет инсеты как `padding` (по умолчанию) или `margin`; `edges`, `avoidKeyboard` |
| `SystemBars` | Стиль и видимость баров Android; вложенные экземпляры образуют стек, побеждает самый глубокий; iOS — no-op |
| `useSafeAreaInsets()` | `EdgeInsets`, ре-рендер при изменении |
| `useSafeAreaSnapshot()` | Инсеты плюс `keyboardHeight`, `generation`, `edgeToEdge`, `source` |
| `useKeyboardHeight()` | Высота клавиатуры в dp / pt, Android API 30+ и iOS |

### `@lynx-lab/edge-to-edge`

| Экспорт | Что делает |
|---|---|
| `getSafeAreaInsets()`, `getSafeAreaSnapshot()` | Синхронное чтение; работает на обоих потоках, на главном читает `lynx.__globalProps` |
| `subscribeSafeArea(listener)` | Сразу отдаёт текущее значение, потом каждое изменение. Только фоновый поток |
| `refreshSafeArea()` | Перенакатывает окно и перечитывает инсеты; для хостов, где провайдер не отработал |
| `setSystemBarStyle('auto' \| 'inverted' \| 'light' \| 'dark')` | Цвет иконок статус-бара и навигации Android; iOS — no-op |
| `setSystemBarHidden(boolean)` | Android: скрыть/показать оба бара с обновлением инcетов; iOS — no-op |
| `safeAreaCssVarString(snapshot)` | Строка CSS-переменных, которую использует `SafeAreaProvider` |

`generation` это монотонный счётчик, общий для всех каналов доставки; разрыв означает
потерянное обновление, и значение стоит перечитать.

## Что и где проверено

| | Android | iOS |
|---|---|---|
| Инсеты на самом первом кадре, оба потока | Pixel 9, эмулятор | симулятор iPhone 17 |
| Поворот, вырез сбоку | Pixel 9 (`left = 65.9`) | симулятор (`left = right = 62`) |
| Жестовая против трёхкнопочной навигации | эмулятор (`bottom` 24 → 48) | н/п |
| Высота клавиатуры | эмулятор (`ime()`, 336 dp) | пока нет |
| `setSystemBarStyle`, `setSystemBarHidden` | эмулятор, `dumpsys window` и скриншоты | **no-op в v1**, см. ниже |
| Release-сборка под R8 | эмулятор | пока нет |
| Второй `LynxView` в том же процессе | Pixel 9 | пока нет |

## Особенности платформ

**Android.** Edge-to-edge включается так же, как это делает `androidx.activity`, включая
`layoutInDisplayCutoutMode`, который и чинит альбомную ориентацию с вырезом. На
`targetSdk >= 35` система включает edge-to-edge принудительно, и пакет только отдаёт
инсеты. Инсеты это `systemBars() | displayCutout()`; клавиатура отдельным полем, как в
iOS. Ниже API 30 `keyboardHeight` всегда `0`.

**iOS.** Геометрию `LynxView` и размещение контента под системным UI определяет
нативный хост. Пакет получает инсеты через observer-вьюху внутри `LynxView`;
обновление safe area не требует скрывать бары или менять их стиль.
`setSystemBarStyle`, `setSystemBarHidden` и `<SystemBars>` в v1 управляют барами
**только на Android**; на iOS их нативные сеттеры ничего не делают.

Статус-бар iOS настраивается владеющим экраном контроллером через
[`preferredStatusBarStyle` и `prefersStatusBarHidden`](https://developer.apple.com/documentation/uikit/uiviewcontroller).
Пакет не требует `UIViewControllerBasedStatusBarAppearance = NO` и не меняет
политику статус-бара хоста. Navigation bar iOS — панель самого приложения;
у [индикатора Home](https://developer.apple.com/documentation/uikit/uiviewcontroller/prefershomeindicatorautohidden)
отдельная настройка автоматического скрытия, окончательное решение принимает ОС.
Это не Android system navigation bar, которым управляет данный API.

Текущий iOS snapshot возвращает `edgeToEdge: true` как предположение о хосте,
а не результат измерения геометрии view. Для layout используйте полученные инсеты.

**Несколько `LynxView`.** У каждого view свои `globalProps`, поэтому несколько view с
разными инсетами работают. Кеш один на процесс.

## Ручная регистрация

Если хост без Autolink:

```kotlin
LynxEnv.inst().registerModule("LynxEdgeToEdgeModule", LynxEdgeToEdgeModule::class.java)
```

```objc
[config registerModule:LynxEdgeToEdgeModule.class];
```

Android-хосты без `ContentProvider` (опт-аут через `tools:node="remove"`) могут сами
вызвать `EdgeToEdge.install(application)` или положиться на `refreshSafeArea()`.

## Тестирование

`@lynx-lab/edge-to-edge/testing` экспортирует `createFakeEdgeToEdge()`: фейк нативного
модуля плюс `lynx.__globalProps` и `GlobalEventEmitter`, для юнит-тестов и для Lynx
Explorer, где нативной половины нет.

## Лицензия

MIT
