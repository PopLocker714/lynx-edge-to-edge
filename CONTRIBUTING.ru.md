# Участие в разработке

[English](./CONTRIBUTING.md)

Код: 4 пробела, 100 колонок, Biome 2.5.9; Kotlin ktlint 1.7.1; Objective-C clang-format 21.1.8.
Существующая структура TS/core → native adapters сохраняется. Runtime и test TS environments
разделены; TypeScript 5.9.3 strict, skipLibCheck=false; explicit optional undefined остаётся совместимым.

```sh
bun install --frozen-lockfile
bun run check
bun run check:audit
bun run check:android
LYNX_FRAMEWORKS_DIR=/path/to/Debug-iphoneos bun run check:ios
CONSUMER_ROOT=/path/to/host CONSUMER_TARBALL=/path/to/package.tgz bun run check:consumer:bindings
CONSUMER_ROOT=/path/to/host CONSUMER_TARBALL=/path/to/package.tgz bun run check:consumer
```

`check` проверяет lint без warnings, оба TS environment, negative type control, tests, build,
упакованные exports/native inventory/docs links и README examples из извлечённого tarball.
`check:android` — JVM tests настоящего store с Lynx adapters, Kotlin compile Debug/Release, Lint.
`check:ios` — compile/static analysis настоящих ObjC sources против реальных Lynx headers.
Для CI ios-check закрепляет SDK и Pods; локально можно использовать уже собранные frameworks.
`KTLINT_JAR` и `CLANG_FORMAT` позволяют использовать уже установленные точные версии.
Ни одна из этих проверок не означает physical QA. Consumer gate компилирует host и проверяет
реальные compiler inputs, runtime linkage, autolink и source-filter configuration; он намеренно
поддерживает только закреплённый Sparkling layout и отклоняет неизвестные source filters.

Перед install нужно >=15 GiB свободно, перед native build >=25 GiB, после пика оставить >=10 GiB.
Тяжёлые операции сериализуются. Не удалять общие caches или чужие worktrees.

## Ограниченные dev exceptions

ReactLynx 0.125 npm declarations пропускают `ElementNode`; `types/reactlynx-0.125.d.ts`
восстанавливает дословную upstream declaration из commit db8f978aba9b2e896a71d835ebcb0f2dcc9b68c2,
Apache-2.0. Dev-only, не экспортируется и не пакуется. `@types/react` и internal-preact alias
закреплены точно. Negative control без файла обязан показать только отсутствие ElementNode.
Владелец Lynx Lab; пересмотр 2026-12-16, истечение 2026-12-17. Удалить после upstream fix и проверки.

`@lynx-js/types` 4.2.1 содержит устаревшее расширение `react.JSX`: при hoisted install
оно смешивает refs React DOM input с Lynx и затеняет Lynx `SVGProps`. Dev-only patch под
Apache-2.0 удаляет только это расширение, сохраняя все экспортируемые типы элементов Lynx.
ReactLynx 0.125 использует собственный JSX namespace `@lynx-js/react/jsx-runtime`.
Strict fixture проверяет native input/SVG и несовместимость DOM/native refs. Compatibility
check привязан к точной версии и SHA256 declaration. Пересмотреть при обновлении Lynx types
или ReactLynx; удалить, когда upstream корректно разделит JSX namespaces. Корневой dev patch
не поставляется и не применяется в consumer: его renderer/type profile проверяется отдельно.
Hoisted и isolated development layouts проверены с `skipLibCheck: false`; разрешённые
версии зависимостей и runtime bytes не меняются.

После совместимого обновления своего dev graph остались GHSA-3g3m-2fjr-6pw4 (glob cancellation)
и GHSA-g3hv-75wg-m249 (minimatch amplification), только dev release tooling. Злоумышленнику нужен
контроль над glob/input tooling; native runtime dependency их не поставляет. Публикация заблокирована.
Проверены реальные npm 11.21.2 bundled версии, а не только lock: glob13.0.6, minimatch10.2.5,
brace-expansion5.0.12, postcss-selector-parser7.1.6, undici6.29.1, ip-address10.7.5.
`check:audit` привязан к SHA256 собственного bun.lock, этим версиям и сроку; новые advisory не
игнорируются. Владелец Lynx Lab; пересмотр 2026-12-16, истечение 2026-12-17. Это исключение,
а не утверждение о нулевых уязвимостях.

Исключения Android standalone (владелец Lynx Lab, пересмотр 2026-12-16): AndroidX core 1.13.1
закреплён для host compileSdk 34; подавлен только его GradleDependency hint.
Deprecated setter контраста status bar сохранён для ОС/target до enforcement.
Upstream processor kapt объявляет RELEASE_8 при Java 11; SDK tools могут выводить warning
metadata XML v3/v4. Это diagnostics сторонних инструментов, не warnings исходников пакета.
Standalone Kotlin language 1.9 убирает fallback kapt; consumers сохраняют свой Kotlin DSL.

## Review, документация и выпуск

Нетривиальные native/lifecycle/API изменения проходят независимый read-only review.
Проверять [контракт реализации](./docs/implementation.ru.md) и
[матрицу совместимости](./docs/compatibility.ru.md). Потребительские docs меняются парами EN/RU.
Conventional commits описывают change; форматирование отдельно от поведения.

Прямые `release` и `prepublishOnly` остаются заблокированы. Ручной workflow
prepare → QA → publish сохраняет один неизменяемый архив; см. [порядок выпуска](./docs/releasing.ru.md).
Выберите SemVer и закоммитьте финальные version/changelog до подготовки.
`release:dry-run` — только рекомендательный анализ. Нужны полный source-bound QA и явный
manual publish; успешные локальные checks сами по себе не разрешают публикацию.

Основной компилятор — Xcode 27.2 локально и в образе GitHub `xcode-27`.
При сборке закреплённого `ios-check` fixture используется
`IPHONEOS_DEPLOYMENT_TARGET=15.0`: этот Xcode отклоняет старые targets транзитивных
Pods. Override тестовой сборки не меняет podspec библиотеки и не подтверждает
заявленный минимум iOS 12. Версии macOS/SDK записываются для каждого прогона.
В fixture Lynx 3.9 диагностики `c99-designator` и `deprecated-declarations`
остаются предупреждениями только в target Lynx. `unused-result` понижен только
в `parallel_parse_task_scheduler.cc` и `LynxTemplateRender.mm`, а
`deprecated-implementations` — только в `LynxTextLayoutManager.m`. Источник —
компиляция закреплённого SDK с Xcode 27.2; точная область — `ios-check/Podfile`.
Проверки нашего модуля сохраняют `-Werror`; предупреждения не скрываются,
runtime-исходники не меняются. Владелец: Lynx Lab; обнаружено 2026-11-18;
пересмотр до 2026-12-18 или при смене Lynx/Xcode, до merge при истечении срока.
