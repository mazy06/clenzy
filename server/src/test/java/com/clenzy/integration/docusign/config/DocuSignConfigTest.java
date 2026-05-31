package com.clenzy.integration.docusign.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link DocuSignConfig}.
 *
 * <p>Validates the sandbox-default endpoint URLs, all getters/setters and
 * the {@code isConfigured()} helper across null / empty / whitespace
 * inputs.</p>
 */
class DocuSignConfigTest {

    private DocuSignConfig config;

    @BeforeEach
    void setUp() {
        config = new DocuSignConfig();
    }

    @Nested
    @DisplayName("defaults")
    class Defaults {

        @Test
        @DisplayName("when freshly constructed then endpoint URLs default to sandbox")
        void whenFreshlyConstructed_thenEndpointUrlsDefaultToSandbox() {
            assertThat(config.getAuthorizationUrl())
                .isEqualTo("https://account-d.docusign.com/oauth/auth");
            assertThat(config.getTokenUrl())
                .isEqualTo("https://account-d.docusign.com/oauth/token");
            assertThat(config.getRevokeUrl())
                .isEqualTo("https://account-d.docusign.com/oauth/revoke");
            assertThat(config.getUserInfoUrl())
                .isEqualTo("https://account-d.docusign.com/oauth/userinfo");
            assertThat(config.getApiBaseUrl())
                .isEqualTo("https://demo.docusign.net/restapi");
        }

        @Test
        @DisplayName("when freshly constructed then default scope is signature")
        void whenFreshlyConstructed_thenDefaultScopeIsSignature() {
            assertThat(config.getScopes()).isEqualTo("signature");
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
            config.setClientId("docusign-integration-key");
            config.setClientSecret("docusign-secret");
            config.setRedirectUri("https://app.clenzy.fr/oauth/docusign/callback");
            config.setAuthorizationUrl("https://account.docusign.com/oauth/auth");
            config.setTokenUrl("https://account.docusign.com/oauth/token");
            config.setRevokeUrl("https://account.docusign.com/oauth/revoke");
            config.setUserInfoUrl("https://account.docusign.com/oauth/userinfo");
            config.setApiBaseUrl("https://www.docusign.net/restapi");
            config.setScopes("signature impersonation");

            assertThat(config.getClientId()).isEqualTo("docusign-integration-key");
            assertThat(config.getClientSecret()).isEqualTo("docusign-secret");
            assertThat(config.getRedirectUri())
                .isEqualTo("https://app.clenzy.fr/oauth/docusign/callback");
            assertThat(config.getAuthorizationUrl())
                .isEqualTo("https://account.docusign.com/oauth/auth");
            assertThat(config.getTokenUrl()).isEqualTo("https://account.docusign.com/oauth/token");
            assertThat(config.getRevokeUrl()).isEqualTo("https://account.docusign.com/oauth/revoke");
            assertThat(config.getUserInfoUrl())
                .isEqualTo("https://account.docusign.com/oauth/userinfo");
            assertThat(config.getApiBaseUrl()).isEqualTo("https://www.docusign.net/restapi");
            assertThat(config.getScopes()).isEqualTo("signature impersonation");
        }

        @Test
        @DisplayName("when switching to production then sandbox defaults are overridden")
        void whenSwitchingToProduction_thenSandboxDefaultsAreOverridden() {
            config.setAuthorizationUrl("https://account.docusign.com/oauth/auth");
            config.setApiBaseUrl("https://www.docusign.net/restapi");

            assertThat(config.getAuthorizationUrl()).doesNotContain("account-d");
            assertThat(config.getApiBaseUrl()).doesNotContain("demo");
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
            config.setClientSecret("\t ");

            assertThat(config.isConfigured()).isFalse();
        }
    }
}
