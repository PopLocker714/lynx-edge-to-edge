package dev.lynxlab.edgetoedge

import org.junit.Assert.assertEquals
import org.junit.Test

class SafeAreaGeometryTest {
    @Test
    fun barStylesFollowBothThemes() {
        for (night in listOf(false, true)) {
            assertEquals(!night, darkIcons("auto", night))
            assertEquals(night, darkIcons("inverted", night))
            assertEquals(false, darkIcons("light", night))
            assertEquals(true, darkIcons("dark", night))
        }
    }

    @Test
    fun eachViewGetsItsOwnOverlap() {
        val window = Snapshot(top = 24f, bottom = 34f, keyboardHeight = 300f)
        val full = relativeSnapshot(window, 0f, 0f, 400f, 800f, 400f, 800f)
        val inset = relativeSnapshot(window, 20f, 50f, 300f, 400f, 400f, 800f)
        assertEquals(24f, full.top)
        assertEquals(34f, full.bottom)
        assertEquals(300f, full.keyboardHeight)
        assertEquals(0f, inset.top)
        assertEquals(0f, inset.bottom)
        assertEquals(0f, inset.keyboardHeight)
    }

    @Test
    fun overlapIsClampedToViewBounds() {
        val window = Snapshot(top = 50f, left = 60f, keyboardHeight = 300f)
        val tiny = relativeSnapshot(window, 0f, 0f, 20f, 10f, 400f, 800f)
        assertEquals(10f, tiny.top)
        assertEquals(20f, tiny.left)
        assertEquals(0f, tiny.keyboardHeight)
    }
}
