package com.clenzy.integration.minut.service;

import com.clenzy.integration.minut.config.MinutConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link MinutApiService}.
 * Covers device retrieval, sound levels, homes, events, disturbance config,
 * and webhook creation via the Minut REST API.
 */
@ExtendWith(MockitoExtension.class)
class MinutApiServiceTest {

    @Mock private MinutConfig config;
    @Mock private MinutOAuthService oAuthService;
    @Mock private RestTemplate restTemplate;

    private MinutApiService service;

    @BeforeEach
    void setUp() {
        service = new MinutApiService(config, oAuthService, restTemplate);
    }

    private void stubTokenAndBaseUrl() {
        when(oAuthService.getValidAccessToken("user-1")).thenReturn("access-token-123");
        when(config.getApiBaseUrl()).thenReturn("https://api.minut.com/v8");
    }

    @SuppressWarnings("unchecked")
    private void stubGetResponse(Map<String, Object> responseBody) {
        ResponseEntity<Map<String, Object>> response = new ResponseEntity<>(responseBody, HttpStatus.OK);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                any(ParameterizedTypeReference.class))).thenReturn(response);
    }

    @SuppressWarnings("unchecked")
    private void stubPostResponse(Map<String, Object> responseBody) {
        ResponseEntity<Map<String, Object>> response = new ResponseEntity<>(responseBody, HttpStatus.OK);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class),
                any(ParameterizedTypeReference.class))).thenReturn(response);
    }

    @SuppressWarnings("unchecked")
    private void stubPutResponse(Map<String, Object> responseBody) {
        ResponseEntity<Map<String, Object>> response = new ResponseEntity<>(responseBody, HttpStatus.OK);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(HttpEntity.class),
                any(ParameterizedTypeReference.class))).thenReturn(response);
    }

    // ===================================================================
    // getDevice
    // ===================================================================

    @Nested
    @DisplayName("getDevice")
    class GetDevice {

        @Test
        @DisplayName("returns device data on happy path")
        void whenDeviceExists_thenReturnsData() {
            // Arrange
            stubTokenAndBaseUrl();
            Map<String, Object> deviceData = Map.of("device_id", "dev-1", "name", "Sensor A");
            stubGetResponse(deviceData);

            // Act
            Map<String, Object> result = service.getDevice("user-1", "dev-1");

            // Assert
            assertThat(result).containsEntry("device_id", "dev-1");
            assertThat(result).containsEntry("name", "Sensor A");
        }

        @SuppressWarnings("unchecked")
        @Test
        @DisplayName("throws RuntimeException when API call fails")
        void whenApiError_thenThrowsRuntimeException() {
            // Arrange
            stubTokenAndBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class),
                    any(ParameterizedTypeReference.class)))
                    .thenThrow(new RestClientException("Connection refused"));

            // Act & Assert
            assertThatThrownBy(() -> service.getDevice("user-1", "dev-1"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Erreur appel API Minut");
        }
    }

    // ===================================================================
    // getSoundLevels
    // ===================================================================

    @Nested
    @DisplayName("getSoundLevels")
    class GetSoundLevels {

        @Test
        @DisplayName("returns sound level data with query params")
        void whenCalled_thenReturnsData() {
            // Arrange
            stubTokenAndBaseUrl();
            Map<String, Object> soundData = Map.of("values", List.of(42, 55, 38));
            stubGetResponse(soundData);

            // Act
            Map<String, Object> result = service.getSoundLevels(
                    "user-1", "dev-1", "2025-01-01T00:00:00Z", "2025-01-02T00:00:00Z", 1800);

            // Assert
            assertThat(result).containsKey("values");
            verify(restTemplate).exchange(
                    contains("/devices/dev-1/sound_level_dba?start_at="),
                    eq(HttpMethod.GET), any(HttpEntity.class), any(ParameterizedTypeReference.class));
        }
    }

    // ===================================================================
    // getOrganizationHomes
    // ===================================================================

    @Nested
    @DisplayName("getOrganizationHomes")
    class GetOrganizationHomes {

        @Test
        @DisplayName("returns homes for organization")
        void whenCalled_thenReturnsHomes() {
            // Arrange
            stubTokenAndBaseUrl();
            Map<String, Object> homesData = Map.of("homes", List.of(Map.of("id", "home-1")));
            stubGetResponse(homesData);

            // Act
            Map<String, Object> result = service.getOrganizationHomes("user-1", "org-42");

            // Assert
            assertThat(result).containsKey("homes");
            verify(restTemplate).exchange(
                    contains("/organizations/org-42/homes"),
                    eq(HttpMethod.GET), any(HttpEntity.class), any(ParameterizedTypeReference.class));
        }
    }

    // ===================================================================
    // getHome
    // ===================================================================

    @Nested
    @DisplayName("getHome")
    class GetHome {

        @Test
        @DisplayName("returns home details")
        void whenCalled_thenReturnsHomeDetails() {
            // Arrange
            stubTokenAndBaseUrl();
            Map<String, Object> homeData = Map.of("home_id", "home-1", "name", "Beach House");
            stubGetResponse(homeData);

            // Act
            Map<String, Object> result = service.getHome("user-1", "home-1");

            // Assert
            assertThat(result).containsEntry("home_id", "home-1");
            verify(restTemplate).exchange(
                    contains("/homes/home-1"),
                    eq(HttpMethod.GET), any(HttpEntity.class), any(ParameterizedTypeReference.class));
        }
    }

    // ===================================================================
    // getHomeEvents
    // ===================================================================

    @Nested
    @DisplayName("getHomeEvents")
    class GetHomeEvents {

        @Test
        @DisplayName("returns events with all query parameters")
        void whenAllParamsProvided_thenBuildsCompleteUrl() {
            // Arrange
            stubTokenAndBaseUrl();
            Map<String, Object> eventsData = Map.of("events", List.of());
            stubGetResponse(eventsData);

            // Act
            Map<String, Object> result = service.getHomeEvents(
                    "user-1", "home-1", "2025-01-01", "2025-01-31", "noise");

            // Assert
            assertThat(result).containsKey("events");
            verify(restTemplate).exchange(
                    (String) argThat(url -> url != null && url.toString().contains("/homes/home-1/events")
                            && url.toString().contains("start_at=2025-01-01")
                            && url.toString().contains("end_at=2025-01-31")
                            && url.toString().contains("event_type=noise")),
                    eq(HttpMethod.GET), any(HttpEntity.class), any(ParameterizedTypeReference.class));
        }

        @Test
        @DisplayName("handles null optional parameters")
        void whenNullOptionalParams_thenOmitsFromUrl() {
            // Arrange
            stubTokenAndBaseUrl();
            Map<String, Object> eventsData = Map.of("events", List.of());
            stubGetResponse(eventsData);

            // Act
            Map<String, Object> result = service.getHomeEvents(
                    "user-1", "home-1", null, null, null);

            // Assert
            assertThat(result).containsKey("events");
            verify(restTemplate).exchange(
                    (String) argThat(url -> url != null && url.toString().contains("/homes/home-1/events?limit=50")
                            && !url.toString().contains("start_at")
                            && !url.toString().contains("end_at")
                            && !url.toString().contains("event_type")),
                    eq(HttpMethod.GET), any(HttpEntity.class), any(ParameterizedTypeReference.class));
        }
    }

    // ===================================================================
    // getDisturbanceConfig
    // ===================================================================

    @Nested
    @DisplayName("getDisturbanceConfig")
    class GetDisturbanceConfig {

        @Test
        @DisplayName("returns disturbance config for a home")
        void whenCalled_thenReturnsConfig() {
            // Arrange
            stubTokenAndBaseUrl();
            Map<String, Object> configData = Map.of("noise_threshold", 70);
            stubGetResponse(configData);

            // Act
            Map<String, Object> result = service.getDisturbanceConfig("user-1", "home-1");

            // Assert
            assertThat(result).containsEntry("noise_threshold", 70);
        }
    }

    // ===================================================================
    // updateDisturbanceConfig
    // ===================================================================

    @Nested
    @DisplayName("updateDisturbanceConfig")
    class UpdateDisturbanceConfig {

        @Test
        @DisplayName("sends PUT and returns updated config")
        void whenCalled_thenUpdatesAndReturns() {
            // Arrange
            stubTokenAndBaseUrl();
            Map<String, Object> updatedConfig = Map.of("noise_threshold", 80);
            stubPutResponse(updatedConfig);
            Map<String, Object> inputConfig = Map.of("noise_threshold", 80);

            // Act
            Map<String, Object> result = service.updateDisturbanceConfig("user-1", "home-1", inputConfig);

            // Assert
            assertThat(result).containsEntry("noise_threshold", 80);
            verify(restTemplate).exchange(
                    contains("/homes/home-1/disturbance"),
                    eq(HttpMethod.PUT), any(HttpEntity.class), any(ParameterizedTypeReference.class));
        }
    }

    // ===================================================================
    // createWebhook
    // ===================================================================

    @Nested
    @DisplayName("createWebhook")
    class CreateWebhook {

        @Test
        @DisplayName("sends POST with url and event_types")
        void whenCalled_thenCreatesWebhook() {
            // Arrange
            stubTokenAndBaseUrl();
            Map<String, Object> webhookResponse = Map.of("id", "wh-1", "url", "https://clenzy.fr/webhook");
            stubPostResponse(webhookResponse);

            // Act
            Map<String, Object> result = service.createWebhook(
                    "user-1", "https://clenzy.fr/webhook", List.of("noise", "temperature"));

            // Assert
            assertThat(result).containsEntry("id", "wh-1");
            verify(restTemplate).exchange(
                    contains("/webhooks"),
                    eq(HttpMethod.POST), any(HttpEntity.class), any(ParameterizedTypeReference.class));
        }
    }
}
