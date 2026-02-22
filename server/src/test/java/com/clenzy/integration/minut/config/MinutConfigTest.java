package com.clenzy.integration.minut.config;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class MinutConfigTest {

    private MinutConfig config;

    @BeforeEach
    void setUp() {
        config = new MinutConfig();
    }

    @Nested
    @DisplayName("getters")
    class Getters {

        @Test
        @DisplayName("when fields set then getters return correct values")
        void whenFieldsSet_thenGettersReturnCorrectValues() throws Exception {
            // Arrange
            setField(config, "apiBaseUrl", "https://api.minut.com/v8");
            setField(config, "clientId", "minut-client-id");
            setField(config, "clientSecret", "minut-secret");
            setField(config, "redirectUri", "https://example.com/minut/callback");
            setField(config, "authorizationUrl", "https://api.minut.com/v8/oauth/authorize");
            setField(config, "tokenUrl", "https://api.minut.com/v8/oauth/token");
            setField(config, "scopes", "read,write");
            setField(config, "webhookSecret", "minut-webhook-secret");

            // Act & Assert
            assertThat(config.getApiBaseUrl()).isEqualTo("https://api.minut.com/v8");
            assertThat(config.getClientId()).isEqualTo("minut-client-id");
            assertThat(config.getClientSecret()).isEqualTo("minut-secret");
            assertThat(config.getRedirectUri()).isEqualTo("https://example.com/minut/callback");
            assertThat(config.getAuthorizationUrl()).isEqualTo("https://api.minut.com/v8/oauth/authorize");
            assertThat(config.getTokenUrl()).isEqualTo("https://api.minut.com/v8/oauth/token");
            assertThat(config.getScopes()).isEqualTo("read,write");
            assertThat(config.getWebhookSecret()).isEqualTo("minut-webhook-secret");
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
        @DisplayName("when clientId is null then returns false")
        void whenClientIdNull_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "clientId", null);
            setField(config, "clientSecret", "secret");
            setField(config, "redirectUri", "uri");

            // Act & Assert
            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when clientSecret is empty then returns false")
        void whenClientSecretEmpty_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "clientId", "id");
            setField(config, "clientSecret", "");
            setField(config, "redirectUri", "uri");

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
