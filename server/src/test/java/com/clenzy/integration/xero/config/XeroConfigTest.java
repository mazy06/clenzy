package com.clenzy.integration.xero.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link XeroConfig}.
 *
 * <p>Validates default endpoint URLs, all getters/setters, and the
 * {@code isConfigured()} helper across null / empty / whitespace inputs.</p>
 */
class XeroConfigTest {

    private XeroConfig config;

    @BeforeEach
    void setUp() {
        config = new XeroConfig();
    }

    @Nested
    @DisplayName("defaults")
    class Defaults {

        @Test
        @DisplayName("when freshly constructed then endpoint URLs match Xero documentation")
        void whenFreshlyConstructed_thenEndpointUrlsMatchXeroDocumentation() {
            assertThat(config.getAuthorizationUrl())
                .isEqualTo("https://login.xero.com/identity/connect/authorize");
            assertThat(config.getTokenUrl())
                .isEqualTo("https://identity.xero.com/connect/token");
            assertThat(config.getRevokeUrl())
                .isEqualTo("https://identity.xero.com/connect/revocation");
            assertThat(config.getConnectionsUrl())
                .isEqualTo("https://api.xero.com/connections");
            assertThat(config.getApiBaseUrl())
                .isEqualTo("https://api.xero.com");
        }

        @Test
        @DisplayName("when freshly constructed then default scopes include offline_access")
        void whenFreshlyConstructed_thenDefaultScopesIncludeOfflineAccess() {
            assertThat(config.getScopes())
                .contains("offline_access")
                .contains("accounting.transactions")
                .contains("accounting.contacts")
                .contains("accounting.settings");
        }

        @Test
        @DisplayName("when freshly constructed then credentials are null")
        void whenFreshlyConstructed_thenCredentialsAreNull() {
            assertThat(config.getClientId()).isNull();
            assertThat(config.getClientSecret()).isNull();
            assertThat(config.getRedirectUri()).isNull();
        }
    }

    @Nested
    @DisplayName("getters and setters")
    class GettersAndSetters {

        @Test
        @DisplayName("when all fields set then getters return correct values")
        void whenAllFieldsSet_thenGettersReturnCorrectValues() {
            config.setClientId("xero-client-id");
            config.setClientSecret("xero-secret");
            config.setRedirectUri("https://app.clenzy.fr/oauth/xero/callback");
            config.setAuthorizationUrl("https://custom.example/authorize");
            config.setTokenUrl("https://custom.example/token");
            config.setRevokeUrl("https://custom.example/revoke");
            config.setConnectionsUrl("https://custom.example/connections");
            config.setApiBaseUrl("https://custom.example/api");
            config.setScopes("custom_scope offline_access");

            assertThat(config.getClientId()).isEqualTo("xero-client-id");
            assertThat(config.getClientSecret()).isEqualTo("xero-secret");
            assertThat(config.getRedirectUri())
                .isEqualTo("https://app.clenzy.fr/oauth/xero/callback");
            assertThat(config.getAuthorizationUrl()).isEqualTo("https://custom.example/authorize");
            assertThat(config.getTokenUrl()).isEqualTo("https://custom.example/token");
            assertThat(config.getRevokeUrl()).isEqualTo("https://custom.example/revoke");
            assertThat(config.getConnectionsUrl()).isEqualTo("https://custom.example/connections");
            assertThat(config.getApiBaseUrl()).isEqualTo("https://custom.example/api");
            assertThat(config.getScopes()).isEqualTo("custom_scope offline_access");
        }
    }

    @Nested
    @DisplayName("isConfigured")
    class IsConfigured {

        @Test
        @DisplayName("when clientId and clientSecret set then returns true")
        void whenClientIdAndSecretSet_thenReturnsTrue() {
            config.setClientId("id");
            config.setClientSecret("secret");

            assertThat(config.isConfigured()).isTrue();
        }

        @Test
        @DisplayName("when both credentials null then returns false")
        void whenBothCredentialsNull_thenReturnsFalse() {
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
            config.setClientSecret("\t");

            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when both credentials are blank then returns false")
        void whenBothCredentialsBlank_thenReturnsFalse() {
            config.setClientId(" ");
            config.setClientSecret(" ");

            assertThat(config.isConfigured()).isFalse();
        }
    }
}
