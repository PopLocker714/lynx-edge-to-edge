package dev.lynxlab.edgetoedge

import com.lynx.tasm.LynxView
import org.junit.Assert.assertEquals
import org.junit.Test

class SafeAreaStoreTest {
    @Test
    fun snapshotsAndDeliveryStayWithTheirOwner() {
        val first = LynxView()
        val second = LynxView()
        assertEquals(0, SafeAreaStore.snapshotFor(first).generation)
        assertEquals(0, SafeAreaStore.snapshotFor(null).generation)
        SafeAreaStore.publish(first, Snapshot(top = 24f, bottom = 34f))
        SafeAreaStore.publish(second, Snapshot(top = 0f, bottom = 0f))
        assertEquals(24f, SafeAreaStore.snapshotFor(first).top)
        assertEquals(0f, SafeAreaStore.snapshotFor(second).top)
        assertEquals(1, first.updates.size)
        assertEquals(1, second.updates.size)
        SafeAreaStore.publish(second, Snapshot(top = 8f))
        assertEquals(1, first.updates.size)
        assertEquals(2, second.updates.size)
        assertEquals(1, SafeAreaStore.snapshotFor(first).generation)
        assertEquals(2, SafeAreaStore.snapshotFor(second).generation)
    }

    @Test
    fun lateOwnerNeverInheritsWarmSnapshotAndIdenticalValuesDoNotRedeliver() {
        val old = LynxView()
        repeat(300) { SafeAreaStore.publish(old, Snapshot(top = it.toFloat())) }
        val late = LynxView()
        assertEquals(0, SafeAreaStore.snapshotFor(late).generation)
        SafeAreaStore.publish(late, Snapshot(bottom = 10f))
        SafeAreaStore.publish(late, Snapshot(bottom = 10f))
        assertEquals(299f, SafeAreaStore.snapshotFor(old).top)
        assertEquals(0f, SafeAreaStore.snapshotFor(late).top)
        assertEquals(1, late.updates.size)
    }
}
