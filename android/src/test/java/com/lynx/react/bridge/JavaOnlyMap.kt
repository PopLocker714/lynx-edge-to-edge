package com.lynx.react.bridge

/** Exact methods used by Snapshot; only the JVM test runtime sees this adapter. */
class JavaOnlyMap : HashMap<String, Any>() {
    fun putDouble(
        key: String,
        value: Double,
    ) {
        put(key, value)
    }

    fun putBoolean(
        key: String,
        value: Boolean,
    ) {
        put(key, value)
    }
}
