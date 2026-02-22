package com.clenzy.integration.airbnb.config;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class AirbnbConfigTest {

    private AirbnbConfig config;

    @BeforeEach
    void setUp() {
        config = new AirbnbConfig();
    }

    @Nested
    @DisplayName("getters")
    class Getters {

        @Test
        @DisplayName("when fields set then getters return correct values")
        void whenFieldsSet_thenGettersReturnCorrectValues() throws Exception {
            // Arrange
            setField(config, "apiBaseUrl", "https://api.airbnb.com/v2");
            setField(config, "clientId", "test-client-id");
            setField(config, "clientSecret", "test-secret");
            setField(config, "redirectUri", "https://example.com/callback");
            setField(config, "authorizationUrl", "https://www.airbnb.com/oauth2/auth");
            setField(config, "tokenUrl", "https://api.airbnb.com/v2/oauth2/authorizations");
            setField(config, "scopes", "listings_r,reservations_r");
            setField(config, "webhookSecret", "webhook-secret");
            setField(config, "syncIntervalMinutes", 30);
            setField(config, "syncEnabled", true);

            // Act & Assert
            assertThat(config.getApiBaseUrl()).isEqualTo("https://api.airbnb.com/v2");
            assertThat(config.getClientId()).isEqualTo("test-client-id");
            assertThat(config.getClientSecret()).isEqualTo("test-secret");
            assertThat(config.getRedirectUri()).isEqualTo("https://example.com/callback");
            assertThat(config.getAuthorizationUrl()).isEqualTo("https://www.airbnb.com/oauth2/auth");
            assertThat(config.getTokenUrl()).isEqualTo("https://api.airbnb.com/v2/oauth2/authorizations");
            assertThat(config.getScopes()).isEqualTo("listings_r,reservations_r");
            assertThat(config.getWebhookSecret()).isEqualTo("webhook-secret");
            assertThat(config.getSyncIntervalMinutes()).isEqualTo(30);
            assertThat(config.isSyncEnabled()).isTrue();
        }
    }

    @Nested
    @DisplayName("isConfigured")
    class IsConfigured {

        @Test
        @DisplayName("when all required fields set then returns true")
        void whenAllRequiredFieldsSet_thenReturnsTrue() throws Exception {
            // Arrange
            setField(config, "clientId", "id");
            setField(config, "clientSecret", "secret");
            setField(config, "redirectUri", "https://example.com/callback");

            // Act & Assert
            assertThat(config.isConfigured()).isTrue();
        }

        @Test
        @DisplayName("when clientId is empty then returns false")
        void whenClientIdEmpty_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "clientId", "");
            setField(config, "clientSecret", "secret");
            setField(config, "redirectUri", "https://example.com/callback");

            // Act & Assert
            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when clientId is null then returns false")
        void whenClientIdNull_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "clientId", null);
            setField(config, "clientSecret", "secret");
            setField(config, "redirectUri", "https://example.com/callback");

            // Act & Assert
            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when clientSecret is empty then returns false")
        void whenClientSecretEmpty_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "clientId", "id");
            setField(config, "clientSecret", "");
            setField(config, "redirectUri", "https://example.com/callback");

            // Act & Assert
            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when redirectUri is empty then returns false")
        void whenRedirectUriEmpty_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "clientId", "id");
            setField(config, "clientSecret", "secret");
            setField(config, "redirectUri", "");

            // Act & Assert
            assertThat(config.isConfigured()).isFalse();
        }
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
