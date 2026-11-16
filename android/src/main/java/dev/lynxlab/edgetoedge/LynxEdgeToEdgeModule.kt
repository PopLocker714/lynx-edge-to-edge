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
        UIThreadUtils.runOnUiThread { attachHost() }
    }

    private fun attachHost() {
        val activity = ContextUtils.getActivity(mLynxContext) ?: return
        EdgeToEdge.install(activity.application)
        EdgeToEdge.attach(activity)
        EdgeToEdge.scan(activity, force = true)
    }

    /**
     * Синхронный, потому что читает кеш, прогретый провайдером ещё до
     * Application.onCreate. На UI-поток идти не надо, блокирующего хопа
     * в AAR 4.0.1 и нет. Возврат JavaOnlyMap в whitelist LynxMethodWrapper.
     */
    @LynxMethod
    fun getSnapshot(): JavaOnlyMap =
        SafeAreaStore.snapshotFor(mLynxContext.lynxView).toJavaOnlyMap()

    /** Холодный путь. Callback, а не возврат: блокирующего хопа не существует. */
    @LynxMethod
    fun refresh(callback: Callback) {
        UIThreadUtils.runOnUiThread {
            attachHost()
            ContextUtils.getActivity(mLynxContext)?.window?.decorView?.let {
                ViewCompat.requestApplyInsets(it)
            }
            callback.invoke(SafeAreaStore.snapshotFor(mLynxContext.lynxView).toJavaOnlyMap())
        }
    }

    /** style: "auto" | "inverted" | "light" | "dark". Строки, не enum. */
    @LynxMethod
    fun setSystemBarStyle(
        statusBar: String,
        navigationBar: String,
    ) {
        UIThreadUtils.runOnUiThread {
            val activity = ContextUtils.getActivity(mLynxContext) ?: return@runOnUiThread
            EdgeToEdge.setStyle(activity, statusBar, navigationBar)
        }
    }

    @LynxMethod
    fun setSystemBarHidden(
        statusBar: Boolean,
        navigationBar: Boolean,
    ) {
        UIThreadUtils.runOnUiThread {
            val activity = ContextUtils.getActivity(mLynxContext) ?: return@runOnUiThread
            EdgeToEdge.setHidden(activity, statusBar, navigationBar)
        }
    }
}
