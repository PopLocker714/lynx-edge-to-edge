# Compatibility and updates

[Русский](./compatibility.ru.md)

Lynx is the platform; Sparkling is the first checked host. Peer ranges describe the contract
(`@lynx-js/react >=0.116.0`, `@lynx-js/types >=3.9.0`), not every tested combination.
Native minimums: Android API 23, iOS 12.0; passing on a recent OS does not verify minimum OS.

| Profile | Status |
|---|---|
| Historical Sparkling rc / Lynx 3.9 / ReactLynx 0.116 / Rsbuild 1 | Historical evidence; does not verify changed native code |
| Sparkling 2.1.0-rc.36 / Lynx 3.9 / ReactLynx 0.125.0 / types 4.2.1 / Rsbuild 2 | Recorded Debug/Release checks below; stable gate still incomplete |
| Other hosts, iOS multi-scene, minimum OS | Unverified |

Release gate: install the final tarball; verify actual Gradle/Pods sources and module registration;
Debug/Release on both platforms, Android R8; physically verify first frame, rotation, keyboard,
background/resume, bar themes/visibility and two views with different bounds. Test an Android
preloaded/new LynxView after 240 frames: initialize its module before addView, then attach without
refresh/resume and observe its own globalProps. On iOS test unattached->attached and notifications
that must not replace precise view insets with window insets. One QA writer owns a device.
Unit adapters and standalone compilation do not replace these checks.

## Recorded consumer checks (2026-11-17)

Tested source `2ba4bc3`, tarball SHA256
`5c235a69cfcb567cd23ca15d72495ce62fea84ebe346b03044fee118f6250232`.
Pixel 9 / Android 17 and iPhone 11 / iOS 18.4.1: Debug/Release builds, Android R8,
archive equality and actual native source bindings passed. Native runtime stayed 3.9.0.
Android app and iOS Release source: probe `57e5123`; Android test queue-wait correction:
`5324106`; final iOS Debug fixture: `6c57f33`. The latter only changes Debug setup.
Evidence: probe `docs/evidence/edge-2026-11-17/results.json`; shared main bundle SHA256
`a733091ebc094842fd3f6d04f9bb82acd070d3442c9e83381e2d13b4859dde2d`.

Real Android module initialization after 250 frames, before adding the view, passed:
two views received their own geometry/globalProps, including a bounds change, without
manual refresh or store publication. Real iOS views in one window passed unattached to
attached, distinct UIKit insets/globalProps and notification resync. The fixture uses
Sparkling's public MethodPipe setup, like SPKWrapperLynxView; omitting it triggered lazy
pipe creation during bare-view deallocation. That earlier host-fixture crash is preserved
separately; the corrected fixture passed normal teardown. Release has no probe symbols.

| UI scenario | Android Debug | Android Release | iOS Debug | iOS Release |
|---|---|---|---|---|
| Refresh / background-resume | Passed | Passed | Passed | Passed |
| Actual rotation | Passed | Tool-blocked; not claimed passed | Passed | Passed |
| Keyboard show/hide | Passed | Passed | Passed | Host input unavailable |
| Bar style/hidden preserved on resume | Passed | Passed | Native host responsibility | Native host responsibility |

First visible frame is **unverified**. Android logs show an initial JS render with neutral
generation 0; the first stable captured frame around 1.75 seconds has nonzero insets/g1.
That does not prove whether an earlier visible zero-inset frame existed. iOS recording
could not be retrieved after the tool's runner-ownership change. Neither result is a
first-frame pass. Minimum OS, other hosts/scenes and remote CI also remain unverified.

This follow-up changes only documentation. The hash above identifies the tested artifact;
a repack containing these updated documents has a different hash and identical runtime.

When a host updates:

1. Keep the recommended profile pinned; create a separate candidate with exact versions.
2. Read official release notes, breaking changes, native runtime API and plugin toolchain changes.
3. Check peers/autolink/builds without changing the public contract merely for development tooling.
4. Repeat the relevant matrix on the final tarball and record hash, commit, lockfiles, toolchain,
   OS/device and results. A new host does not inherit the old verified status.
5. After review update both language docs and the recommended profile. Do not force a code release
   when compatibility needs only documentation. Recommend the previous profile on regression.

Patch is a compatible fix; minor adds compatible capability; major breaks API, semantics or declared
support. In 0.x a breaking change increments minor. Deprecation and migration guidance precede support
removal except emergency security decisions. Publication is manual and separate from merge/QA;
it is currently blocked until an immutable archive release flow exists.
