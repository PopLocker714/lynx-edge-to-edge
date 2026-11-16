import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setNativeModule } from '../native.js'
import {
    createEntry,
    mergeStack,
    popStackEntry,
    pushStackEntry,
    replaceStackEntry,
    resetSystemBarsForTests,
    setSystemBarHidden,
    setSystemBarStyle,
} from '../system-bars.js'
import { createFakeEdgeToEdge } from '../testing/index.js'

const tick = () => new Promise<void>((r) => queueMicrotask(r))

beforeEach(() => resetSystemBarsForTests())
afterEach(() => setNativeModule(null))

describe('createEntry', () => {
    it('строка раскрывается на оба бара, объект по полям, пропуск это null', () => {
        expect(createEntry({ style: 'light' })).toEqual({
            statusBarStyle: 'light',
            navigationBarStyle: 'light',
            statusBarHidden: null,
            navigationBarHidden: null,
        })
        expect(
            createEntry({
                style: { statusBar: 'dark' },
                hidden: { navigationBar: true },
            })
        ).toEqual({
            statusBarStyle: 'dark',
            navigationBarStyle: null,
            statusBarHidden: null,
            navigationBarHidden: true,
        })
    })
})

describe('mergeStack', () => {
    it('побеждает последняя запись, null не перекрывает', () => {
        const merged = mergeStack([
            createEntry({ style: 'light', hidden: true }),
            createEntry({ style: { navigationBar: 'dark' } }),
        ])
        expect(merged).toEqual({
            statusBarStyle: 'light',
            navigationBarStyle: 'dark',
            statusBarHidden: true,
            navigationBarHidden: true,
        })
    })
})

describe('стек и батчинг', () => {
    it('несколько push в одном тике дают один вызов каждого сеттера', async () => {
        const fake = createFakeEdgeToEdge()
        setNativeModule(fake)
        setSystemBarStyle('light')
        setSystemBarHidden(true)
        expect(fake.barCalls).toHaveLength(0)
        await tick()
        expect(fake.barCalls).toEqual([
            { kind: 'style', statusBar: 'light', navigationBar: 'light' },
            { kind: 'hidden', statusBar: true, navigationBar: true },
        ])
    })

    it('pop возвращает предыдущее, одинаковый итог не пушится повторно', async () => {
        const fake = createFakeEdgeToEdge()
        setNativeModule(fake)
        const a = pushStackEntry({ style: 'dark' })
        await tick()
        const b = pushStackEntry({ style: 'light' })
        await tick()
        popStackEntry(b)
        await tick()
        expect(fake.barCalls.filter((c) => c.kind === 'style').map((c) => c.statusBar)).toEqual([
            'dark',
            'light',
            'dark',
        ])
        popStackEntry(a)
        await tick()
        expect(fake.barCalls.at(-2)).toEqual({
            kind: 'style',
            statusBar: 'auto',
            navigationBar: 'auto',
        })
        const n = fake.barCalls.length
        pushStackEntry({ style: 'auto' })
        await tick()
        expect(fake.barCalls.length).toBe(n)
    })

    it('replace меняет запись на месте', async () => {
        const fake = createFakeEdgeToEdge()
        setNativeModule(fake)
        const a = pushStackEntry({ style: 'dark' })
        pushStackEntry({ hidden: true })
        await tick()
        replaceStackEntry(a, { style: 'light' })
        await tick()
        expect(fake.barCalls.at(-2)).toEqual({
            kind: 'style',
            statusBar: 'light',
            navigationBar: 'light',
        })
        expect(fake.barCalls.at(-1)).toEqual({
            kind: 'hidden',
            statusBar: true,
            navigationBar: true,
        })
    })

    it('без нативного модуля молча копит стек', async () => {
        setSystemBarStyle('light')
        await tick()
        const fake = createFakeEdgeToEdge()
        setNativeModule(fake)
        setSystemBarHidden(true)
        await tick()
        expect(fake.barCalls).toEqual([
            { kind: 'style', statusBar: 'light', navigationBar: 'light' },
            { kind: 'hidden', statusBar: true, navigationBar: true },
        ])
    })
})

describe('imperative entry ownership', () => {
    it('moves only the invoked field above component entries', async () => {
        const fake = createFakeEdgeToEdge()
        setNativeModule(fake)
        setSystemBarStyle('light')
        setSystemBarHidden(true)
        let component = pushStackEntry({ style: 'dark', hidden: false })
        await tick()
        setSystemBarStyle('inverted')
        await tick()
        expect(fake.barCalls.at(-2)?.statusBar).toBe('inverted')
        expect(fake.barCalls.at(-1)?.statusBar).toBe(false)
        component = replaceStackEntry(component, { style: 'auto', hidden: false })
        await tick()
        expect(fake.barCalls.at(-2)?.statusBar).toBe('inverted')
        setSystemBarHidden(true)
        await tick()
        expect(fake.barCalls.at(-1)?.statusBar).toBe(true)
        popStackEntry(component)
        await tick()
        expect(fake.barCalls.at(-2)?.statusBar).toBe('inverted')
        expect(fake.barCalls.at(-1)?.statusBar).toBe(true)
    })

    it('retains latest imperative values after repeated updates and component teardown', async () => {
        const fake = createFakeEdgeToEdge()
        setNativeModule(fake)
        for (let index = 0; index < 1000; index++) {
            setSystemBarStyle(index % 2 ? 'dark' : 'light')
            setSystemBarHidden(index % 2 === 1)
        }
        const component = pushStackEntry({ style: 'auto', hidden: false })
        await tick()
        popStackEntry(component)
        await tick()
        expect(fake.barCalls.at(-2)?.statusBar).toBe('dark')
        expect(fake.barCalls.at(-1)?.statusBar).toBe(true)
    })
})
