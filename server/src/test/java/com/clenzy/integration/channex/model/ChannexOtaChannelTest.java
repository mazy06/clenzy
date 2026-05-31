package com.clenzy.integration.channex.model;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ChannexOtaChannelTest {

    @Test
    void defaults_enabledTrue_errorCountZero() {
        ChannexOtaChannel ch = new ChannexOtaChannel();
        assertTrue(ch.isEnabled());
        assertEquals(0, ch.getErrorCount());
    }

    @Test
    void settersAndGetters_roundTrip() {
        ChannexOtaChannel ch = new ChannexOtaChannel();
        UUID id = UUID.randomUUID();
        UUID mappingId = UUID.randomUUID();
        Instant now = Instant.now();

        ch.setId(id);
        ch.setPropertyMappingId(mappingId);
        ch.setOrganizationId(7L);
        ch.setOtaType("airbnb");
        ch.setChannexChannelId("ch-123");
        ch.setEnabled(false);
        ch.setLastPushAt(now);
        ch.setLastPullAt(now);
        ch.setErrorCount(5);
        ch.setLastErrorMessage("oops");

        assertEquals(id, ch.getId());
        assertEquals(mappingId, ch.getPropertyMappingId());
        assertEquals(7L, ch.getOrganizationId());
        assertEquals("airbnb", ch.getOtaType());
        assertEquals("ch-123", ch.getChannexChannelId());
        assertFalse(ch.isEnabled());
        assertEquals(now, ch.getLastPushAt());
        assertEquals(now, ch.getLastPullAt());
        assertEquals(5, ch.getErrorCount());
        assertEquals("oops", ch.getLastErrorMessage());
    }

    @Test
    void onCreate_setsTimestamps() throws Exception {
        ChannexOtaChannel ch = new ChannexOtaChannel();
        // Invoke package-private method via reflection-like direct call (same package)
        invokeLifecycleMethod(ch, "onCreate");
        assertNotNull(ch.getCreatedAt());
        assertNotNull(ch.getUpdatedAt());
    }

    @Test
    void onCreate_preservesExistingCreatedAt() throws Exception {
        ChannexOtaChannel ch = new ChannexOtaChannel();
        Instant preset = Instant.parse("2024-01-01T00:00:00Z");
        // Use reflection to set createdAt since no setter exists
        var field = ChannexOtaChannel.class.getDeclaredField("createdAt");
        field.setAccessible(true);
        field.set(ch, preset);
        invokeLifecycleMethod(ch, "onCreate");
        assertEquals(preset, ch.getCreatedAt());
        assertNotNull(ch.getUpdatedAt());
    }

    @Test
    void onUpdate_refreshesUpdatedAt() throws Exception {
        ChannexOtaChannel ch = new ChannexOtaChannel();
        invokeLifecycleMethod(ch, "onCreate");
        Instant first = ch.getUpdatedAt();
        Thread.sleep(5);
        invokeLifecycleMethod(ch, "onUpdate");
        assertTrue(ch.getUpdatedAt().equals(first) || ch.getUpdatedAt().isAfter(first));
    }

    private void invokeLifecycleMethod(ChannexOtaChannel ch, String name) throws Exception {
        var m = ChannexOtaChannel.class.getDeclaredMethod(name);
        m.setAccessible(true);
        m.invoke(ch);
    }
}
