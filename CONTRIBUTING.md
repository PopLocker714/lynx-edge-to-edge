# Contributing

[Русский](./CONTRIBUTING.ru.md)

Code: four spaces, 100 columns, Biome 2.5.9; Kotlin ktlint 1.7.1; Objective-C clang-format 21.1.8.
Keep the existing TS/core → native adapters layout. Runtime/test TypeScript environments are separate;
TypeScript 5.9.3 strict, skipLibCheck=false; explicit optional undefined remains compatible.

```sh
bun install --frozen-lockfile
bun run check
bun run check:audit
bun run check:android
LYNX_FRAMEWORKS_DIR=/path/to/Debug-iphoneos bun run check:ios
CONSUMER_ROOT=/path/to/host CONSUMER_TARBALL=/path/to/package.tgz bun run check:consumer:bindings
CONSUMER_ROOT=/path/to/host CONSUMER_TARBALL=/path/to/package.tgz bun run check:consumer
```

`check` runs warning-free lint, both TS environments, the negative type control, tests, build,
packaged exports/native inventory/docs links and README examples against the extracted tarball.
`check:android` runs actual-store JVM tests with Lynx adapters, Debug/Release Kotlin compile and Lint.
`check:ios` compiles/analyzes actual Objective-C sources against real Lynx headers.
CI ios-check pins SDK and Pods; locally existing built frameworks may be reused.
`KTLINT_JAR` and `CLANG_FORMAT` select already installed exact tool versions.
None of these checks means physical QA. The consumer gate compiles the host and verifies actual
compiler inputs, runtime linkage, autolink and source-filter configuration; it deliberately supports
only the pinned Sparkling layout and rejects unknown source filters.

Before install require >=15 GiB free, before native build >=25 GiB, keeping >=10 GiB after peak.
Serialize heavy operations. Do not remove shared caches or another task's worktrees.

## Bounded development exceptions

ReactLynx 0.125 npm declarations omit `ElementNode`; `types/reactlynx-0.125.d.ts` restores the literal
upstream declaration from commit db8f978aba9b2e896a71d835ebcb0f2dcc9b68c2, Apache-2.0.
Development only, neither exported nor packed. `@types/react` and internal-preact alias are pinned.
The negative control without that file must report only the omitted ElementNode.
Owner: Lynx Lab; review 2026-12-16, expires 2026-12-17. Remove after upstream fix and verification.

`@lynx-js/types` 4.2.1 includes a legacy `react.JSX` augmentation that conflicts with
React 18 DOM input refs and shadows Lynx `SVGProps` during hoisted installs. The dev-only
Apache-2.0 patch removes that augmentation; all exported Lynx element types remain intact.
ReactLynx 0.125 uses its own `@lynx-js/react/jsx-runtime` JSX namespace. A strict fixture
verifies native input/SVG types and keeps DOM and native refs distinct. The compatibility
check binds the patch to the exact version and declaration SHA256. Reassess on either Lynx
types or ReactLynx upgrade; remove when upstream separates these JSX namespaces correctly.
This root development patch is not shipped to or applied in consumer installations; those
must verify their own renderer/type profile. Both hoisted and isolated development layouts
are checked with `skipLibCheck: false`. No dependency resolution or runtime byte changes.

Compatible updates of this package's development graph leave GHSA-3g3m-2fjr-6pw4 (glob cancellation)
and GHSA-g3hv-75wg-m249 (minimatch amplification), in development release tooling only. An attacker
needs control over tooling glob/input; the native runtime ships neither dependency. Publishing is blocked.
Actual npm 11.21.2 bundled versions were inspected, beyond the lockfile: glob13.0.6, minimatch10.2.5,
brace-expansion5.0.12, postcss-selector-parser7.1.6, undici6.29.1, ip-address10.7.5.
`check:audit` binds this exception to this package's bun.lock SHA256, these versions and expiry;
new advisories are not ignored. Owner: Lynx Lab; review 2026-12-16, expires 2026-12-17.
This is an exception, not a zero-vulnerability claim.

Android standalone exceptions (owner: Lynx Lab, review 2026-12-16): AndroidX core 1.13.1
is pinned for compileSdk 34 host compatibility; only its GradleDependency hint is suppressed.
The deprecated status-bar contrast setter is retained for pre-enforcement OS/targets.
Kapt's upstream processor advertises RELEASE_8 under Java 11; SDK tools may print XML v3/v4
metadata warnings. These third-party/toolchain diagnostics are not package source warnings.
Standalone Kotlin language 1.9 avoids kapt's fallback warning; consumers retain their own Kotlin DSL.

## Review, documentation and release

Nontrivial native/lifecycle/API changes need independent read-only review. Check the
[implementation contract](./docs/implementation.md) and [compatibility matrix](./docs/compatibility.md).
Consumer docs change together in EN/RU. Conventional commits describe the change; formatting stays
separate from behavior.

Direct `release` and `prepublishOnly` remain blocked. The manual prepare → QA → publish
workflow now preserves one immutable archive; see [Releasing](./docs/releasing.md).
Choose SemVer explicitly and commit the final version/changelog before preparation.
`release:dry-run` provides advisory analysis only. Complete source-bound QA and explicit
manual publish approval are required; passing local checks does not authorize publication.

The primary compiler is Xcode 27.2 locally and on the `xcode-27` GitHub image.
The locked `ios-check` fixture uses
`IPHONEOS_DEPLOYMENT_TARGET=15.0` for its build because this Xcode rejects older
transitive Pod targets. This fixture override does not change the library podspec
or verify the declared iOS 12 minimum. Record macOS/SDK versions with each run.
The pinned Lynx 3.9 fixture retains `c99-designator` and `deprecated-declarations`
diagnostics as warnings only in target Lynx. `unused-result` is downgraded only in
`parallel_parse_task_scheduler.cc` and `LynxTemplateRender.mm`, and
`deprecated-implementations` only in `LynxTextLayoutManager.m`. These exceptions
come from compiling the locked SDK with Xcode 27.2; see `ios-check/Podfile`.
Our module checks retain `-Werror`; no warning is suppressed and no runtime source
is changed. Owner: Lynx Lab; observed 2026-11-18; reassess by 2026-12-18 or when
changing Lynx/Xcode, before merge if the exception has expired.
