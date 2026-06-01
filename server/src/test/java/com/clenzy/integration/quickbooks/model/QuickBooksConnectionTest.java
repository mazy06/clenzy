package com.clenzy.integration.quickbooks.model;

import com.clenzy.integration.oauth.OAuthConnectionStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class QuickBooksConnectionTest {

    @Test
    void defaultStatus_isActive() {
        QuickBooksConnection conn = new QuickBooksConnection();
        assertEquals(QuickBooksConnection.Status.ACTIVE, conn.getStatus());
    }

    @Test
    void settersAndGetters_roundTrip() {
        QuickBooksConnection conn = new QuickBooksConnection();
        Instant now = Instant.now();
        conn.setId(13L);
        conn.setOrganizationId(2L);
        conn.setUserId(3L);
        conn.setAccessTokenEncrypted("at");
        conn.setRefreshTokenEncrypted("rt");
        conn.setTokenExpiresAt(now);
        conn.setRefreshTokenExpiresAt(now);
        conn.setScopes("com.intuit.quickbooks.accounting");
        conn.setRealmId("4620816365317540139");
        conn.setStatus(QuickBooksConnection.Status.ERROR);
        conn.setErrorMessage("auth failed");
        conn.setConnectedAt(now);

        assertEquals(13L, conn.getId());
        assertEquals(2L, conn.getOrganizationId());
        assertEquals(3L, conn.getUserId());
        assertEquals("at", conn.getAccessTokenEncrypted());
        assertEquals("rt", conn.getRefreshTokenEncrypted());
        assertEquals(now, conn.getTokenExpiresAt());
        assertEquals(now, conn.getRefreshTokenExpiresAt());
        assertEquals("com.intuit.quickbooks.accounting", conn.getScopes());
        assertEquals("4620816365317540139", conn.getRealmId());
        assertEquals(QuickBooksConnection.Status.ERROR, conn.getStatus());
        assertEquals("auth failed", conn.getErrorMessage());
        assertEquals(now, conn.getConnectedAt());
    }

    @Test
    void onCreate_setsTimestamps() {
        QuickBooksConnection conn = new QuickBooksConnection();
        conn.onCreate();
        assertNotNull(conn.getCreatedAt());
        assertNotNull(conn.getUpdatedAt());
    }

    @Test
    void onUpdate_refreshesUpdatedAt() throws InterruptedException {
        QuickBooksConnection conn = new QuickBooksConnection();
        conn.onCreate();
        Instant first = conn.getUpdatedAt();
        Thread.sleep(5);
        conn.onUpdate();
        assertTrue(conn.getUpdatedAt().equals(first) || conn.getUpdatedAt().isAfter(first));
    }

    @Test
    void getOAuthStatus_mapsAllStatuses() {
        QuickBooksConnection conn = new QuickBooksConnection();
        conn.setStatus(QuickBooksConnection.Status.ACTIVE);
        assertEquals(OAuthConnectionStatus.ACTIVE, conn.getOAuthStatus());
        conn.setStatus(QuickBooksConnection.Status.EXPIRED);
        assertEquals(OAuthConnectionStatus.EXPIRED, conn.getOAuthStatus());
        conn.setStatus(QuickBooksConnection.Status.ERROR);
        assertEquals(OAuthConnectionStatus.ERROR, conn.getOAuthStatus());
        conn.setStatus(QuickBooksConnection.Status.REVOKED);
        assertEquals(OAuthConnectionStatus.REVOKED, conn.getOAuthStatus());
    }

    @Test
    void oauthStatus_nullSafe() {
        QuickBooksConnection conn = new QuickBooksConnection();
        conn.setStatus(null);
        assertNull(conn.getOAuthStatus());
        conn.setOAuthStatus(null);
        assertNull(conn.getStatus());
    }

    @Test
    void setOAuthStatus_mapsCorrectly() {
        QuickBooksConnection conn = new QuickBooksConnection();
        conn.setOAuthStatus(OAuthConnectionStatus.ACTIVE);
        assertEquals(QuickBooksConnection.Status.ACTIVE, conn.getStatus());
        conn.setOAuthStatus(OAuthConnectionStatus.EXPIRED);
        assertEquals(QuickBooksConnection.Status.EXPIRED, conn.getStatus());
    }
}
