package com.clenzy.integration.sage.model;

import com.clenzy.integration.oauth.OAuthConnectionStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class SageConnectionTest {

    @Test
    void defaultStatus_isActive() {
        SageConnection conn = new SageConnection();
        assertEquals(SageConnection.Status.ACTIVE, conn.getStatus());
    }

    @Test
    void settersAndGetters_roundTrip() {
        SageConnection conn = new SageConnection();
        Instant now = Instant.now();
        conn.setId(11L);
        conn.setOrganizationId(2L);
        conn.setUserId(3L);
        conn.setAccessTokenEncrypted("at");
        conn.setRefreshTokenEncrypted("rt");
        conn.setTokenExpiresAt(now);
        conn.setRefreshTokenExpiresAt(now);
        conn.setScopes("full_access");
        conn.setBusinessId("biz-1");
        conn.setBusinessName("Biz Name");
        conn.setStatus(SageConnection.Status.REVOKED);
        conn.setErrorMessage("err");
        conn.setConnectedAt(now);

        assertEquals(11L, conn.getId());
        assertEquals(2L, conn.getOrganizationId());
        assertEquals(3L, conn.getUserId());
        assertEquals("at", conn.getAccessTokenEncrypted());
        assertEquals("rt", conn.getRefreshTokenEncrypted());
        assertEquals(now, conn.getTokenExpiresAt());
        assertEquals(now, conn.getRefreshTokenExpiresAt());
        assertEquals("full_access", conn.getScopes());
        assertEquals("biz-1", conn.getBusinessId());
        assertEquals("Biz Name", conn.getBusinessName());
        assertEquals(SageConnection.Status.REVOKED, conn.getStatus());
        assertEquals("err", conn.getErrorMessage());
        assertEquals(now, conn.getConnectedAt());
    }

    @Test
    void onCreate_setsTimestamps() {
        SageConnection conn = new SageConnection();
        conn.onCreate();
        assertNotNull(conn.getCreatedAt());
        assertNotNull(conn.getUpdatedAt());
    }

    @Test
    void onUpdate_refreshesUpdatedAt() throws InterruptedException {
        SageConnection conn = new SageConnection();
        conn.onCreate();
        Instant first = conn.getUpdatedAt();
        Thread.sleep(5);
        conn.onUpdate();
        assertTrue(conn.getUpdatedAt().equals(first) || conn.getUpdatedAt().isAfter(first));
    }

    @Test
    void getOAuthStatus_mapsAllStatuses() {
        SageConnection conn = new SageConnection();
        conn.setStatus(SageConnection.Status.ACTIVE);
        assertEquals(OAuthConnectionStatus.ACTIVE, conn.getOAuthStatus());
        conn.setStatus(SageConnection.Status.EXPIRED);
        assertEquals(OAuthConnectionStatus.EXPIRED, conn.getOAuthStatus());
        conn.setStatus(SageConnection.Status.ERROR);
        assertEquals(OAuthConnectionStatus.ERROR, conn.getOAuthStatus());
        conn.setStatus(SageConnection.Status.REVOKED);
        assertEquals(OAuthConnectionStatus.REVOKED, conn.getOAuthStatus());
    }

    @Test
    void oauthStatus_nullSafe() {
        SageConnection conn = new SageConnection();
        conn.setStatus(null);
        assertNull(conn.getOAuthStatus());
        conn.setOAuthStatus(null);
        assertNull(conn.getStatus());
    }

    @Test
    void setOAuthStatus_mapsCorrectly() {
        SageConnection conn = new SageConnection();
        conn.setOAuthStatus(OAuthConnectionStatus.EXPIRED);
        assertEquals(SageConnection.Status.EXPIRED, conn.getStatus());
    }
}
