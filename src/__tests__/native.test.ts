import { afterEach, describe, expect, it } from 'vitest'
import { setNativeModule, tryGetNativeModule } from '../native.js'
import { createFakeEdgeToEdge } from '../testing/index.js'

afterEach(() => {
  setNativeModule(null)
  ;(globalThis as Record<string, unknown>).NativeModules = undefined
})

describe('tryGetNativeModule', () => {
  it('без NativeModules отдаёт null, а не бросает: MTS это норма', () => {
    expect(tryGetNativeModule()).toBeNull()
  })

  it('инъекция побеждает глобал', () => {
    const fake = createFakeEdgeToEdge()
    setNativeModule(fake)
    expect(tryGetNativeModule()).toBe(fake)
  })

  it('модуль без getSnapshot не считается модулем', () => {
    ;(globalThis as Record<string, unknown>).NativeModules = {
      LynxEdgeToEdgeModule: { refresh() {} },
    }
    expect(tryGetNativeModule()).toBeNull()
  })

  it('находит настоящий по имени', () => {
    const m = { getSnapshot: () => ({}) }
    ;(globalThis as Record<string, unknown>).NativeModules = {
      LynxEdgeToEdgeModule: m,
    }
    expect(tryGetNativeModule()).toBe(m)
  })
})
