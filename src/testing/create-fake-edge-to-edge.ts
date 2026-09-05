import type { LynxEdgeToEdgeNative, SafeAreaWire } from '../native.js'

export interface FakeEdgeToEdgeOptions {
  /** Что лежит в lynx.__globalProps.safeArea на старте. По умолчанию ничего. */
  initialGlobalProps?: Partial<SafeAreaWire> | null
  /** Что отдаёт нативный getSnapshot. По умолчанию нули с generation 0. */
  native?: Partial<SafeAreaWire>
}

export interface FakeEdgeToEdge extends LynxEdgeToEdgeNative {
  /** Сымитировать пуш globalProps с нативной стороны: мерж по ключу плюс событие. */
  pushGlobalProps(wire: Partial<SafeAreaWire>): void
  /** Сымитировать нативную дельту (iOS-канал `safeareainsetschange`). */
  emitNative(wire: Partial<SafeAreaWire>): void
  /** Произвольный payload в любое событие, включая мусор. */
  emitRaw(event: string, payload: unknown): void
  /** Сколько слушателей висит на событии. */
  listenerCount(event: string): number
  /** Что native.refresh отдаст в колбэк. */
  setRefreshResult(wire: Partial<SafeAreaWire>): void
  /** Журнал вызовов сеттеров баров, в порядке вызова. */
  readonly barCalls: ReadonlyArray<
    | { kind: 'style'; statusBar: string; navigationBar: string }
    | { kind: 'hidden'; statusBar: boolean; navigationBar: boolean }
  >
  /** Текущее содержимое lynx.__globalProps. */
  readonly globalProps: Record<string, unknown>
}

function wire(partial: Partial<SafeAreaWire>): SafeAreaWire {
  return {
    top: partial.top ?? 0,
    right: partial.right ?? 0,
    bottom: partial.bottom ?? 0,
    left: partial.left ?? 0,
    keyboardHeight: partial.keyboardHeight ?? 0,
    generation: partial.generation ?? 0,
    edgeToEdge: partial.edgeToEdge ?? false,
  }
}

/**
 * Фейк нативного модуля, globalProps и GlobalEventEmitter для тестов и для
 * Lynx Explorer, где нативной половины ещё нет.
 *
 * Устанавливает `globalThis.lynx` с `__globalProps` и `getJSModule`.
 * ReactLynx на настоящем устройстве делает ровно то же самое при
 * `__NotifyGlobalPropsUpdated`: Object.assign в __globalProps и
 * emit('onGlobalPropsChanged').
 */
export function createFakeEdgeToEdge(
  options: FakeEdgeToEdgeOptions = {}
): FakeEdgeToEdge {
  const listeners = new Map<string, Set<(...a: unknown[]) => void>>()
  const globalProps: Record<string, unknown> = {}
  if (options.initialGlobalProps) {
    globalProps.safeArea = wire(options.initialGlobalProps)
  }
  let nativeSnapshot = wire(options.native ?? {})
  let refreshResult: SafeAreaWire | null = null
  const barCalls: Array<
    | { kind: 'style'; statusBar: string; navigationBar: string }
    | { kind: 'hidden'; statusBar: boolean; navigationBar: boolean }
  > = []

  const emit = (event: string, payload: unknown): void => {
    for (const cb of listeners.get(event) ?? []) cb(payload)
  }

  const g = globalThis as Record<string, unknown>
  const existing = (g.lynx ?? {}) as Record<string, unknown>
  g.lynx = {
    ...existing,
    __globalProps: globalProps,
    getJSModule: (name: string) =>
      name === 'GlobalEventEmitter'
        ? {
            addListener(n: string, cb: (...a: unknown[]) => void) {
              if (!listeners.has(n)) listeners.set(n, new Set())
              listeners.get(n)?.add(cb)
            },
            removeListener(n: string, cb: (...a: unknown[]) => void) {
              listeners.get(n)?.delete(cb)
            },
          }
        : null,
  }

  return {
    getSnapshot(): SafeAreaWire {
      return nativeSnapshot
    },
    refresh(callback) {
      const result = refreshResult ?? nativeSnapshot
      nativeSnapshot = result
      callback(result)
    },
    setSystemBarStyle(statusBar, navigationBar) {
      barCalls.push({ kind: 'style', statusBar, navigationBar })
    },
    setSystemBarHidden(statusBar, navigationBar) {
      barCalls.push({ kind: 'hidden', statusBar, navigationBar })
    },
    pushGlobalProps(partial) {
      globalProps.safeArea = wire(partial)
      emit('onGlobalPropsChanged', undefined)
    },
    emitNative(partial) {
      emit('safeareainsetschange', wire(partial))
    },
    emitRaw(event, payload) {
      emit(event, payload)
    },
    listenerCount(event) {
      return listeners.get(event)?.size ?? 0
    },
    setRefreshResult(partial) {
      refreshResult = wire(partial)
    },
    get barCalls() {
      return barCalls
    },
    get globalProps() {
      return globalProps
    },
  }
}
