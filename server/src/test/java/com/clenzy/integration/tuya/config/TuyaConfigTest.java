package com.clenzy.integration.tuya.config;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class TuyaConfigTest {

    private TuyaConfig config;

    @BeforeEach
    void setUp() {
        config = new TuyaConfig();
    }

    @Nested
    @DisplayName("getters")
    class Getters {

        @Test
        @DisplayName("when fields set then getters return correct values")
        void whenFieldsSet_thenGettersReturnCorrectValues() throws Exception {
            // Arrange
            setField(config, "apiBaseUrl", "https://openapi.tuyaeu.com");
            setField(config, "region", "eu");
            setField(config, "accessId", "tuya-access-id");
            setField(config, "accessSecret", "tuya-access-secret");

            // Act & Assert
            assertThat(config.getApiBaseUrl()).isEqualTo("https://openapi.tuyaeu.com");
            assertThat(config.getRegion()).isEqualTo("eu");
            assertThat(config.getAccessId()).isEqualTo("tuya-access-id");
            assertThat(config.getAccessSecret()).isEqualTo("tuya-access-secret");
        }
    }

    @Nested
    @DisplayName("isConfigured")
    class IsConfigured {

        @Test
        @DisplayName("when all required fields set then returns true")
        void whenAllRequiredFieldsSet_thenReturnsTrue() throws Exception {
            // Arrange
            setField(config, "accessId", "id");
            setField(config, "accessSecret", "secret");

            // Act & Assert
            assertThat(config.isConfigured()).isTrue();
        }

        @Test
        @DisplayName("when accessId is null then returns false")
        void whenAccessIdNull_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "accessId", null);
            setField(config, "accessSecret", "secret");

            // Act & Assert
            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when accessId is empty then returns false")
        void whenAccessIdEmpty_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "accessId", "");
            setField(config, "accessSecret", "secret");

            // Act & Assert
            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when accessSecret is null then returns false")
        void whenAccessSecretNull_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "accessId", "id");
            setField(config, "accessSecret", null);

            // Act & Assert
            assertThat(config.isConfigured()).isFalse();
        }

        @Test
        @DisplayName("when accessSecret is empty then returns false")
        void whenAccessSecretEmpty_thenReturnsFalse() throws Exception {
            // Arrange
            setField(config, "accessId", "id");
            setField(config, "accessSecret", "");

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
