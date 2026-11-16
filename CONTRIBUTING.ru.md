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

`prepublishOnly` и release workflow намеренно блокируют публикацию: semantic-release перепаковывает
после version/changelog, и QA не доказывает итоговый архив. Нужна цепочка prepare → immutable tarball
→ consumer QA → publish того же hash. Trusted Publishing/OIDC и явный provenance обязательны;
долгоживущий npm token не используется. Dry run не публикует. Успешные checks не разрешают релиз.
