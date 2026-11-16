package dev.lynxlab.edgetoedge

import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.tasm.LynxView
import java.util.Collections
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

/**
 * Процесс-глобальный тёплый кеш плюс доставка в LynxView.
 *
 * Единственный канал доставки это updateGlobalProps. Пуш, сделанный до старта
 * JS-рантайма, BTSRuntime::OnGlobalPropsUpdated кладёт в init_global_props_,
 * и он приезжает в JS как НАЧАЛЬНОЕ значение lynx.__globalProps.safeArea.
 * Пуш после старта приходит событием __NotifyGlobalPropsUpdated, ReactLynx
 * превращает его в Object.assign плюс onGlobalPropsChanged. Отдельного
 * sendGlobalEvent не нужно (D8 в lynx-lab).
 *
 * Мерж по верхнему ключу делает LynxTemplateRender на Java-стороне, поэтому
 * чужие globalProps (Sparkling кладёт statusBarHeight, theme и прочее)
 * не затираются (T33).
 */
object SafeAreaStore {
    const val GLOBAL_PROPS_KEY = "safeArea"

    @Volatile
    var snapshot: Snapshot = Snapshot()
        private set

    // Слабые ссылки: LynxView умирает вместе с Activity при повороте.
    private val views: MutableSet<LynxView> =
        Collections.newSetFromMap(WeakHashMap<LynxView, Boolean>())

    /** Вызывается с UI-потока. Новичок сразу получает текущий снимок. */
    @Synchronized
    fun registerView(view: LynxView): Boolean {
        if (!views.add(view)) return false
        if (snapshot.generation > 0) pushGlobalProps(view, snapshot)
        return true
    }

    /** Только с UI-потока. Возвращает true, если значение изменилось. */
    @Synchronized
    fun publish(next: Snapshot): Boolean {
        val current = snapshot
        if (current.generation > 0 && current.sameValues(next)) return false
        val stamped = next.copy(generation = current.generation + 1)
        snapshot = stamped
        for (view in views) pushGlobalProps(view, stamped)
        return true
    }

    private fun pushGlobalProps(
        view: LynxView,
        value: Snapshot,
    ) {
        runCatching { view.updateGlobalProps(mapOf(GLOBAL_PROPS_KEY to value.toPlainMap())) }
    }
}
