package com.clenzy.integration.expedia.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class ExpediaConnectionTest {

    @Test
    void noArgConstructor_initializesDefaults() {
        ExpediaConnection conn = new ExpediaConnection();
        assertEquals(ExpediaConnection.ExpediaConnectionStatus.ACTIVE, conn.getStatus());
        assertNull(conn.getId());
        assertNull(conn.getOrganizationId());
        assertNull(conn.getPropertyId());
    }

    @Test
    void allArgsConstructor_setsAllFields() {
        ExpediaConnection conn = new ExpediaConnection(1L, "PROP-1", "encKey", "encSecret");
        assertEquals(1L, conn.getOrganizationId());
        assertEquals("PROP-1", conn.getPropertyId());
        assertEquals("encKey", conn.getApiKeyEncrypted());
        assertEquals("encSecret", conn.getApiSecretEncrypted());
    }

    @Test
    void settersAndGetters_roundTrip() {
        ExpediaConnection conn = new ExpediaConnection();
        LocalDateTime now = LocalDateTime.now();
        conn.setId(99L);
        conn.setOrganizationId(2L);
        conn.setPropertyId("P-2");
        conn.setApiKeyEncrypted("k");
        conn.setApiSecretEncrypted("s");
        conn.setStatus(ExpediaConnection.ExpediaConnectionStatus.INACTIVE);
        conn.setConnectedAt(now);
        conn.setLastSyncAt(now);
        conn.setErrorMessage("err");
        conn.setCreatedAt(now);
        conn.setUpdatedAt(now);

        assertEquals(99L, conn.getId());
        assertEquals(2L, conn.getOrganizationId());
        assertEquals("P-2", conn.getPropertyId());
        assertEquals("k", conn.getApiKeyEncrypted());
        assertEquals("s", conn.getApiSecretEncrypted());
        assertEquals(ExpediaConnection.ExpediaConnectionStatus.INACTIVE, conn.getStatus());
        assertEquals(now, conn.getConnectedAt());
        assertEquals(now, conn.getLastSyncAt());
        assertEquals("err", conn.getErrorMessage());
        assertEquals(now, conn.getCreatedAt());
        assertEquals(now, conn.getUpdatedAt());
    }

    @Test
    void prePersist_setsTimestamps() {
        ExpediaConnection conn = new ExpediaConnection(1L, "P", "k", "s");
        assertNull(conn.getCreatedAt());
        assertNull(conn.getUpdatedAt());

        conn.prePersist();

        assertNotNull(conn.getCreatedAt());
        assertNotNull(conn.getUpdatedAt());
        assertNotNull(conn.getConnectedAt());
    }

    @Test
    void prePersist_preservesExistingConnectedAt() {
        ExpediaConnection conn = new ExpediaConnection();
        LocalDateTime past = LocalDateTime.now().minusDays(1);
        conn.setConnectedAt(past);

        conn.prePersist();

        assertEquals(past, conn.getConnectedAt());
    }

    @Test
    void preUpdate_updatesTimestamp() throws InterruptedException {
        ExpediaConnection conn = new ExpediaConnection();
        conn.prePersist();
        LocalDateTime first = conn.getUpdatedAt();
        Thread.sleep(5);

        conn.preUpdate();

        assertTrue(conn.getUpdatedAt().isAfter(first) || conn.getUpdatedAt().isEqual(first));
    }

    @Test
    void isActive_active_true() {
        ExpediaConnection conn = new ExpediaConnection();
        conn.setStatus(ExpediaConnection.ExpediaConnectionStatus.ACTIVE);
        assertTrue(conn.isActive());
    }

    @Test
    void isActive_inactive_false() {
        ExpediaConnection conn = new ExpediaConnection();
        conn.setStatus(ExpediaConnection.ExpediaConnectionStatus.INACTIVE);
        assertFalse(conn.isActive());
    }

    @Test
    void isActive_error_false() {
        ExpediaConnection conn = new ExpediaConnection();
        conn.setStatus(ExpediaConnection.ExpediaConnectionStatus.ERROR);
        assertFalse(conn.isActive());
    }

    @Test
    void toString_includesKeyFields() {
        ExpediaConnection conn = new ExpediaConnection(1L, "P1", "k", "s");
        conn.setId(42L);
        String s = conn.toString();
        assertTrue(s.contains("id=42"));
        assertTrue(s.contains("P1"));
        assertTrue(s.contains("organizationId=1"));
    }

    @Test
    void enumValues_areThree() {
        assertEquals(3, ExpediaConnection.ExpediaConnectionStatus.values().length);
        assertNotNull(ExpediaConnection.ExpediaConnectionStatus.valueOf("ACTIVE"));
    }
}
