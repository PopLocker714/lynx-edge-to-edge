// Версии плагинов намеренно отсутствуют. Autolink-библиотека собирается как
// Gradle-сабпроект хостового приложения (LynxLibrarySettingsPlugin делает
// settings.include(projectPath) + projectDir = androidDir), поэтому версии
// задаёт сборка хоста. Для standalone-проверки их подставляет ../android-check.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    // НЕ ОПЦИОНАЛЬНО. LynxLibraryBuildPlugin прокидывает аргумент процессора
    // -Alynx.library.packageName только внутри
    //   project.plugins.withId('kotlin-kapt') { ... }
    // и сам плагин никогда не применяет. Без kapt здесь
    // LynxLibraryProcessor.getProviderPackageName() вернёт "" и процессор
    // выйдет, не записав ни одного файла. Без ошибки. (T7 в lynx-lab)
    id("org.jetbrains.kotlin.kapt")
}

android {
    namespace = "dev.lynxlab.edgetoedge"
    compileSdk = 35

    defaultConfig {
        // Нижнюю границу задаёт Lynx. WindowInsetsCompat эмулирует всё ниже 30.
        minSdk = 23
        consumerProguardFiles("consumer-rules.pro")
    }

    // Java 11, не 17: шаблон Sparkling везёт Java 11 и Kotlin 1.8.10, и
    // библиотека с bytecode 61 туда не встаёт (T29 в lynx-lab).
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    // compileOnly, не implementation: Lynx поставляет хост, а отгрузка его
    // как implementation рискует duplicate-class.
    compileOnly("org.lynxsdk.lynx:lynx:4.0.1")

    // Сгенерированный LynxLibraryProviderImpl помечается @androidx.annotation.Keep.
    // androidx.annotation приезжает транзитивно из androidx.core (api), явный
    // compileOnly другой версии ломает consistent resolution AGP:
    // "Cannot find a version of androidx.annotation that satisfies {strictly 1.6.0}".

    // implementation, не compileOnly: WindowCompat/WindowInsetsCompat нужны в
    // рантайме. 1.13.1 требует minCompileSdk 34, это потолок при compileSdk 34
    // у хоста (1.15.0 требует 35). androidx.activity НЕ берём: appcompat 1.6.1
    // тянет activity 1.6.0 без enableEdgeToEdge(), а 1.10.x требует compileSdk 35.
    // Ручной путь всё равно обязателен для не-ComponentActivity хостов.
    implementation("androidx.core:core:1.13.1")

    kapt("org.lynxsdk.lynx:lynx-processor:4.0.1")
}
