/**
 * Стек записей, порт zoontek/react-native-edge-to-edge. Чистый JS поверх двух
 * нативных сеттеров. Побеждает последняя смонтированная запись. Батчинг
 * микротаской: setImmediate в Lynx нет.
 */
import { tryGetNativeModule } from './native.js'
import type { SystemBarStyle } from './types.js'

export interface SystemBarsEntry {
    statusBarStyle: SystemBarStyle | null
    navigationBarStyle: SystemBarStyle | null
    statusBarHidden: boolean | null
    navigationBarHidden: boolean | null
}

/** Android system-bar controls. Native setters are no-ops on iOS in v1. */
export interface SystemBarsProps {
    style?:
        | SystemBarStyle
        | { statusBar?: SystemBarStyle | undefined; navigationBar?: SystemBarStyle | undefined }
        | undefined
    hidden?:
        | boolean
        | { statusBar?: boolean | undefined; navigationBar?: boolean | undefined }
        | undefined
}

const stack: SystemBarsEntry[] = []
let flushScheduled = false
let lastPushed: SystemBarsEntry | null = null
let imperativeStyle: SystemBarsEntry | null = null
let imperativeHidden: SystemBarsEntry | null = null

export function createEntry(props: SystemBarsProps): SystemBarsEntry {
    const { style, hidden } = props
    const styleObj = typeof style === 'object' && style !== null ? style : null
    const hiddenObj = typeof hidden === 'object' && hidden !== null ? hidden : null
    return {
        statusBarStyle: styleObj
            ? (styleObj.statusBar ?? null)
            : ((style as SystemBarStyle | undefined) ?? null),
        navigationBarStyle: styleObj
            ? (styleObj.navigationBar ?? null)
            : ((style as SystemBarStyle | undefined) ?? null),
        statusBarHidden: hiddenObj
            ? (hiddenObj.statusBar ?? null)
            : ((hidden as boolean | undefined) ?? null),
        navigationBarHidden: hiddenObj
            ? (hiddenObj.navigationBar ?? null)
            : ((hidden as boolean | undefined) ?? null),
    }
}

export function mergeStack(entries: readonly SystemBarsEntry[]): SystemBarsEntry {
    const out: SystemBarsEntry = {
        statusBarStyle: 'auto',
        navigationBarStyle: 'auto',
        statusBarHidden: false,
        navigationBarHidden: false,
    }
    for (const entry of entries) {
        if (entry.statusBarStyle !== null) out.statusBarStyle = entry.statusBarStyle
        if (entry.navigationBarStyle !== null) out.navigationBarStyle = entry.navigationBarStyle
        if (entry.statusBarHidden !== null) out.statusBarHidden = entry.statusBarHidden
        if (entry.navigationBarHidden !== null) out.navigationBarHidden = entry.navigationBarHidden
    }
    return out
}

function sameEntry(a: SystemBarsEntry, b: SystemBarsEntry): boolean {
    return (
        a.statusBarStyle === b.statusBarStyle &&
        a.navigationBarStyle === b.navigationBarStyle &&
        a.statusBarHidden === b.statusBarHidden &&
        a.navigationBarHidden === b.navigationBarHidden
    )
}

function flush(): void {
    flushScheduled = false
    const native = tryGetNativeModule()
    if (!native) return
    const next = mergeStack(stack)
    if (lastPushed && sameEntry(lastPushed, next)) return
    lastPushed = next
    native.setSystemBarStyle(next.statusBarStyle ?? 'auto', next.navigationBarStyle ?? 'auto')
    native.setSystemBarHidden(next.statusBarHidden === true, next.navigationBarHidden === true)
}

function schedule(): void {
    if (flushScheduled) return
    flushScheduled = true
    Promise.resolve().then(flush)
}

export function pushStackEntry(props: SystemBarsProps): SystemBarsEntry {
    'background only'
    const entry = createEntry(props)
    stack.push(entry)
    schedule()
    return entry
}

export function popStackEntry(entry: SystemBarsEntry): void {
    'background only'
    const i = stack.indexOf(entry)
    if (i !== -1) stack.splice(i, 1)
    schedule()
}

export function replaceStackEntry(entry: SystemBarsEntry, props: SystemBarsProps): SystemBarsEntry {
    'background only'
    const next = createEntry(props)
    const i = stack.indexOf(entry)
    if (i !== -1) stack[i] = next
    else stack.push(next)
    schedule()
    return next
}

/** Sets Android system-bar icon style. No native effect on iOS in v1. */
export function setSystemBarStyle(style: SystemBarStyle): void {
    'background only'
    if (imperativeStyle) popStackEntry(imperativeStyle)
    imperativeStyle = pushStackEntry({ style })
}

/** Sets Android system-bar visibility. No native effect on iOS in v1. */
export function setSystemBarHidden(hidden: boolean): void {
    'background only'
    if (imperativeHidden) popStackEntry(imperativeHidden)
    imperativeHidden = pushStackEntry({ hidden })
}

/** Только для тестов. */
export function resetSystemBarsForTests(): void {
    stack.length = 0
    flushScheduled = false
    lastPushed = null
    imperativeStyle = null
    imperativeHidden = null
}
