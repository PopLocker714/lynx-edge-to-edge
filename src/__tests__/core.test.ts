import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    adopt,
    fromWire,
    getSafeAreaInsets,
    getSafeAreaSnapshot,
    refreshSafeArea,
    resetCoreForTests,
    safeAreaCssVarString,
    subscribeSafeArea,
} from '../core.js'
import { setNativeModule } from '../native.js'
import { createFakeEdgeToEdge } from '../testing/index.js'

beforeEach(() => resetCoreForTests())
afterEach(() => {
    setNativeModule(null)
    ;(globalThis as Record<string, unknown>).lynx = undefined
    vi.restoreAllMocks()
})

describe('fromWire', () => {
    it('заполняет пропуски нулями и не доверяет мусору', () => {
        const s = fromWire(
            { top: 40, generation: 3, keyboardHeight: Number.NaN } as never,
            'native'
        )
        expect(s.insets).toEqual({ top: 40, right: 0, bottom: 0, left: 0 })
        expect(s.keyboardHeight).toBe(0)
        expect(s.generation).toBe(3)
        expect(s.edgeToEdge).toBe(false)
        expect(s.source).toBe('native')
    })
})

describe('fromWire: edgeToEdge', () => {
    it('число 1 из globalProps на iOS считается true', () => {
        expect(
            fromWire({ edgeToEdge: 1 as unknown as boolean, generation: 1 }, 'globalProps')
                .edgeToEdge
        ).toBe(true)
        expect(fromWire({ edgeToEdge: true, generation: 1 }, 'native').edgeToEdge).toBe(true)
        expect(
            fromWire({ edgeToEdge: 0 as unknown as boolean, generation: 1 }, 'native').edgeToEdge
        ).toBe(false)
    })
})

describe('порядок чтения', () => {
    it('keeps warm per-view globalProps when the native owner is not resolved yet', async () => {
        const fake = createFakeEdgeToEdge({
            initialGlobalProps: { top: 47, bottom: 34, generation: 3 },
            native: { top: 0, bottom: 0, generation: 0 },
        })
        setNativeModule(fake)
        expect(getSafeAreaInsets().top).toBe(47)
        await refreshSafeArea()
        expect(getSafeAreaSnapshot().generation).toBe(3)
        expect(getSafeAreaInsets().bottom).toBe(34)
    })

    it('globalProps раньше нативного геттера', () => {
        const fake = createFakeEdgeToEdge({
            initialGlobalProps: { top: 47, bottom: 24, generation: 1 },
            native: { top: 99, generation: 1 },
        })
        setNativeModule(fake)
        const s = getSafeAreaSnapshot()
        expect(s.source).toBe('globalProps')
        expect(s.insets.top).toBe(47)
    })

    it('без globalProps берёт натив', () => {
        setNativeModule(createFakeEdgeToEdge({ native: { top: 12, generation: 1 } }))
        expect(getSafeAreaSnapshot().source).toBe('native')
        expect(getSafeAreaInsets().top).toBe(12)
    })

    it('без всего отдаёт нули и предупреждает ровно один раз', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const a = getSafeAreaSnapshot()
        const b = getSafeAreaSnapshot()
        expect(a.source).toBe('fallback')
        expect(a.insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
        expect(b).toBe(a)
        expect(warn).toHaveBeenCalledTimes(1)
        const text = warn.mock.calls[0]?.[0] as string
        expect(text).toMatch(/MTS/)
        expect(text).toMatch(/ContentProvider/)
        expect(text).toMatch(/adb logcat/)
    })

    it('getSnapshot стабилен по ссылке, пока значения не менялись', () => {
        setNativeModule(createFakeEdgeToEdge({ initialGlobalProps: { top: 47, generation: 1 } }))
        const a = getSafeAreaSnapshot()
        const b = getSafeAreaSnapshot()
        expect(b).toBe(a)
    })
})

