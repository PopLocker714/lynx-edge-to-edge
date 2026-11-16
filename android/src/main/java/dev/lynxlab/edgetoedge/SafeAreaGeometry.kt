package dev.lynxlab.edgetoedge

internal fun darkIcons(
    style: String,
    night: Boolean,
): Boolean =
    when (style) {
        "light" -> false
        "dark" -> true
        "inverted" -> night
        else -> !night
    }

/** Window-relative obstruction intersected with the particular LynxView, in dp. */
internal fun relativeSnapshot(
    window: Snapshot,
    x: Float,
    y: Float,
    width: Float,
    height: Float,
    windowWidth: Float,
    windowHeight: Float,
): Snapshot =
    window.copy(
        top = (window.top - y).coerceIn(0f, height),
        right = (x + width - windowWidth + window.right).coerceIn(0f, width),
        bottom = (y + height - windowHeight + window.bottom).coerceIn(0f, height),
        left = (window.left - x).coerceIn(0f, width),
        keyboardHeight = (y + height - windowHeight + window.keyboardHeight).coerceIn(0f, height),
    )
