/**
 * Источник истины в JS. Не зависит от React.
 *
 * Порядок чтения: globalProps → нативный геттер → нули. globalProps первым,
 * потому что это единственный канал, живой на первом кадре: пуш, сделанный
 * до старта рантайма, буферизуется `BTSRuntime::OnGlobalPropsUpdated` в
 * `init_global_props_` и приезжает как НАЧАЛЬНОЕ значение
 * (core/shell/runtime/bts/bts_runtime.cc:1123-1135 @4.0.1, спайк S6 в lynx-lab).
 */
import type { SafeAreaWire } from './native.js'
import { tryGetNativeModule } from './native.js'
import type { EdgeInsets, SafeAreaSnapshot } from './types.js'
import { ZERO_INSETS } from './types.js'

/** Событие для дельт с нативной стороны (iOS). Android обновляет через globalProps. */
export const SAFE_AREA_EVENT = 'safeareainsetschange'
export const GLOBAL_PROPS_KEY = 'safeArea'
/**
 * ReactLynx превращает `__NotifyGlobalPropsUpdated` в
 * `Object.assign(lynx.__globalProps, data)` и это событие на GlobalEventEmitter
 * (@lynx-js/react runtime/lib/lynx/tt.js:219-229, есть с 0.116).
 */
export const GLOBAL_PROPS_CHANGED_EVENT = 'onGlobalPropsChanged'

/** Локальное объявление: у @lynx-js/types нет рантайма, а на MTS половины полей нет. */
declare const lynx:
  | {
      __globalProps?: Record<string, unknown>
      getJSModule?: (name: string) => {
        addListener(event: string, cb: (...args: unknown[]) => void): void
        removeListener(event: string, cb: (...args: unknown[]) => void): void
      } | null
    }
  | undefined

type Listener = (snapshot: SafeAreaSnapshot) => void

const FALLBACK: SafeAreaSnapshot = {
  insets: ZERO_INSETS,
  keyboardHeight: 0,
  generation: -1,
  edgeToEdge: false,
  source: 'fallback',
}

const listeners = new Set<Listener>()
let cached: SafeAreaSnapshot = FALLBACK
let warned = false
let emitterBound = false

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function fromWire(
  wire: Partial<SafeAreaWire>,
  source: SafeAreaSnapshot['source']
): SafeAreaSnapshot {
  return {
    insets: {
      top: num(wire.top),
      right: num(wire.right),
      bottom: num(wire.bottom),
      left: num(wire.left),
    },
    keyboardHeight: num(wire.keyboardHeight),
    generation: num(wire.generation),
    // iOS кладёт @YES в globalProps, и в JS это приезжает числом 1, а не true.
    // Без нормализации снимок из globalProps и из нативного события различаются
    // одним этим полем и порождают лишний ре-рендер.
    edgeToEdge: wire.edgeToEdge === true || (wire.edgeToEdge as unknown) === 1,
    source,
  }
}

function sameValues(a: SafeAreaSnapshot, b: SafeAreaSnapshot): boolean {
  return (
    a.insets.top === b.insets.top &&
    a.insets.right === b.insets.right &&
    a.insets.bottom === b.insets.bottom &&
    a.insets.left === b.insets.left &&
    a.keyboardHeight === b.keyboardHeight &&
    a.edgeToEdge === b.edgeToEdge
  )
}

function readGlobalProps(): SafeAreaSnapshot | null {
  if (typeof lynx === 'undefined' || !lynx?.__globalProps) return null
  const raw = lynx.__globalProps[GLOBAL_PROPS_KEY] as
    | Partial<SafeAreaWire>
    | undefined
  if (!raw || typeof raw.generation !== 'number') return null
  return fromWire(raw, 'globalProps')
}

function readNative(): SafeAreaSnapshot | null {
  const native = tryGetNativeModule()
  if (!native) return null
  try {
    return fromWire(native.getSnapshot(), 'native')
  } catch {
    return null
  }
}

/**
 * Принять снимок. Возвращает true, если слушателей надо будить.
 *
 * Два правила:
 * 1. generation монотонен и общий для всех каналов: старое событие, догнавшее
 *    нас после свежих globalProps, не откатывает состояние.
 * 2. Дедупликация ПО ЗНАЧЕНИЯМ, а не по generation: на устройстве второй пуш
 *    с теми же числами (pre-draw после postStarted) иначе порождает лишний
 *    ре-рендер. Ссылка `cached` при этом не меняется, что нужно
 *    useSyncExternalStore: getSnapshot обязан быть стабильным без изменений.
 */
