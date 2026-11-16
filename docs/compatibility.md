# Compatibility and updates

[Русский](./compatibility.ru.md)

Lynx is the platform; Sparkling is the first checked host. Peer ranges describe the contract
(`@lynx-js/react >=0.116.0`, `@lynx-js/types >=3.9.0`), not every tested combination.
Native minimums: Android API 23, iOS 12.0; passing on a recent OS does not verify minimum OS.

| Profile | Status |
|---|---|
| Historical Sparkling rc / Lynx 3.9 / ReactLynx 0.116 / Rsbuild 1 | Historical evidence; does not verify changed native code |
| Sparkling 2.1.0-rc.36 / Lynx 3.9 / ReactLynx 0.125.0 / types 4.2.1 / Rsbuild 2 | Candidate; final archive consumer QA required |
| Other hosts, iOS multi-scene, minimum OS | Unverified |

Release gate: install the final tarball; verify actual Gradle/Pods sources and module registration;
Debug/Release on both platforms, Android R8; physically verify first frame, rotation, keyboard,
background/resume, bar themes/visibility and two views with different bounds. Test an Android
preloaded/new LynxView after 240 frames: initialize its module before addView, then attach without
refresh/resume and observe its own globalProps. On iOS test unattached->attached and notifications
that must not replace precise view insets with window insets. One QA writer owns a device.
Unit adapters and standalone compilation do not replace these checks.

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
