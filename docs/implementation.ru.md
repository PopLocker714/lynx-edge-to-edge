# Реализация

[English](./implementation.md)

Структура остаётся небольшой: TypeScript core владеет подписками, кешем и приоритетом баров;
`src/react` — ReactLynx effects; Kotlin и Objective-C — интеграцией с ОС.
Публичные peer ranges и экспорт React исходником TSX сохранены.

## Владельцы и потоки

Android lifecycle callbacks и pre-draw hooks работают на UI-потоке. У каждой Activity слабый
реестр; каждый LynxView имеет собственный неизменяемый снимок и generation. Геометрия —
пересечение перекрытий окна с границами view, в dp. Чтение/запись кеша под коротким lock,
доставка после освобождения. `getSnapshot` получает только identity через
`LynxContext.getLynxView` и читает кеш. Инициализация модуля, refresh и команды баров уходят на UI.
`refreshSafeArea` устанавливает lifecycle callbacks и идемпотентно подключает текущую Activity:
наблюдение продолжается и без provider в manifest. Уничтожение удаляет hooks и состояние.
Поиск новых view ограничен 240 pre-draw кадрами после attach/resume; добавив view позже,
хост должен вызвать `refreshSafeArea`. Найденные view продолжают получать обновления геометрии.

До layout Android заполняет каждый найденный view значениями его окна. Это предназначено для
полноэкранного view Sparkling; embedded view получает точные значения после layout.
Неизвестный владелец получает generation zero, никогда чужой кеш. Первый кадр требует QA
каждого host. На API <30 высота клавиатуры нулевая; API 30+ использует пересечение IME.

На iOS process-lived hook устанавливается при launch и синхронно заполняет globalProps до
загрузки runtime, если у view есть своё окно. Unattached view ждёт layout, не угадывая key window.
Прозрачный observer следит за safe area конкретного view. Уведомления пересчитывают измеренные
observer, не заменяя точные инсеты оконными. Ключи кеша — слабые view, доступ защищён
`os_unfair_lock`; реестр, UIKit и доставка событий принадлежат main queue. Sync getter читает
только identity/cache, без `dispatch_sync(main)`. Contexts слабые и получают события своего view.
Клавиатура относится к зарегистрированному окну с first responder, затем пересекается с каждым
view. Multi-scene и плавающая клавиатура ещё требуют device QA.

`edgeToEdge: true` на iOS — договорённость с host, не измеренная геометрия. Style/visibility
status bar принадлежат UIViewController. Setters пакета остаются no-op на iOS. Navigation bar
приложения и Home indicator — отдельные понятия.

## Порядок загрузки iOS host

В проверенном исходном Sparkling `2.1.0-rc.36` метод `SPKViewController.viewDidLoad` начинает
загрузку до присоединения к окну. Поэтому библиотека не может заполнить начальный render:
3/3 записи симулятора показали нулевые fallback-инсеты до последующего обновления globalProps.

Пробник `a11a4dd` использует публичный `SPKContainerView` в полноэкранном host-adapter:
присоединить контейнер, завершить layout со своим окном, затем загрузить шаблон ровно один раз.
Lifecycle callbacks сохранены; таймеров, скрытия контента и remount нет. Этот порядок позволяет
существующему hook библиотеки заполнить начальный render. Оконный seed относится только к
полноэкранным bounds этого пробника, а не к произвольным embedded view. Стандартному Sparkling
по-прежнему нужен host-adapter.

В iOS 27 Release первый записанный новый контент имел ненулевые инсеты/generation 1 в 3/3 записях.
Этот ограниченный результат симулятора не доказывает каждый отображённый кадр; первый кадр на
физическом устройстве, произвольные embedded view и другие host не проверены. Native keyboard
fixture прошёл показ/скрытие на симуляторе; физическая проверка клавиатуры Release открыта.
См. [зафиксированные evidence](https://github.com/PopLocker714/lynx-lab/blob/docs/package-standards/docs/evidence/ios-simulator-2026-11-18/results.json).

## JavaScript и React

Чтение: per-view globalProps, затем native cache, затем нулевой fallback. Refresh с generation
zero не перетирает прогретый снимок. Generation монотонен в пределах одного view/runtime.
`SystemBars` создаёт запись в effect, а не render/MTS. Update сохраняет позицию; unmount
удаляет текущую запись. Imperative API хранит максимум одну запись style и одну visibility,
переносит над существующими только вызванное поле. Новые component mounts могут их перекрыть.
Изменяющие API баров вызываются только на background thread.

React экспорт остаётся TSX: JSX view преобразует ReactLynx compiler потребителя.
Переход на автоматический JSX output требует отдельных consumer evidence. Unit hook adapters
проверяют effects и cleanup, но не доказывают scheduling нативного runtime.

## Источники и review

Стек системных панелей адаптирован из `zoontek/react-native-edge-to-edge`; цвета панелей
взяты из AndroidX/React Native. Safe Area Context послужил ориентиром для React API;
при сравнении проверенных исходников прямой перенос native-кода не обнаружен. Пакет
включает [сторонние уведомления и лицензии](../THIRD_PARTY_NOTICES.ru.md). Закреплённые
источники относятся к проверке атрибуции 2026-11-18, а не к неизвестным первоначальным
commits. Историческое происхождение восстановлено не полностью. Новый native-код нельзя
копировать без закреплённого источника и проверки лицензии.
Public context/view APIs Lynx 3.9 прочитаны локально; правила Android/iOS:

- [Android window insets](https://developer.android.com/develop/ui/views/layout/edge-to-edge)
- [AndroidX EdgeToEdge](https://github.com/androidx/androidx/blob/androidx-main/activity/activity/src/main/java/androidx/activity/EdgeToEdge.kt)
- [Apple safeAreaInsets](https://developer.apple.com/documentation/uikit/uiview/safeareainsets)
- [Apple status-bar updates](https://developer.apple.com/documentation/uikit/uiviewcontroller/setneedsstatusbarappearanceupdate())
