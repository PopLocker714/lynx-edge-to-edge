# Совместимость и обновления

[English](./compatibility.md)

Основная платформа — Lynx; Sparkling — первый проверяемый host. Peer ranges описывают
контракт (`@lynx-js/react >=0.116.0`, `@lynx-js/types >=3.9.0`), а не результаты всех сочетаний.
Минимумы native: Android API 23, iOS 12.0; прохождение на свежей ОС не доказывает эти минимумы.

| Профиль | Статус |
|---|---|
| Исторический Sparkling rc / Lynx 3.9 / ReactLynx 0.116 / Rsbuild 1 | Старые evidence; не подтверждают изменённый native-код |
| Sparkling 2.1.0-rc.36 / Lynx 3.9 / ReactLynx 0.125.0 / types 4.2.1 / Rsbuild 2 | Debug/Release checks зафиксированы ниже; stable gate ещё не закрыт |
| Другие host, multi-scene iOS, minimum OS | Не проверены |

Release gate: поставить финальный tarball; проверить actual Gradle/Pods sources и регистрацию;
Debug/Release на обеих платформах, Android R8; физически первый кадр, rotation, keyboard,
background/resume, bar themes/visibility и два view с разными bounds. Проверить новый/preloaded
Android LynxView после 240 кадров: создать модуль до addView, затем добавить view без refresh/resume
и увидеть свои globalProps. Для iOS проверить unattached->attached и notification resync, который
не меняет precise insets на window insets. Устройство принадлежит одному QA writer.
Unit adapters и standalone compile не заменяют эти проверки.

## Зафиксированные consumer-проверки (2026-11-17)

Проверенный source `2ba4bc3`, SHA256 tarball
`5c235a69cfcb567cd23ca15d72495ce62fea84ebe346b03044fee118f6250232`.
Pixel 9 / Android 17 и iPhone 11 / iOS 18.4.1: Debug/Release сборки, Android R8,
совпадение архивов и actual native source bindings прошли. Native runtime остался 3.9.0.
Source Android app и iOS Release: probe `57e5123`; исправление ожидания UI queue в
Android test: `5324106`; финальный iOS Debug fixture: `6c57f33`. Последний меняет только Debug setup.
Evidence: probe `docs/evidence/edge-2026-11-17/results.json`; общий main bundle SHA256
`a733091ebc094842fd3f6d04f9bb82acd070d3442c9e83381e2d13b4859dde2d`.

Настоящий Android module после 250 кадров, до добавления view, прошёл проверку:
два view получили свои geometry/globalProps, в том числе после изменения bounds,
без ручного refresh или публикации в store. Реальные iOS view одного окна прошли
unattached→attached, различные UIKit insets/globalProps и notification resync. Fixture
использует публичный MethodPipe setup Sparkling, как SPKWrapperLynxView; без него
ленивая pipe initialization запускалась при уничтожении bare view. Прежний crash
host-fixture сохранён отдельно; исправленный fixture прошёл нормальный teardown.
В Release нет probe symbols.

| UI-сценарий | Android Debug | Android Release | iOS Debug | iOS Release |
|---|---|---|---|---|
| Refresh / background-resume | Прошёл | Прошёл | Прошёл | Прошёл |
| Настоящий поворот | Прошёл | Tool-blocked; PASS не заявлен | Прошёл | Прошёл |
| Показ/скрытие клавиатуры | Прошёл | Прошёл | Прошёл | Нет host input |
| Style/hidden баров сохраняются после resume | Прошёл | Прошёл | Ответственность native host | Ответственность native host |

В физических проверках 2026-11-17 первый видимый кадр **не подтверждён**. Android logs содержат
начальный JS render с neutral generation 0; первый стабильный захваченный кадр около 1,75 с уже имеет инсеты/g1.
Это не доказывает наличие или отсутствие более раннего видимого кадра с нулевыми inset.
iOS recording не удалось получить после смены runner ownership в инструменте.
Ни один результат не считается first-frame PASS. Более поздние результаты симулятора и CI
зафиксированы отдельно ниже.

Последующее изменение касается только документации. Hash выше обозначает проверенный
артефакт; упаковка обновлённых документов имеет другой hash при идентичном runtime.

## Проверки симулятора и remote CI (2026-11-18)

Исходный `SPKViewController` Sparkling загружал шаблон до attach и провалил first-frame QA
в 3/3 записях: видимые нулевые fallback-инсеты предшествовали обновлению globalProps. Пробник
`a11a4dd` использует полноэкранный host-adapter на публичном `SPKContainerView` с единственной
загрузкой после attach/layout. Сборка iOS 27 Release прошла; независимая проверка трёх записей
обнаружила ненулевые инсеты/generation 1 в первом записанном новом контенте (3/3 PASS).
Это ограниченный результат симулятора, не доказательство каждого отображённого кадра. Он не
исправляет стандартный Sparkling автоматически: контракт загрузки host требует adapter.
Произвольные embedded view, другие host/scenes, первый кадр на физическом устройстве и minimum OS
остаются непроверенными.

В том же Release на симуляторе подтверждены background/resume, итоговые значения inset после
поворота (landscape top/right/bottom/left `0/62/20/62` → portrait top/bottom `62/34`) и
показ/скрытие native keyboard fixture (`349 → 0`). Результат поворота не доказывает отсутствие
промежуточных скачков.
Физическая проверка клавиатуры iOS Release открыта; симулятор не заменяет физическую матрицу.
[Evidence](https://github.com/PopLocker714/lynx-lab/blob/docs/package-standards/docs/evidence/ios-simulator-2026-11-18/results.json).

Remote JS, Android и iOS CI прошли на package commit `b9a27f9`. Аудит зависимостей завершился
ошибкой на picomatch; успешные build jobs не закрывают этот release gate и не означают stable.

При обновлении host:

1. Оставить recommended связку закреплённой; создать отдельный candidate с точными версиями.
2. Прочитать официальные release notes, breaking changes, API native runtime и plugin toolchain.
3. Проверить peer ranges/autolink/сборки без изменения публичного контракта ради dev tooling.
4. Повторить релевантную матрицу на финальном tarball и сохранить hash, commit, lockfiles,
   toolchain, OS/device и результаты. Новый host не наследует старый verified.
5. После review обновить обе языковые docs и recommended профиль. Не менять код ради релиза,
   если совместимость подтверждается одной документацией. При регрессии рекомендовать прежнюю связку.

Patch — совместимое исправление; minor — новая совместимая возможность; major — нарушение API,
семантики или снятие заявленной поддержки. В 0.x breaking change повышает minor. Deprecation
и migration path предшествуют снятию поддержки, кроме экстренного security решения.
Публикация вручную, отдельно от merge/QA; она остаётся заблокированной до финальной версии
и QA receipt, успешных release gates и проверки Trusted Publishing.
