package dev.lynxlab.edgetoedge

import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.tasm.LynxView
import java.util.WeakHashMap

/** Проволочная форма плоская, см. src/native.ts. Числа в dp. */
data class Snapshot(
    val top: Float = 0f,
    val right: Float = 0f,
    val bottom: Float = 0f,
    val left: Float = 0f,
    val keyboardHeight: Float = 0f,
    val edgeToEdge: Boolean = false,
    val generation: Int = 0,
) {
    fun sameValues(other: Snapshot): Boolean =
        top == other.top && right == other.right && bottom == other.bottom &&
            left == other.left && keyboardHeight == other.keyboardHeight &&
            edgeToEdge == other.edgeToEdge

    fun toJavaOnlyMap(): JavaOnlyMap =
        JavaOnlyMap().apply {
            putDouble("top", top.toDouble())
            putDouble("right", right.toDouble())
            putDouble("bottom", bottom.toDouble())
            putDouble("left", left.toDouble())
            putDouble("keyboardHeight", keyboardHeight.toDouble())
            putDouble("generation", generation.toDouble())
            putBoolean("edgeToEdge", edgeToEdge)
        }

    fun toPlainMap(): Map<String, Any> =
        mapOf(
            "top" to top.toDouble(),
            "right" to right.toDouble(),
            "bottom" to bottom.toDouble(),
            "left" to left.toDouble(),
            "keyboardHeight" to keyboardHeight.toDouble(),
            "generation" to generation.toDouble(),
            "edgeToEdge" to edgeToEdge,
        )
}

/** Per-view cache. UI owns writes/delivery; bridge threads only read immutable snapshots. */
object SafeAreaStore {
    const val GLOBAL_PROPS_KEY = "safeArea"
    private val snapshots = WeakHashMap<LynxView, Snapshot>()

    @Synchronized
    fun snapshotFor(view: LynxView?): Snapshot = snapshots[view] ?: Snapshot()

    fun publish(
        view: LynxView,
        next: Snapshot,
    ): Boolean {
        val stamped =
            synchronized(this) {
                val current = snapshots[view] ?: Snapshot()
                if (current.generation > 0 && current.sameValues(next)) return false
                next.copy(generation = current.generation + 1).also { snapshots[view] = it }
            }
        // Do not hold the cache lock while entering Lynx. Updates merge only our top-level key.
        view.updateGlobalProps(mapOf(GLOBAL_PROPS_KEY to stamped.toPlainMap()))
        return true
    }
}
