/**
 * Declaration merging: @lynx-js/react экспортирует пустой `interface GlobalProps`
 * именно под это (runtime/lib/core/globalProps.d.ts в 0.125.0). В 0.116 интерфейса
 * в этом модуле нет, и объявление просто создаёт его, ничего не ломая.
 * Импортируется за побочный эффект типов.
 */
import type { SafeAreaWire } from './native.js'

declare module '@lynx-js/react' {
  interface GlobalProps {
    safeArea?: SafeAreaWire
  }
}
