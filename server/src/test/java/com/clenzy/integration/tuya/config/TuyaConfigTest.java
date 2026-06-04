package com.clenzy.integration.tuya.config;

import com.clenzy.integration.tuya.service.TuyaPlatformConfigService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TuyaConfigTest {

    @Mock private ObjectProvider<TuyaPlatformConfigService> dbProvider;
    @Mock private TuyaPlatformConfigService dbService;

    private TuyaConfig config;

    @BeforeEach
    void setUp() {
        config = new TuyaConfig(dbProvider);
    }

    // ── Repli sur les variables d'environnement (aucune config DB) ──

    @Nested
    @DisplayName("env fallback (no DB config)")
    class EnvFallback {

        @BeforeEach
        void noDbConfig() {
            lenient().when(dbProvider.getIfAvailable()).thenReturn(null);
        }

        @Test
        @DisplayName("when env fields set then getters return env values")
        void whenEnvFieldsSet_thenGettersReturnEnvValues() throws Exception {
            // Arrange
            setField(config, "apiBaseUrlEnv", "https://openapi.tuyaeu.com");
            setField(config, "regionEnv", "eu");
            setField(config, "accessIdEnv", "tuya-access-id");
            setField(config, "accessSecretEnv", "tuya-access-secret");

            // Act & Assert
            assertThat(config.getApiBaseUrl()).isEqualTo("https://openapi.tuyaeu.com");
            assertThat(config.getRegion()).isEqualTo("eu");
            assertThat(config.getAccessId()).isEqualTo("tuya-access-id");
            assertThat(config.getAccessSecret()).isEqualTo("tuya-access-secret");
            assertThat(config.isConfigured()).isTrue();
        }

        @Test
        @DisplayName("when env credentials blank then not configured")
        void whenEnvBlank_thenNotConfigured() throws Exception {
            // Arrange
            setField(config, "accessIdEnv", "");
            setField(config, "accessSecretEnv", "");

            // Act & Assert
            assertThat(config.isConfigured()).isFalse();
        }
    }

    // ── DB-first : la config en base prime sur l'environnement ──

    @Nested
    @DisplayName("DB-first")
    class DbFirst {

        @BeforeEach
        void withDbConfig() {
            lenient().when(dbProvider.getIfAvailable()).thenReturn(dbService);
        }

        @Test
        @DisplayName("when DB config present then it overrides env values")
        void whenDbPresent_thenOverridesEnv() throws Exception {
            // Arrange
            setField(config, "accessIdEnv", "env-id");
            setField(config, "accessSecretEnv", "env-secret");
            when(dbService.getAccessId()).thenReturn("db-id");
            when(dbService.getAccessSecret()).thenReturn("db-secret");
            when(dbService.getApiBaseUrl()).thenReturn("https://openapi.tuyaus.com");
            when(dbService.getRegion()).thenReturn("us");

            // Act & Assert
            assertThat(config.getAccessId()).isEqualTo("db-id");
            assertThat(config.getAccessSecret()).isEqualTo("db-secret");
            assertThat(config.getApiBaseUrl()).isEqualTo("https://openapi.tuyaus.com");
            assertThat(config.getRegion()).isEqualTo("us");
            assertThat(config.isConfigured()).isTrue();
        }

        @Test
        @DisplayName("when DB values blank then falls back to env")
        void whenDbBlank_thenFallsBackToEnv() throws Exception {
            // Arrange
            setField(config, "accessIdEnv", "env-id");
            setField(config, "accessSecretEnv", "env-secret");
            when(dbService.getAccessId()).thenReturn(null);
            when(dbService.getAccessSecret()).thenReturn("  ");

            // Act & Assert
            assertThat(config.getAccessId()).isEqualTo("env-id");
            assertThat(config.getAccessSecret()).isEqualTo("env-secret");
        }
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
