# Совместимость и обновления

[English](./compatibility.md)

Основная платформа — Lynx; Sparkling — первый проверяемый host. Peer ranges описывают
контракт (`@lynx-js/react >=0.116.0`, `@lynx-js/types >=3.9.0`), а не результаты всех сочетаний.
Минимумы native: Android API 23, iOS 12.0; прохождение на свежей ОС не доказывает эти минимумы.

| Профиль | Статус |
|---|---|
| Исторический Sparkling rc / Lynx 3.9 / ReactLynx 0.116 / Rsbuild 1 | Старые evidence; не подтверждают изменённый native-код |
| Sparkling 2.1.0-rc.36 / Lynx 3.9 / ReactLynx 0.125.0 / types 4.2.1 / Rsbuild 2 | Candidate; consumer QA финального архива ещё требуется |
| Другие host, multi-scene iOS, minimum OS | Не проверены |

Release gate: поставить финальный tarball; проверить actual Gradle/Pods sources и регистрацию;
Debug/Release на обеих платформах, Android R8; физически первый кадр, rotation, keyboard,
background/resume, bar themes/visibility и два view с разными bounds. Проверить новый/preloaded
Android LynxView после 240 кадров: создать модуль до addView, затем добавить view без refresh/resume
и увидеть свои globalProps. Для iOS проверить unattached->attached и notification resync, который
не меняет precise insets на window insets. Устройство принадлежит одному QA writer.
Unit adapters и standalone compile не заменяют эти проверки.

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
Публикация вручную, отдельно от merge/QA; текущая публикация заблокирована до immutable archive flow.
