package com.clenzy.integration.pennylane.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link PennylaneConfig}.
 *
 * <p>Covers all getters/setters plus the two configuration-state helpers
 * {@code isConfigured()} and {@code isOAuthConfigured()} (null / empty /
 * whitespace inputs).</p>
 */
class PennylaneConfigTest {

    private PennylaneConfig config;

    @BeforeEach
    void setUp() {
        config = new PennylaneConfig();
    }

    @Nested
    @DisplayName("defaults")
    class Defaults {

        @Test
        @DisplayName("when freshly constructed then OAuth URLs have sensible defaults")
        void whenFreshlyConstructed_thenOAuthUrlsHaveSensibleDefaults() {
            assertThat(config.getAuthorizationUrl())
                .isEqualTo("https://app.pennylane.com/oauth/authorize");
            assertThat(config.getTokenUrl())
                .isEqualTo("https://app.pennylane.com/oauth/token");
            assertThat(config.getRevokeUrl())
                .isEqualTo("https://app.pennylane.com/oauth/revoke");
            assertThat(config.getAccountingApiBaseUrl())
                .isEqualTo("https://app.pennylane.com/api/external/v2");
            assertThat(config.getScopes())
                .contains("customer_invoices:all", "supplier_invoices:all");
        }

        @Test
        @DisplayName("when freshly constructed then signature fields are null")
        void whenFreshlyConstructed_thenSignatureFieldsAreNull() {
            assertThat(config.getApiUrl()).isNull();
            assertThat(config.getClientId()).isNull();
            assertThat(config.getClientSecret()).isNull();
            assertThat(config.getRedirectUri()).isNull();
        }
    }

    @Nested
    @DisplayName("getters and setters")
    class GettersAndSetters {

        @Test
        @DisplayName("when signature fields set then getters return them")
        void whenSignatureFieldsSet_thenGettersReturnThem() {
            config.setApiUrl("https://api.pennylane.example/signature");
            config.setClientId("client-123");
            config.setClientSecret("secret-456");

            assertThat(config.getApiUrl()).isEqualTo("https://api.pennylane.example/signature");
            assertThat(config.getClientId()).isEqualTo("client-123");
            assertThat(config.getClientSecret()).isEqualTo("secret-456");
        }

        @Test
        @DisplayName("when OAuth fields set then getters return them")
        void whenOAuthFieldsSet_thenGettersReturnThem() {
            config.setRedirectUri("https://app.clenzy.fr/oauth/pennylane/callback");
            config.setAuthorizationUrl("https://example.com/oauth/authorize");
            config.setTokenUrl("https://example.com/oauth/token");
            config.setRevokeUrl("https://example.com/oauth/revoke");
            config.setScopes("scope_a scope_b");
            config.setAccountingApiBaseUrl("https://example.com/api/v2");

            assertThat(config.getRedirectUri())
                .isEqualTo("https://app.clenzy.fr/oauth/pennylane/callback");
            assertThat(config.getAuthorizationUrl()).isEqualTo("https://example.com/oauth/authorize");
            assertThat(config.getTokenUrl()).isEqualTo("https://example.com/oauth/token");
            assertThat(config.getRevokeUrl()).isEqualTo("https://example.com/oauth/revoke");
            assertThat(config.getScopes()).isEqualTo("scope_a scope_b");
            assertThat(config.getAccountingApiBaseUrl()).isEqualTo("https://example.com/api/v2");
        }
    }

    @Nested
    @DisplayName("isConfigured")
    class IsConfigured {

        @Test
        @DisplayName("when clientId and clientSecret are set then returns true")
        void whenClientIdAndSecretSet_thenReturnsTrue() {
            config.setClientId("id");
            config.setClientSecret("secret");

            assertThat(config.isConfigured()).isTrue();
        }

        @Test
        @DisplayName("when both are null then returns false")
        void whenBothNull_thenReturnsFalse() {
            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when clientId is null then returns false")
        void whenClientIdNull_thenReturnsFalse() {
            config.setClientSecret("secret");

            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when clientId is empty then returns false")
        void whenClientIdEmpty_thenReturnsFalse() {
            config.setClientId("");
            config.setClientSecret("secret");

            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when clientId is blank whitespace then returns false")
        void whenClientIdBlankWhitespace_thenReturnsFalse() {
            config.setClientId("   ");
            config.setClientSecret("secret");

            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when clientSecret is null then returns false")
        void whenClientSecretNull_thenReturnsFalse() {
            config.setClientId("id");

            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when clientSecret is empty then returns false")
        void whenClientSecretEmpty_thenReturnsFalse() {
            config.setClientId("id");
            config.setClientSecret("");

            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when clientSecret is blank whitespace then returns false")
        void whenClientSecretBlankWhitespace_thenReturnsFalse() {
            config.setClientId("id");
            config.setClientSecret("\t\n ");

            assertThat(config.isConfigured()).isFalse();
        }
    }

    @Nested
    @DisplayName("isOAuthConfigured")
    class IsOAuthConfigured {

        @Test
        @DisplayName("when isConfigured and redirectUri set then returns true")
        void whenIsConfiguredAndRedirectUriSet_thenReturnsTrue() {
            config.setClientId("id");
            config.setClientSecret("secret");
            config.setRedirectUri("https://app.example/cb");

            assertThat(config.isOAuthConfigured()).isTrue();
        }

        @Test
        @DisplayName("when isConfigured is false then returns false even with redirectUri")
        void whenIsConfiguredFalse_thenReturnsFalseEvenWithRedirectUri() {
            config.setRedirectUri("https://app.example/cb");

            assertThat(config.isOAuthConfigured()).isFalse();
        }

        @Test
        @DisplayName("when redirectUri is null then returns false")
        void whenRedirectUriNull_thenReturnsFalse() {
            config.setClientId("id");
            config.setClientSecret("secret");

            assertThat(config.isOAuthConfigured()).isFalse();
        }

        @Test
        @DisplayName("when redirectUri is empty then returns false")
        void whenRedirectUriEmpty_thenReturnsFalse() {
            config.setClientId("id");
            config.setClientSecret("secret");
            config.setRedirectUri("");

            assertThat(config.isOAuthConfigured()).isFalse();
        }

        @Test
        @DisplayName("when redirectUri is blank whitespace then returns false")
        void whenRedirectUriBlankWhitespace_thenReturnsFalse() {
            config.setClientId("id");
            config.setClientSecret("secret");
            config.setRedirectUri("   ");

            assertThat(config.isOAuthConfigured()).isFalse();
        }
    }
}