export function adopt(next: SafeAreaSnapshot | null): boolean {
  if (!next) return false
  if (next.generation < cached.generation) return false
  if (next.generation === cached.generation && next.source === cached.source) {
    return false
  }
  if (sameValues(cached, next)) {
    if (next.generation !== cached.generation) {
      cached = { ...cached, generation: next.generation, source: next.source }
    }
    return false
  }
  cached = next
  for (const l of listeners) l(next)
  return true
}

export function getSafeAreaSnapshot(): SafeAreaSnapshot {
  const next = readGlobalProps() ?? readNative()
  if (next) {
    adopt(next)
    return cached
  }
  if (!warned && cached.generation < 0) {
    warned = true
    console.warn(
      '@lynx-lab/edge-to-edge: insets are unavailable, returning zeros.\n' +
        '  Main thread (MTS): NativeModules does not exist here, which is expected. ' +
        'Read insets from lynx.__globalProps via useSafeAreaInsets from ' +
        '"@lynx-lab/edge-to-edge/react".\n' +
        '  Android: if the background thread (BTS) also sees zeros, the ' +
        'ContentProvider did not run. Check `adb logcat | grep LynxEdgeToEdge` ' +
        'and that the provider is present in the merged manifest.\n' +
        '  iOS: check that Pods/ contains a generated Lynx autolink registry ' +
        'naming LynxEdgeToEdgeModule.'
    )
  }
  return cached
}

export function getSafeAreaInsets(): EdgeInsets {
  return getSafeAreaSnapshot().insets
}

export function getKeyboardHeight(): number {
  return getSafeAreaSnapshot().keyboardHeight
}

/**
 * Подписка на дельты. Слушатель сразу получает текущее значение: событие,
 * отправленное до готовности рантайма, дропается, поэтому первое значение
 * всегда читается, а не ожидается. На MTS подписка молча не привязывается,
 * там нет GlobalEventEmitter, и там же нет ре-рендеров.
 */
export function subscribeSafeArea(listener: Listener): () => void {
  // Сначала читаем, потом подписываем: иначе первое чтение само разбудит
  // нового слушателя через adopt, и он получит начальное значение дважды.
  const current = getSafeAreaSnapshot()
  listeners.add(listener)
  bindEmitter()
  listener(current)
  return () => {
    listeners.delete(listener)
  }
}

function bindEmitter(): void {
  if (emitterBound) return
  if (typeof lynx === 'undefined' || typeof lynx?.getJSModule !== 'function') {
    return
  }
  const emitter = lynx.getJSModule('GlobalEventEmitter')
  if (!emitter) return
  emitterBound = true
  // Канал A: globalProps обновились, перечитываем ключ.
  emitter.addListener(GLOBAL_PROPS_CHANGED_EVENT, () => {
    adopt(readGlobalProps())
  })
  // Канал для нативных дельт (iOS): плоский wire первым аргументом.
  emitter.addListener(SAFE_AREA_EVENT, (...args: unknown[]) => {
    const wire = args[0] as Partial<SafeAreaWire> | undefined
    if (!wire || typeof wire.generation !== 'number') return
    adopt(fromWire(wire, 'native'))
  })
}

/** Догоняющий вызов для brownfield-хостов, где ContentProvider не отработал. */
export function refreshSafeArea(): Promise<SafeAreaSnapshot> {
  const native = tryGetNativeModule()
  if (!native) return Promise.resolve(getSafeAreaSnapshot())
  return new Promise((resolve) => {
    native.refresh((wire) => {
      adopt(fromWire(wire, 'native'))
      resolve(cached)
    })
  })
}

/**
 * Имена переменных выбраны так, чтобы миграция существующего CSS была
 * поиском-заменой `env(` → `var(--`. env(safe-area-inset-top) на Android
 * всегда 0, var(--safe-area-inset-top) одинаков на обеих платформах и реактивен.
 */
export function safeAreaCssVarString(snapshot: SafeAreaSnapshot): string {
  const { top, right, bottom, left } = snapshot.insets
  return (
    `--safe-area-inset-top:${top}px;` +
    `--safe-area-inset-right:${right}px;` +
    `--safe-area-inset-bottom:${bottom}px;` +
    `--safe-area-inset-left:${left}px;` +
    `--safe-area-keyboard-height:${snapshot.keyboardHeight}px;`
  )
}

/** Только для тестов: сбросить модульное состояние. Из index не экспортируется. */
export function resetCoreForTests(): void {
  listeners.clear()
  cached = FALLBACK
  warned = false
  emitterBound = false
}
