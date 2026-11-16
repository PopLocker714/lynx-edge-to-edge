/**
 * Общие типы. Никаких enum: через мост ходят только number, string, boolean
 * и плоские объекты. «Перечисления» это union строковых литералов, они
 * стираются в компиляции и на мосту становятся обычной строкой.
 */

export interface EdgeInsets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export type Edge = 'top' | 'right' | 'bottom' | 'left'
export type SafeAreaMode = 'padding' | 'margin'
export type SystemBarStyle = 'auto' | 'inverted' | 'light' | 'dark'

export interface SafeAreaSnapshot {
  /** Инсеты в dp (Android) / pt (iOS). Клавиатуру НЕ включают, как в iOS. */
  readonly insets: EdgeInsets
  /** Высота клавиатуры отдельным полем. Android: только API 30+, иначе 0. */
  readonly keyboardHeight: number
  /** Монотонный счётчик. Разрыв означает пропущенное событие: перечитай. */
  readonly generation: number
  /** Android: включён ли edge-to-edge. iOS: true как предположение о хосте, не измерение. */
  readonly edgeToEdge: boolean
  /** Откуда пришло значение. Диагностика, не логика. */
  readonly source: 'globalProps' | 'native' | 'fallback'
}

export const ZERO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 }
