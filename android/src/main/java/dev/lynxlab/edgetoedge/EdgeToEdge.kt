package dev.lynxlab.edgetoedge

import android.app.Activity
import android.app.Application
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
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
    private const val TAG = "LynxEdgeToEdge"

    // Скримы взяты 1-в-1 из androidx EdgeToEdge.kt / RN WindowUtil.kt.
    private const val LIGHT_NAV_SCRIM = 0xE6FFFFFF.toInt()
    private const val DARK_NAV_SCRIM = 0x801B1B1B.toInt()
    private const val SCAN_BUDGET_FRAMES = 240

    private var installed = false
    private val hooks = WeakHashMap<Activity, ViewTreeObserver.OnPreDrawListener>()
    private val scanBudget = WeakHashMap<Activity, Int>()

    @Volatile var statusBarHidden = false

    @Volatile var navigationBarHidden = false

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
    fun applyBars(
        activity: Activity,
        statusLight: Boolean? = null,
        navLight: Boolean? = null,
    ) {
        val window = activity.window ?: return
        // Контроллер конструируем заново каждый раз и перенакатываем hidden:
        // свежий WindowInsetsControllerCompat теряет состояние скрытия (zoontek #66).
        val c = WindowInsetsControllerCompat(window, window.decorView)
        c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        statusLight?.let { c.isAppearanceLightStatusBars = it }
        navLight?.let { c.isAppearanceLightNavigationBars = it }
        if (statusBarHidden) {
            c.hide(WindowInsetsCompat.Type.statusBars())
        } else {
            c.show(WindowInsetsCompat.Type.statusBars())
        }
        if (navigationBarHidden) {
            c.hide(WindowInsetsCompat.Type.navigationBars())
        } else {
            c.show(WindowInsetsCompat.Type.navigationBars())
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

    /**
     * Перечитать инсеты и найти LynxView. `force` для хуков жизненного цикла;
     * с pre-draw обход дерева идёт только при изменении значения или в бюджете
     * холодного старта, иначе обход каждый кадр навсегда.
     */
    fun scan(
        activity: Activity,
        force: Boolean,
    ) {
        val decor = activity.window?.decorView ?: return
        val changed = readSnapshot(activity)?.let(SafeAreaStore::publish) ?: false
        val budget = scanBudget[activity] ?: 0
        if (!force && !changed && budget <= 0) return
        if (budget > 0) scanBudget[activity] = budget - 1
        collectLynxViews(decor)
    }

    private fun collectLynxViews(root: View) {
        if (root is LynxView) {
            if (SafeAreaStore.registerView(root)) {
                Log.i(TAG, "LynxView registered, safeArea gen=${SafeAreaStore.snapshot.generation}")
            }
            return
        }
        if (root is ViewGroup) {
            for (i in 0 until root.childCount) collectLynxViews(root.getChildAt(i))
        }
    }
}
