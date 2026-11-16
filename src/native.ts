/**
 * Шов к нативу. Тот же паттерн, что в @lynx-lab/app-lifecycle.
 *
 * `NativeModules` это `declare global` из @lynx-js/types: в тарболе пакета
 * нет ни одного `.js`, поэтому импортировать его нельзя, будет падение в
 * рантайме. Объявляем локально и никогда не импортируем.
 */
declare const NativeModules: Record<string, unknown> | undefined

/**
 * Проволочная форма ПЛОСКАЯ. Вложенных объектов через мост не гоняем:
 * возврат JavaOnlyMap подтверждён в whitelist LynxMethodWrapper, а лишний
 * слой это лишний риск.
 */
export interface SafeAreaWire {
    top: number
    right: number
    bottom: number
    left: number
    keyboardHeight: number
    generation: number
    edgeToEdge: boolean
}

export interface LynxEdgeToEdgeNative {
    /** Синхронно. Читает тёплый кеш, окна не трогает, на UI-поток не ходит. */
    getSnapshot(): SafeAreaWire
    /** Холодный путь для brownfield-хостов, где не отработал ContentProvider. */
    refresh(callback: (wire: SafeAreaWire) => void): void
    /** 'auto' | 'inverted' | 'light' | 'dark'. На iOS v1 это no-op. */
    setSystemBarStyle(statusBar: string, navigationBar: string): void
    setSystemBarHidden(statusBar: boolean, navigationBar: boolean): void
}

export const MODULE_NAME = 'LynxEdgeToEdgeModule'

let injected: LynxEdgeToEdgeNative | null = null

/** Шов для тестов. `setNativeModule(null)` возвращает настоящий поиск. */
export function setNativeModule(module: LynxEdgeToEdgeNative | null): void {
    injected = module
}

/**
 * Возвращает null вместо броска: на главном потоке (MTS) модуля просто нет,
 * и это штатная ситуация, а не ошибка. Громкость решает вызывающий.
 */
export function tryGetNativeModule(): LynxEdgeToEdgeNative | null {
    if (injected) return injected
    if (typeof NativeModules === 'undefined' || NativeModules === null) return null
    const candidate = NativeModules[MODULE_NAME] as Partial<LynxEdgeToEdgeNative> | undefined
    if (!candidate || typeof candidate.getSnapshot !== 'function') return null
    return candidate as LynxEdgeToEdgeNative
}
