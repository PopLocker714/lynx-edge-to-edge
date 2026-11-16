package dev.lynxlab.edgetoedge

import android.app.Activity
import android.app.Application
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowInsets
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.lynx.tasm.LynxView
import java.util.WeakHashMap

/**
 * Включение окна плюс чтение инсетов.
 *
 * Порядок доставки на холодном старте (спайк S6 в lynx-lab, Pixel 9 и эмулятор):
 *  - onActivityCreated: applyWindow, вешаем pre-draw
 *  - onActivityPostStarted: LynxView впервые в дереве (Sparkling материализует
 *    фрагмент в onStart). Окно ещё не attach'нуто, getRootWindowInsets == null,
 *    поэтому инсеты берём из WindowManager.currentWindowMetrics (API 30+).
 *    Пуш отсюда становится init_global_props_, то есть виден на первом кадре
 *  - первый pre-draw: окно attach'нуто, перечитываем точные инсеты, публикуем
 *    только если изменились
 *  - onActivityResumed: перенакатываем окно (OEM сбрасывают его при возврате)
 */
object EdgeToEdge {
    // Скримы взяты 1-в-1 из androidx EdgeToEdge.kt / RN WindowUtil.kt.
    private const val LIGHT_NAV_SCRIM = 0xE6FFFFFF.toInt()
    private const val DARK_NAV_SCRIM = 0x801B1B1B.toInt()
    private const val SCAN_BUDGET_FRAMES = 240

    private var installed = false
    private val hooks = WeakHashMap<Activity, ViewTreeObserver.OnPreDrawListener>()
    private val scanBudget = WeakHashMap<Activity, Int>()

    private data class Bars(
        var statusStyle: String = "auto",
        var navigationStyle: String = "auto",
        var statusHidden: Boolean = false,
        var navigationHidden: Boolean = false,
    )

    private val bars = WeakHashMap<Activity, Bars>()
    private val views = WeakHashMap<Activity, MutableSet<LynxView>>()

    fun setStyle(
        activity: Activity,
        status: String,
        navigation: String,
    ) {
        val state = bars.getOrPut(activity) { Bars() }
        state.statusStyle = status
        state.navigationStyle = navigation
        applyBars(activity)
    }

    fun setHidden(
        activity: Activity,
        status: Boolean,
        navigation: Boolean,
    ) {
        val state = bars.getOrPut(activity) { Bars() }
        state.statusHidden = status
        state.navigationHidden = navigation
        applyBars(activity)
    }

    fun install(app: Application) {
        if (installed) return
        installed = true
        app.registerActivityLifecycleCallbacks(
            object : Application.ActivityLifecycleCallbacks {
                override fun onActivityCreated(
                    a: Activity,
                    s: Bundle?,
                ) = attach(a)

                override fun onActivityPostStarted(a: Activity) = scan(a, force = true)

                // OEM-прошивки и сторонние библиотеки сбрасывают окно при возврате из
                // фона (zoontek #45/#57/#66). Перенакатываем каждый resume.
                override fun onActivityResumed(a: Activity) {
                    applyWindow(a)
                    scanBudget[a] = SCAN_BUDGET_FRAMES
                    scan(a, force = true)
                }

                override fun onActivityDestroyed(a: Activity) = detach(a)

                override fun onActivityStarted(a: Activity) = Unit

                override fun onActivityPaused(a: Activity) = Unit

                override fun onActivityStopped(a: Activity) = Unit

                override fun onActivitySaveInstanceState(
                    a: Activity,
                    o: Bundle,
                ) = Unit
            },
        )
    }

    /** Диспатчится Application'ом на UI-потоке из Activity.onCreate. */
    fun attach(activity: Activity) {
        applyWindow(activity)
        if (hooks.containsKey(activity)) return
        val decor = activity.window?.decorView ?: return
        // OnPreDrawListener, а не setOnApplyWindowInsetsListener: у View РОВНО ОДИН
        // слот слушателя, второй пакет молча выигрывает. У ViewTreeObserver список.
        val hook =
            ViewTreeObserver.OnPreDrawListener {
                scan(activity, force = false)
                true
            }
        decor.viewTreeObserver.addOnPreDrawListener(hook)
        hooks[activity] = hook
        scanBudget[activity] = SCAN_BUDGET_FRAMES
    }

    private fun detach(activity: Activity) {
        hooks.remove(activity)?.let { hook ->
            activity.window
                ?.decorView
                ?.viewTreeObserver
                ?.takeIf { it.isAlive }
                ?.removeOnPreDrawListener(hook)
        }
        scanBudget.remove(activity)
        views.remove(activity)
        bars.remove(activity)
    }

