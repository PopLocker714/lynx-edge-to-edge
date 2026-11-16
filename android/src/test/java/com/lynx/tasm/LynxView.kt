package com.lynx.tasm

/** JVM delivery adapter only; production compiles against the real Lynx artifact. */
class LynxView {
    val updates = mutableListOf<Map<String, Any>>()

    fun updateGlobalProps(props: Map<String, Any>) {
        updates.add(props)
    }
}