describe('adopt', () => {
    it('не откатывается на старое поколение', () => {
        adopt(fromWire({ top: 47, generation: 5 }, 'globalProps'))
        adopt(fromWire({ top: 0, generation: 4 }, 'native'))
        expect(getSafeAreaInsets().top).toBe(47)
    })

    it('те же значения с новым поколением не будят слушателей', () => {
        const fake = createFakeEdgeToEdge({
            initialGlobalProps: { top: 47, bottom: 24, generation: 1 },
        })
        setNativeModule(fake)
        const seen: number[] = []
        subscribeSafeArea((s) => seen.push(s.generation))
        fake.pushGlobalProps({ top: 47, bottom: 24, generation: 2 })
        expect(seen).toEqual([1])
        expect(getSafeAreaSnapshot().generation).toBe(2)
    })

    it('новые значения будят слушателей один раз', () => {
        const fake = createFakeEdgeToEdge({
            initialGlobalProps: { top: 47, generation: 1 },
        })
        setNativeModule(fake)
        const seen: number[] = []
        subscribeSafeArea((s) => seen.push(s.insets.top))
        fake.pushGlobalProps({ top: 0, generation: 2 })
        fake.pushGlobalProps({ top: 0, generation: 2 })
        expect(seen).toEqual([47, 0])
    })
})

describe('subscribeSafeArea', () => {
    it('сразу отдаёт текущее значение и отписывается', () => {
        const fake = createFakeEdgeToEdge({
            initialGlobalProps: { top: 47, generation: 1 },
        })
        setNativeModule(fake)
        const seen: number[] = []
        const off = subscribeSafeArea((s) => seen.push(s.insets.top))
        expect(seen).toEqual([47])
        off()
        fake.pushGlobalProps({ top: 1, generation: 2 })
        expect(seen).toEqual([47])
    })

    it('слушает onGlobalPropsChanged и нативную дельту', () => {
        const fake = createFakeEdgeToEdge({
            initialGlobalProps: { top: 47, generation: 1 },
        })
        setNativeModule(fake)
        subscribeSafeArea(() => {})
        expect(fake.listenerCount('onGlobalPropsChanged')).toBe(1)
        expect(fake.listenerCount('safeareainsetschange')).toBe(1)
        fake.emitNative({ top: 47, keyboardHeight: 300, generation: 2 })
        expect(getSafeAreaSnapshot().keyboardHeight).toBe(300)
        expect(getSafeAreaSnapshot().source).toBe('native')
    })

    it('мусор в событиях игнорируется, подписка живёт', () => {
        const fake = createFakeEdgeToEdge({
            initialGlobalProps: { top: 47, generation: 1 },
        })
        setNativeModule(fake)
        const cb = vi.fn()
        subscribeSafeArea(cb)
        fake.emitRaw('safeareainsetschange', undefined)
        fake.emitRaw('safeareainsetschange', { top: 'x' })
        fake.emitRaw('onGlobalPropsChanged', 'мусор')
        expect(cb).toHaveBeenCalledTimes(1)
        fake.pushGlobalProps({ top: 1, generation: 2 })
        expect(cb).toHaveBeenCalledTimes(2)
    })

    it('без lynx (MTS) подписка не падает и отдаёт fallback', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const seen: string[] = []
        const off = subscribeSafeArea((s) => seen.push(s.source))
        expect(seen).toEqual(['fallback'])
        off()
    })
})

describe('refreshSafeArea', () => {
    it('без модуля резолвится текущим', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        expect((await refreshSafeArea()).source).toBe('fallback')
    })

    it('с модулем принимает результат колбэка', async () => {
        const fake = createFakeEdgeToEdge({ native: { top: 1, generation: 1 } })
        fake.setRefreshResult({ top: 55, generation: 2 })
        setNativeModule(fake)
        const s = await refreshSafeArea()
        expect(s.insets.top).toBe(55)
        expect(s.generation).toBe(2)
    })
})

describe('safeAreaCssVarString', () => {
    it('пять переменных с именами под поиск-замену env(', () => {
        const css = safeAreaCssVarString(
            fromWire({ top: 47, right: 1, bottom: 24, left: 2, keyboardHeight: 300 }, 'native')
        )
        expect(css).toBe(
            '--safe-area-inset-top:47px;--safe-area-inset-right:1px;' +
                '--safe-area-inset-bottom:24px;--safe-area-inset-left:2px;' +
                '--safe-area-keyboard-height:300px;'
        )
    })
})