    /**
     * targetSdk <= 34: это и есть продукт.
     * targetSdk >= 35: PhoneWindow.setDecorFitsSystemWindows открывается строкой
     *   `if (mEdgeToEdgeEnforced) { return; }`, всё ниже вырождается в no-op.
     *   Ветвления не нужно, гоняем безусловно.
     */
    fun applyWindow(activity: Activity) {
        val window = activity.window ?: return
        WindowCompat.setDecorFitsSystemWindows(window, false)

        @Suppress("DEPRECATION")
        window.statusBarColor = Color.TRANSPARENT

        @Suppress("DEPRECATION")
        window.navigationBarColor =
            when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> Color.TRANSPARENT
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1 &&
                    !isNight(
                        activity,
                    )
                -> LIGHT_NAV_SCRIM
                else -> DARK_NAV_SCRIM
            }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Required below target-35 enforcement; deprecated API remains effective there.
            @Suppress("DEPRECATION")
            window.isStatusBarContrastEnforced = false
            // Контраст нав-бара НЕ трогаем: полупрозрачный скрим под трёхкнопочной
            // навигацией это документированный дефолт Android 15, а не баг.
        }

        // Единственное, чего нет в голом setDecorFitsSystemWindows(false), и что
        // реально чинит альбомную ориентацию с вырезом: иначе режим DEFAULT и
        // окно летербоксится от выреза.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val attrs = window.attributes
            attrs.layoutInDisplayCutoutMode =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                } else {
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                }
            window.attributes = attrs
        }
        applyBars(activity)
    }

    /** Иконки баров и их видимость. Под enforcement на 35+ это продолжает работать. */
    fun applyBars(activity: Activity) {
        val window = activity.window ?: return
        val state = bars.getOrPut(activity) { Bars() }
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.isAppearanceLightStatusBars = darkIcons(state.statusStyle, isNight(activity))
        controller.isAppearanceLightNavigationBars =
            darkIcons(state.navigationStyle, isNight(activity))
        if (state.statusHidden) {
            controller.hide(WindowInsetsCompat.Type.statusBars())
        } else {
            controller.show(WindowInsetsCompat.Type.statusBars())
        }
        if (state.navigationHidden) {
            controller.hide(WindowInsetsCompat.Type.navigationBars())
        } else {
            controller.show(WindowInsetsCompat.Type.navigationBars())
        }
    }

    fun isNight(activity: Activity): Boolean =
        (activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

    /**
     * Снимок инсетов. Первый источник это окно (после attach), второй это
     * WindowMetrics (до attach, API 30+), иначе null и кеш остаётся как был.
     *
     * systemBars() = STATUS_BARS | NAVIGATION_BARS | CAPTION_BAR | SYSTEM_OVERLAYS,
     * «but not ime()». displayCutout нужен потому, что при
     * LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS в альбомной вырез сбоку, где никакого
     * бара нет. tappableElement() ЗАПРЕЩЁН: SystemUI ставит его в Insets.NONE
     * при config_navBarTapThrough, то есть 0 там, где iOS отдаёт 34pt.
     */
    fun readSnapshot(activity: Activity): Snapshot? {
        val density = activity.resources.displayMetrics.density
        val decor = activity.window?.decorView
        val root = decor?.let { ViewCompat.getRootWindowInsets(it) }
        if (root != null) {
            val bars =
                root.getInsets(
                    WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
                )
            // ime() отдельным полем, как в iOS. Ниже API 30 WindowInsetsCompat
            // эмулирует ime() сравнением со stableInset, а под edge-to-edge окно
            // перестало ресайзиться, и эмуляция врёт. Значит 0.
            val ime =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    root.getInsets(WindowInsetsCompat.Type.ime()).bottom
                } else {
                    0
                }
            return Snapshot(
                top = bars.top / density,
                right = bars.right / density,
                bottom = bars.bottom / density,
                left = bars.left / density,
                keyboardHeight = ime / density,
                edgeToEdge = true,
            )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val metrics =
                runCatching {
                    activity.windowManager.currentWindowMetrics.windowInsets
                        .getInsets(
                            WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout(),
                        )
                }.getOrNull() ?: return null
            return Snapshot(
                top = metrics.top / density,
                right = metrics.right / density,
                bottom = metrics.bottom / density,
                left = metrics.left / density,
                keyboardHeight = 0f,
                edgeToEdge = true,
            )
        }
        return null
    }

    /** Module owner registration also covers preloaded views outside decor discovery. */
    fun observe(
        activity: Activity,
        view: LynxView,
    ) {
        views
            .getOrPut(activity) {
                java.util.Collections.newSetFromMap(WeakHashMap<LynxView, Boolean>())
            }.add(view)
    }

    fun scan(
        activity: Activity,
        force: Boolean,
    ) {
        val decor = activity.window?.decorView ?: return
        val windowSnapshot = readSnapshot(activity) ?: return
        val registered =
            views.getOrPut(activity) {
                java.util.Collections.newSetFromMap(WeakHashMap<LynxView, Boolean>())
            }
        val budget = scanBudget[activity] ?: 0
        if (force || budget > 0) collectLynxViews(decor, registered)
        if (budget > 0) scanBudget[activity] = budget - 1
        val density = activity.resources.displayMetrics.density
        for (view in registered.toList()) {
            // A view moved to another host is owned by that host's next scan.
            if (com.lynx.tasm.utils.ContextUtils
                    .getActivity(view.context) !== activity
            ) {
                registered.remove(view)
                continue
            }
            val next =
                if (view.width > 0 && view.height > 0 && view.isAttachedToWindow) {
                    val position = IntArray(2)
                    view.getLocationInWindow(position)
                    relativeSnapshot(
                        windowSnapshot,
                        position[0] / density,
                        position[1] / density,
                        view.width / density,
                        view.height / density,
                        decor.width / density,
                        decor.height / density,
                    )
                } else {
                    // Sparkling's full-window initial layout: owner window seed before first attach.
                    // Embedded hosts obtain precise values after layout; no other window is consulted.
                    windowSnapshot
                }
            SafeAreaStore.publish(view, next)
        }
    }

    private fun collectLynxViews(
        root: View,
        registered: MutableSet<LynxView>,
    ) {
        if (root is LynxView) {
            registered.add(root)
            return
        }
        if (root is ViewGroup) {
            for (i in 0 until root.childCount) collectLynxViews(root.getChildAt(i), registered)
        }
    }
}
