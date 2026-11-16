import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setNativeModule } from '../native.js'
import { SystemBars } from '../react/index.js'
import type { SystemBarsEntry } from '../system-bars.js'
import { resetSystemBarsForTests, setSystemBarStyle } from '../system-bars.js'
import { createFakeEdgeToEdge } from '../testing/index.js'

const hooks = vi.hoisted(() => ({
    effects: [] as Array<() => undefined | (() => void)>,
    reference: { current: null as SystemBarsEntry | null },
}))
vi.mock('@lynx-js/react/jsx-dev-runtime', () => ({ jsxDEV: vi.fn() }))
vi.mock('@lynx-js/react/jsx-runtime', () => ({ jsx: vi.fn(), jsxs: vi.fn() }))
vi.mock('@lynx-js/react', () => ({
    useRef: () => hooks.reference,
    useEffect: (effect: () => undefined | (() => void)) => hooks.effects.push(effect),
}))
vi.mock('@lynx-lab/edge-to-edge', async () => import('../index.js'))

beforeEach(() => {
    resetSystemBarsForTests()
    hooks.effects.length = 0
    hooks.reference.current = null
})
afterEach(() => setNativeModule(null))
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve))

it('abandoned render does not create a native side effect', async () => {
    const fake = createFakeEdgeToEdge()
    setNativeModule(fake)
    SystemBars({ style: 'light' })
    await tick()
    expect(fake.barCalls).toEqual([])
    setSystemBarStyle('dark')
    await tick()
    expect(fake.barCalls.at(-2)?.statusBar).toBe('dark')
})

it('effect updates preserve the stack position and unmount removes the current entry', async () => {
    const fake = createFakeEdgeToEdge()
    setNativeModule(fake)
    SystemBars({ style: 'light' })
    hooks.effects[0]?.()
    const cleanup = hooks.effects[1]?.()
    await tick()
    expect(fake.barCalls.at(-2)?.statusBar).toBe('light')
    setSystemBarStyle('dark')
    hooks.effects.length = 0
    SystemBars({ style: 'inverted' })
    hooks.effects[0]?.()
    await tick()
    expect(fake.barCalls.at(-2)?.statusBar).toBe('dark')
    cleanup?.()
    await tick()
    expect(fake.barCalls.at(-2)?.statusBar).toBe('dark')
    expect(hooks.reference.current).toBeNull()
})
