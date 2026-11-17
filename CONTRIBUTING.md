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
