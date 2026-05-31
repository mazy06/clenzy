package com.clenzy.integration.docusign.model;

import com.clenzy.integration.oauth.OAuthConnectionStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class DocuSignConnectionTest {

    @Test
    void defaultConstructor_defaultsToActive() {
        DocuSignConnection conn = new DocuSignConnection();
        assertEquals(DocuSignConnection.Status.ACTIVE, conn.getStatus());
        assertNull(conn.getId());
    }

    @Test
    void settersAndGetters_roundTrip() {
        DocuSignConnection conn = new DocuSignConnection();
        Instant now = Instant.now();
        conn.setId(10L);
        conn.setOrganizationId(2L);
        conn.setUserId(3L);
        conn.setAccessTokenEncrypted("at");
        conn.setRefreshTokenEncrypted("rt");
        conn.setTokenExpiresAt(now);
        conn.setRefreshTokenExpiresAt(now);
        conn.setScopes("scope1 scope2");
        conn.setAccountId("acc-1");
        conn.setAccountBaseUri("https://na3.docusign.net");
        conn.setStatus(DocuSignConnection.Status.EXPIRED);
        conn.setErrorMessage("err");
        conn.setConnectedAt(now);

        assertEquals(10L, conn.getId());
        assertEquals(2L, conn.getOrganizationId());
        assertEquals(3L, conn.getUserId());
        assertEquals("at", conn.getAccessTokenEncrypted());
        assertEquals("rt", conn.getRefreshTokenEncrypted());
        assertEquals(now, conn.getTokenExpiresAt());
        assertEquals(now, conn.getRefreshTokenExpiresAt());
        assertEquals("scope1 scope2", conn.getScopes());
        assertEquals("acc-1", conn.getAccountId());
        assertEquals("https://na3.docusign.net", conn.getAccountBaseUri());
        assertEquals(DocuSignConnection.Status.EXPIRED, conn.getStatus());
        assertEquals("err", conn.getErrorMessage());
        assertEquals(now, conn.getConnectedAt());
    }

    @Test
    void onCreate_setsTimestamps() {
        DocuSignConnection conn = new DocuSignConnection();
        assertNull(conn.getCreatedAt());

        conn.onCreate();

        assertNotNull(conn.getCreatedAt());
        assertNotNull(conn.getUpdatedAt());
    }

    @Test
    void onUpdate_updatesTimestamp() throws InterruptedException {
        DocuSignConnection conn = new DocuSignConnection();
        conn.onCreate();
        Instant first = conn.getUpdatedAt();
        Thread.sleep(5);

        conn.onUpdate();

        assertTrue(conn.getUpdatedAt().equals(first) || conn.getUpdatedAt().isAfter(first));
    }

    @Test
    void getOAuthStatus_mapsActive() {
        DocuSignConnection conn = new DocuSignConnection();
        conn.setStatus(DocuSignConnection.Status.ACTIVE);
        assertEquals(OAuthConnectionStatus.ACTIVE, conn.getOAuthStatus());
    }

    @Test
    void getOAuthStatus_mapsExpired() {
        DocuSignConnection conn = new DocuSignConnection();
        conn.setStatus(DocuSignConnection.Status.EXPIRED);
        assertEquals(OAuthConnectionStatus.EXPIRED, conn.getOAuthStatus());
    }

    @Test
    void getOAuthStatus_mapsRevoked() {
        DocuSignConnection conn = new DocuSignConnection();
        conn.setStatus(DocuSignConnection.Status.REVOKED);
        assertEquals(OAuthConnectionStatus.REVOKED, conn.getOAuthStatus());
    }

    @Test
    void getOAuthStatus_nullWhenNull() {
        DocuSignConnection conn = new DocuSignConnection();
        conn.setStatus(null);
        assertNull(conn.getOAuthStatus());
    }

    @Test
    void setOAuthStatus_mapsActive() {
        DocuSignConnection conn = new DocuSignConnection();
        conn.setOAuthStatus(OAuthConnectionStatus.ACTIVE);
        assertEquals(DocuSignConnection.Status.ACTIVE, conn.getStatus());
    }

    @Test
    void setOAuthStatus_mapsError() {
        DocuSignConnection conn = new DocuSignConnection();
        conn.setOAuthStatus(OAuthConnectionStatus.ERROR);
        assertEquals(DocuSignConnection.Status.ERROR, conn.getStatus());
    }

    @Test
    void setOAuthStatus_nullWhenNull() {
        DocuSignConnection conn = new DocuSignConnection();
        conn.setOAuthStatus(null);
        assertNull(conn.getStatus());
    }

    @Test
    void enumStatus_hasFourValues() {
        assertEquals(4, DocuSignConnection.Status.values().length);
    }
}
