package com.clenzy.integration.quickbooks.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class QuickBooksConfigTest {

    @Test
    void defaultUrls_areIntuitEndpoints() {
        QuickBooksConfig config = new QuickBooksConfig();
        assertEquals("https://appcenter.intuit.com/connect/oauth2", config.getAuthorizationUrl());
        assertEquals("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", config.getTokenUrl());
        assertEquals("https://developer.api.intuit.com/v2/oauth2/tokens/revoke", config.getRevokeUrl());
        assertEquals("https://sandbox-quickbooks.api.intuit.com", config.getApiBaseUrl());
        assertEquals("com.intuit.quickbooks.accounting", config.getScopes());
    }

    @Test
    void settersAndGetters_roundTrip() {
        QuickBooksConfig config = new QuickBooksConfig();
        config.setClientId("client-id-1");
        config.setClientSecret("secret-1");
        config.setRedirectUri("https://app.clenzy.fr/cb");
        config.setAuthorizationUrl("https://auth.example.com");
        config.setTokenUrl("https://token.example.com");
        config.setRevokeUrl("https://revoke.example.com");
        config.setApiBaseUrl("https://api.example.com");
        config.setScopes("custom.scope");

        assertEquals("client-id-1", config.getClientId());
        assertEquals("secret-1", config.getClientSecret());
        assertEquals("https://app.clenzy.fr/cb", config.getRedirectUri());
        assertEquals("https://auth.example.com", config.getAuthorizationUrl());
        assertEquals("https://token.example.com", config.getTokenUrl());
        assertEquals("https://revoke.example.com", config.getRevokeUrl());
        assertEquals("https://api.example.com", config.getApiBaseUrl());
        assertEquals("custom.scope", config.getScopes());
    }

    @Test
    void isConfigured_whenBothIdAndSecretSet_returnsTrue() {
        QuickBooksConfig config = new QuickBooksConfig();
        config.setClientId("id");
        config.setClientSecret("secret");
        assertTrue(config.isConfigured());
    }

    @Test
    void isConfigured_whenClientIdNull_returnsFalse() {
        QuickBooksConfig config = new QuickBooksConfig();
        config.setClientSecret("secret");
        assertFalse(config.isConfigured());
    }

    @Test
    void isConfigured_whenClientIdBlank_returnsFalse() {
        QuickBooksConfig config = new QuickBooksConfig();
        config.setClientId("   ");
        config.setClientSecret("secret");
        assertFalse(config.isConfigured());
    }

    @Test
    void isConfigured_whenClientSecretNull_returnsFalse() {
        QuickBooksConfig config = new QuickBooksConfig();
        config.setClientId("id");
        assertFalse(config.isConfigured());
    }

    @Test
    void isConfigured_whenClientSecretBlank_returnsFalse() {
        QuickBooksConfig config = new QuickBooksConfig();
        config.setClientId("id");
        config.setClientSecret("");
        assertFalse(config.isConfigured());
    }

    @Test
    void isConfigured_whenBothEmpty_returnsFalse() {
        QuickBooksConfig config = new QuickBooksConfig();
        assertFalse(config.isConfigured());
    }
}
