/**
 * Хуки и компоненты. Отдельная точка входа, чтобы ядро не тянуло
 * @lynx-js/react (он optional peer).
 *
 * Без useGlobalProps намеренно: его нет в ReactLynx 0.116, который везёт
 * rc-шаблон Sparkling. Реактивность даёт core: он слушает
 * `onGlobalPropsChanged` на GlobalEventEmitter (есть с 0.116) и будит
 * useSyncExternalStore. На MTS подписки нет и ре-рендеров тоже, там
 * значение читается синхронно из lynx.__globalProps на первом кадре.
 */
import type { ReactNode } from '@lynx-js/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from '@lynx-js/react'
import { getSafeAreaSnapshot, safeAreaCssVarString, subscribeSafeArea } from '../core.js'
import { popStackEntry, pushStackEntry, replaceStackEntry } from '../system-bars.js'
import type { SystemBarsProps } from '../system-bars.js'
import type { Edge, EdgeInsets, SafeAreaMode, SafeAreaSnapshot } from '../types.js'

export function useSafeAreaSnapshot(): SafeAreaSnapshot {
  const subscribe = useCallback(
    (onChange: () => void) => subscribeSafeArea(() => onChange()),
    []
  )
  return useSyncExternalStore(subscribe, getSafeAreaSnapshot, getSafeAreaSnapshot)
}

export function useSafeAreaInsets(): EdgeInsets {
  return useSafeAreaSnapshot().insets
}

export function useKeyboardHeight(): number {
  return useSafeAreaSnapshot().keyboardHeight
}

export interface SafeAreaProviderProps {
  children?: ReactNode
  className?: string
}

/**
 * Один <view>, который вешает CSS-переменные. Всё поддерево может писать
 * padding-top: var(--safe-area-inset-top). Переменные наследуются вниз,
 * инлайн-объявление поддерживается с Lynx 3.6.
 */
export function SafeAreaProvider(props: SafeAreaProviderProps) {
  const snapshot = useSafeAreaSnapshot()
  const style = useMemo(
    () => `${safeAreaCssVarString(snapshot)}flex:1;`,
    [snapshot]
  )
  return (
    <view className={props.className} style={style}>
      {props.children}
    </view>
  )
}

export interface SafeAreaViewProps {
  children?: ReactNode
  className?: string
  style?: string
  /** По умолчанию все четыре. Горизонтальные важны: альбомный вырез и iPad. */
  edges?: readonly Edge[]
  /** 'padding' (по умолчанию) или 'margin'. */
  mode?: SafeAreaMode
  /** Добавлять ли высоту клавиатуры к нижнему инсету. По умолчанию нет, как в iOS. */
  avoidKeyboard?: boolean
}

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left']

export function safeAreaViewStyle(
  snapshot: SafeAreaSnapshot,
  props: Pick<SafeAreaViewProps, 'edges' | 'mode' | 'avoidKeyboard' | 'style'>
): string {
  const { insets, keyboardHeight } = snapshot
  const edges = props.edges ?? ALL_EDGES
  const prop = props.mode === 'margin' ? 'margin' : 'padding'
  const bottom =
    props.avoidKeyboard === true
      ? Math.max(insets.bottom, keyboardHeight)
      : insets.bottom
  let style = ''
  if (edges.includes('top')) style += `${prop}-top:${insets.top}px;`
  if (edges.includes('right')) style += `${prop}-right:${insets.right}px;`
  if (edges.includes('bottom')) style += `${prop}-bottom:${bottom}px;`
  if (edges.includes('left')) style += `${prop}-left:${insets.left}px;`
  return style + (props.style ?? '')
}

export function SafeAreaView(props: SafeAreaViewProps) {
  const snapshot = useSafeAreaSnapshot()
  const style = safeAreaViewStyle(snapshot, props)
  return (
    <view className={props.className} style={style}>
      {props.children}
    </view>
  )
}

/** Компонент ничего не рендерит; вся работа в стеке записей. */
export function SystemBars(props: SystemBarsProps) {
  const [entry, setEntry] = useState(() => pushStackEntry(props))
  useEffect(() => {
    setEntry((current) => replaceStackEntry(current, props))
  }, [props.style, props.hidden])
  useEffect(() => () => popStackEntry(entry), [entry])
  return null
}
