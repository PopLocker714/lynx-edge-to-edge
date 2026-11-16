package dev.lynxlab.edgetoedge

import androidx.core.view.ViewCompat
import com.lynx.jsbridge.LynxContextModule
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxNativeModule
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.utils.ContextUtils
import com.lynx.tasm.utils.UIThreadUtils

/**
 * Только читатель кеша и командный канал. Окно из модуля НЕ трогаем без хопа:
 * @LynxMethod исполняются инлайн на JS-потоке, а setDecorFitsSystemWindows
 * уходит в ViewRootImpl.requestFitSystemWindows(), первая строка которого
 * checkThread().
 *
 * Конструктор (LynxContext) обязателен: CommonModuleCreator проверяет
 * LynxContextModule.class.isAssignableFrom(moduleClass) и зовёт ровно его.
 *
 * Ручная регистрация, если хост без autolink:
 *   LynxEnv.inst().registerModule("LynxEdgeToEdgeModule", LynxEdgeToEdgeModule::class.java)
 */
@LynxNativeModule(name = "LynxEdgeToEdgeModule")
class LynxEdgeToEdgeModule(
    context: LynxContext,
) : LynxContextModule(context) {
    init {
        // Brownfield-хост, где ContentProvider не отработал: регистрируем LynxView
        // отсюда, и globalProps начинают приезжать хотя бы после первого обращения JS.
        context.lynxView?.let(SafeAreaStore::registerView)
    }

    /**
     * Синхронный, потому что читает кеш, прогретый провайдером ещё до
     * Application.onCreate. На UI-поток идти не надо, блокирующего хопа
     * в AAR 4.0.1 и нет. Возврат JavaOnlyMap в whitelist LynxMethodWrapper.
     */
    @LynxMethod
    fun getSnapshot(): JavaOnlyMap = SafeAreaStore.snapshot.toJavaOnlyMap()

    /** Холодный путь. Callback, а не возврат: блокирующего хопа не существует. */
    @LynxMethod
    fun refresh(callback: Callback) {
        // Activity никогда не кешировать: LynxContext это MutableContextWrapper,
        // база переуказывается при переattach. Перерешаем каждый раз.
        val activity = ContextUtils.getActivity(mLynxContext)
        if (activity == null) {
            callback.invoke(SafeAreaStore.snapshot.toJavaOnlyMap())
            return
        }
        UIThreadUtils.runOnUiThread {
            EdgeToEdge.applyWindow(activity)
            ViewCompat.requestApplyInsets(activity.window.decorView)
            EdgeToEdge.scan(activity, force = true)
            callback.invoke(SafeAreaStore.snapshot.toJavaOnlyMap())
        }
    }

    /** style: "auto" | "inverted" | "light" | "dark". Строки, не enum. */
    @LynxMethod
    fun setSystemBarStyle(
        statusBar: String,
        navigationBar: String,
    ) {
        val activity = ContextUtils.getActivity(mLynxContext) ?: return
        UIThreadUtils.runOnUiThread {
            val night = EdgeToEdge.isNight(activity)

            // isAppearanceLight*Bars == true означает ТЁМНЫЕ иконки на светлом баре.
            fun resolve(style: String): Boolean =
                when (style) {
                    "light" -> false // светлое содержимое → светлые иконки
                    "dark" -> true
                    "inverted" -> !night
                    else -> night // "auto"
                }
            EdgeToEdge.applyBars(activity, resolve(statusBar), resolve(navigationBar))
        }
    }

    @LynxMethod
    fun setSystemBarHidden(
        statusBar: Boolean,
        navigationBar: Boolean,
    ) {
        val activity = ContextUtils.getActivity(mLynxContext) ?: return
        UIThreadUtils.runOnUiThread {
            EdgeToEdge.statusBarHidden = statusBar
            EdgeToEdge.navigationBarHidden = navigationBar
            EdgeToEdge.applyBars(activity)
        }
    }
}
