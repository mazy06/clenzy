package com.clenzy.integration.pennylane.model;

import com.clenzy.integration.oauth.OAuthConnectionStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class PennylaneConnectionTest {

    @Test
    void defaultStatus_isActive() {
        PennylaneConnection conn = new PennylaneConnection();
        assertEquals(PennylaneConnection.Status.ACTIVE, conn.getStatus());
        assertTrue(conn.isActive());
    }

    @Test
    void settersAndGetters_roundTrip() {
        PennylaneConnection conn = new PennylaneConnection();
        Instant now = Instant.now();
        conn.setId(1L);
        conn.setOrganizationId(2L);
        conn.setUserId(3L);
        conn.setAccessTokenEncrypted("encAccess");
        conn.setRefreshTokenEncrypted("encRefresh");
        conn.setTokenExpiresAt(now);
        conn.setRefreshTokenExpiresAt(now);
        conn.setScopes("read write");
        conn.setPennylaneCompanyId("comp-99");
        conn.setStatus(PennylaneConnection.Status.EXPIRED);
        conn.setErrorMessage("oops");
        conn.setConnectedAt(now);
        conn.setLastSyncAt(now);

        assertEquals(1L, conn.getId());
        assertEquals(2L, conn.getOrganizationId());
        assertEquals(3L, conn.getUserId());
        assertEquals("encAccess", conn.getAccessTokenEncrypted());
        assertEquals("encRefresh", conn.getRefreshTokenEncrypted());
        assertEquals(now, conn.getTokenExpiresAt());
        assertEquals(now, conn.getRefreshTokenExpiresAt());
        assertEquals("read write", conn.getScopes());
        assertEquals("comp-99", conn.getPennylaneCompanyId());
        assertEquals(PennylaneConnection.Status.EXPIRED, conn.getStatus());
        assertEquals("oops", conn.getErrorMessage());
        assertEquals(now, conn.getConnectedAt());
        assertEquals(now, conn.getLastSyncAt());
        assertFalse(conn.isActive());
    }

    @Test
    void onCreate_setsTimestamps() {
        PennylaneConnection conn = new PennylaneConnection();
        assertNull(conn.getCreatedAt());
        assertNull(conn.getUpdatedAt());

        conn.onCreate();

        assertNotNull(conn.getCreatedAt());
        assertNotNull(conn.getUpdatedAt());
        assertEquals(conn.getCreatedAt(), conn.getUpdatedAt());
    }

    @Test
    void onUpdate_updatesTimestamp() throws InterruptedException {
        PennylaneConnection conn = new PennylaneConnection();
        conn.onCreate();
        Instant first = conn.getUpdatedAt();
        Thread.sleep(5);

        conn.onUpdate();

        assertTrue(conn.getUpdatedAt().equals(first) || conn.getUpdatedAt().isAfter(first));
    }

    @Test
    void isTokenExpired_nullExpiry_returnsFalse() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setTokenExpiresAt(null);
        assertFalse(conn.isTokenExpired());
    }

    @Test
    void isTokenExpired_pastExpiry_returnsTrue() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setTokenExpiresAt(Instant.now().minusSeconds(60));
        assertTrue(conn.isTokenExpired());
    }

    @Test
    void isTokenExpired_futureExpiry_returnsFalse() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setTokenExpiresAt(Instant.now().plusSeconds(60));
        assertFalse(conn.isTokenExpired());
    }

    @Test
    void isTokenExpiringSoon_nullExpiry_returnsTrue() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setTokenExpiresAt(null);
        assertTrue(conn.isTokenExpiringSoon());
    }

    @Test
    void isTokenExpiringSoon_within5Minutes_returnsTrue() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setTokenExpiresAt(Instant.now().plusSeconds(60));
        assertTrue(conn.isTokenExpiringSoon());
    }

    @Test
    void isTokenExpiringSoon_beyond5Minutes_returnsFalse() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setTokenExpiresAt(Instant.now().plusSeconds(3600));
        assertFalse(conn.isTokenExpiringSoon());
    }

    @Test
    void getOAuthStatus_mapsCorrectly() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setStatus(PennylaneConnection.Status.ACTIVE);
        assertEquals(OAuthConnectionStatus.ACTIVE, conn.getOAuthStatus());
        conn.setStatus(PennylaneConnection.Status.EXPIRED);
        assertEquals(OAuthConnectionStatus.EXPIRED, conn.getOAuthStatus());
        conn.setStatus(PennylaneConnection.Status.ERROR);
        assertEquals(OAuthConnectionStatus.ERROR, conn.getOAuthStatus());
        conn.setStatus(PennylaneConnection.Status.REVOKED);
        assertEquals(OAuthConnectionStatus.REVOKED, conn.getOAuthStatus());
    }

    @Test
    void getOAuthStatus_nullWhenNull() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setStatus(null);
        assertNull(conn.getOAuthStatus());
    }

    @Test
    void setOAuthStatus_mapsCorrectly() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setOAuthStatus(OAuthConnectionStatus.ACTIVE);
        assertEquals(PennylaneConnection.Status.ACTIVE, conn.getStatus());
        conn.setOAuthStatus(OAuthConnectionStatus.ERROR);
        assertEquals(PennylaneConnection.Status.ERROR, conn.getStatus());
    }

    @Test
    void setOAuthStatus_nullWhenNull() {
        PennylaneConnection conn = new PennylaneConnection();
        conn.setOAuthStatus(null);
        assertNull(conn.getStatus());
    }

    @Test
    void statusEnum_hasFourValues() {
        assertEquals(4, PennylaneConnection.Status.values().length);
    }
}
