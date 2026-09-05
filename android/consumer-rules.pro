# Провайдер указан в манифесте, AGP держит его сам, но правило стоит копейки
# и страхует от агрессивных конфигураций R8 у хоста.
-keep class dev.lynxlab.edgetoedge.EdgeToEdgeInitProvider { <init>(); }
# Методы модуля находятся рефлексией: LynxModuleWrapper.findMethods() зовёт
# Class.getDeclaredMethods() и оставляет всё с @LynxMethod.
-keep class dev.lynxlab.edgetoedge.LynxEdgeToEdgeModule { <init>(...); }
-keepclassmembers class dev.lynxlab.edgetoedge.LynxEdgeToEdgeModule {
    @com.lynx.jsbridge.LynxMethod <methods>;
}
-keep class dev.lynxlab.edgetoedge.LynxLibraryProviderImpl { *; }
