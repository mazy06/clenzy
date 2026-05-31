package com.clenzy.integration.sage.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link SageConfig}.
 *
 * <p>Validates default Sage Business Cloud endpoints, all getters/setters,
 * and the {@code isConfigured()} helper across null / empty / whitespace
 * inputs.</p>
 */
class SageConfigTest {

    private SageConfig config;

    @BeforeEach
    void setUp() {
        config = new SageConfig();
    }

    @Nested
    @DisplayName("defaults")
    class Defaults {

        @Test
        @DisplayName("when freshly constructed then endpoint URLs match Sage documentation")
        void whenFreshlyConstructed_thenEndpointUrlsMatchSageDocumentation() {
            assertThat(config.getAuthorizationUrl())
                .isEqualTo("https://www.sageone.com/oauth2/auth/central");
            assertThat(config.getTokenUrl())
                .isEqualTo("https://oauth.accounting.sage.com/token");
            assertThat(config.getRevokeUrl())
                .isEqualTo("https://oauth.accounting.sage.com/revoke");
            assertThat(config.getBusinessesUrl())
                .isEqualTo("https://api.accounting.sage.com/v3.1/businesses");
            assertThat(config.getApiBaseUrl())
                .isEqualTo("https://api.accounting.sage.com/v3.1");
        }

        @Test
        @DisplayName("when freshly constructed then default scope is full_access")
        void whenFreshlyConstructed_thenDefaultScopeIsFullAccess() {
            assertThat(config.getScopes()).isEqualTo("full_access");
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
            config.setClientId("sage-client-id");
            config.setClientSecret("sage-secret");
            config.setRedirectUri("https://app.clenzy.fr/oauth/sage/callback");
            config.setAuthorizationUrl("https://custom.example/authorize");
            config.setTokenUrl("https://custom.example/token");
            config.setRevokeUrl("https://custom.example/revoke");
            config.setBusinessesUrl("https://custom.example/businesses");
            config.setApiBaseUrl("https://custom.example/api");
            config.setScopes("custom_scope");

            assertThat(config.getClientId()).isEqualTo("sage-client-id");
            assertThat(config.getClientSecret()).isEqualTo("sage-secret");
            assertThat(config.getRedirectUri())
                .isEqualTo("https://app.clenzy.fr/oauth/sage/callback");
            assertThat(config.getAuthorizationUrl()).isEqualTo("https://custom.example/authorize");
            assertThat(config.getTokenUrl()).isEqualTo("https://custom.example/token");
            assertThat(config.getRevokeUrl()).isEqualTo("https://custom.example/revoke");
            assertThat(config.getBusinessesUrl()).isEqualTo("https://custom.example/businesses");
            assertThat(config.getApiBaseUrl()).isEqualTo("https://custom.example/api");
            assertThat(config.getScopes()).isEqualTo("custom_scope");
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
            config.setClientSecret("\n");

            assertThat(config.isConfigured()).isFalse();
        }
    }
}
