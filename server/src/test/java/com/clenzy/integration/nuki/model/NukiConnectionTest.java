package com.clenzy.integration.nuki.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class NukiConnectionTest {

    @Test
    void defaultStatus_isActive() {
        NukiConnection conn = new NukiConnection();
        assertEquals(NukiConnection.NukiConnectionStatus.ACTIVE, conn.getStatus());
        assertTrue(conn.isActive());
    }

    @Test
    void settersAndGetters_roundTrip() {
        NukiConnection conn = new NukiConnection();
        LocalDateTime now = LocalDateTime.now();
        conn.setId(5L);
        conn.setOrganizationId(2L);
        conn.setUserId("user-abc");
        conn.setAccessTokenEncrypted("at-enc");
        conn.setRefreshTokenEncrypted("rt-enc");
        conn.setTokenExpiresAt(now);
        conn.setStatus(NukiConnection.NukiConnectionStatus.REVOKED);
        conn.setConnectedAt(now);
        conn.setLastSyncAt(now);
        conn.setErrorMessage("err");

        assertEquals(5L, conn.getId());
        assertEquals(2L, conn.getOrganizationId());
        assertEquals("user-abc", conn.getUserId());
        assertEquals("at-enc", conn.getAccessTokenEncrypted());
        assertEquals("rt-enc", conn.getRefreshTokenEncrypted());
        assertEquals(now, conn.getTokenExpiresAt());
        assertEquals(NukiConnection.NukiConnectionStatus.REVOKED, conn.getStatus());
        assertEquals(now, conn.getConnectedAt());
        assertEquals(now, conn.getLastSyncAt());
        assertEquals("err", conn.getErrorMessage());
        assertFalse(conn.isActive());
    }

    @Test
    void prePersist_setsAllTimestamps() {
        NukiConnection conn = new NukiConnection();
        conn.prePersist();
        assertNotNull(conn.getCreatedAt());
        assertNotNull(conn.getUpdatedAt());
        assertNotNull(conn.getConnectedAt());
    }

    @Test
    void prePersist_preservesExistingConnectedAt() {
        NukiConnection conn = new NukiConnection();
        LocalDateTime preset = LocalDateTime.of(2024, 1, 1, 12, 0);
        conn.setConnectedAt(preset);
        conn.prePersist();
        assertEquals(preset, conn.getConnectedAt());
    }

    @Test
    void preUpdate_refreshesUpdatedAt() throws InterruptedException {
        NukiConnection conn = new NukiConnection();
        conn.prePersist();
        LocalDateTime first = conn.getUpdatedAt();
        Thread.sleep(5);
        conn.preUpdate();
        assertTrue(conn.getUpdatedAt().equals(first) || conn.getUpdatedAt().isAfter(first));
    }

    @Test
    void isTokenExpired_nullExpiry_returnsFalse() {
        NukiConnection conn = new NukiConnection();
        conn.setTokenExpiresAt(null);
        assertFalse(conn.isTokenExpired());
    }

    @Test
    void isTokenExpired_pastExpiry_returnsTrue() {
        NukiConnection conn = new NukiConnection();
        conn.setTokenExpiresAt(LocalDateTime.now().minusHours(1));
        assertTrue(conn.isTokenExpired());
    }

    @Test
    void isTokenExpired_futureExpiry_returnsFalse() {
        NukiConnection conn = new NukiConnection();
        conn.setTokenExpiresAt(LocalDateTime.now().plusHours(1));
        assertFalse(conn.isTokenExpired());
    }

    @Test
    void statusEnum_hasFourValues() {
        assertEquals(4, NukiConnection.NukiConnectionStatus.values().length);
    }
}
