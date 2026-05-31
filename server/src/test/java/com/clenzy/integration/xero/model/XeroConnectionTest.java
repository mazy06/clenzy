package com.clenzy.integration.xero.model;

import com.clenzy.integration.oauth.OAuthConnectionStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class XeroConnectionTest {

    @Test
    void defaultStatus_isActive() {
        XeroConnection conn = new XeroConnection();
        assertEquals(XeroConnection.Status.ACTIVE, conn.getStatus());
    }

    @Test
    void settersAndGetters_roundTrip() {
        XeroConnection conn = new XeroConnection();
        Instant now = Instant.now();
        conn.setId(7L);
        conn.setOrganizationId(2L);
        conn.setUserId(3L);
        conn.setAccessTokenEncrypted("at");
        conn.setRefreshTokenEncrypted("rt");
        conn.setTokenExpiresAt(now);
        conn.setRefreshTokenExpiresAt(now);
        conn.setScopes("accounting.transactions");
        conn.setTenantId("tnt-1");
        conn.setTenantName("My Tenant");
        conn.setStatus(XeroConnection.Status.EXPIRED);
        conn.setErrorMessage("error");
        conn.setConnectedAt(now);

        assertEquals(7L, conn.getId());
        assertEquals(2L, conn.getOrganizationId());
        assertEquals(3L, conn.getUserId());
        assertEquals("at", conn.getAccessTokenEncrypted());
        assertEquals("rt", conn.getRefreshTokenEncrypted());
        assertEquals(now, conn.getTokenExpiresAt());
        assertEquals(now, conn.getRefreshTokenExpiresAt());
        assertEquals("accounting.transactions", conn.getScopes());
        assertEquals("tnt-1", conn.getTenantId());
        assertEquals("My Tenant", conn.getTenantName());
        assertEquals(XeroConnection.Status.EXPIRED, conn.getStatus());
        assertEquals("error", conn.getErrorMessage());
        assertEquals(now, conn.getConnectedAt());
    }

    @Test
    void onCreate_setsTimestamps() {
        XeroConnection conn = new XeroConnection();
        conn.onCreate();
        assertNotNull(conn.getCreatedAt());
        assertNotNull(conn.getUpdatedAt());
    }

    @Test
    void onUpdate_refreshesUpdatedAt() throws InterruptedException {
        XeroConnection conn = new XeroConnection();
        conn.onCreate();
        Instant first = conn.getUpdatedAt();
        Thread.sleep(5);
        conn.onUpdate();
        assertTrue(conn.getUpdatedAt().equals(first) || conn.getUpdatedAt().isAfter(first));
    }

    @Test
    void getOAuthStatus_mapsAllStatuses() {
        XeroConnection conn = new XeroConnection();
        conn.setStatus(XeroConnection.Status.ACTIVE);
        assertEquals(OAuthConnectionStatus.ACTIVE, conn.getOAuthStatus());
        conn.setStatus(XeroConnection.Status.EXPIRED);
        assertEquals(OAuthConnectionStatus.EXPIRED, conn.getOAuthStatus());
        conn.setStatus(XeroConnection.Status.ERROR);
        assertEquals(OAuthConnectionStatus.ERROR, conn.getOAuthStatus());
        conn.setStatus(XeroConnection.Status.REVOKED);
        assertEquals(OAuthConnectionStatus.REVOKED, conn.getOAuthStatus());
    }

    @Test
    void oauthStatus_nullSafe() {
        XeroConnection conn = new XeroConnection();
        conn.setStatus(null);
        assertNull(conn.getOAuthStatus());
        conn.setOAuthStatus(null);
        assertNull(conn.getStatus());
    }

    @Test
    void setOAuthStatus_mapsCorrectly() {
        XeroConnection conn = new XeroConnection();
        conn.setOAuthStatus(OAuthConnectionStatus.ACTIVE);
        assertEquals(XeroConnection.Status.ACTIVE, conn.getStatus());
        conn.setOAuthStatus(OAuthConnectionStatus.REVOKED);
        assertEquals(XeroConnection.Status.REVOKED, conn.getStatus());
    }

    @Test
    void statusEnum_hasFourValues() {
        assertEquals(4, XeroConnection.Status.values().length);
    }
}
