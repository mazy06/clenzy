package com.clenzy.integration.hotelscom.service;

import com.clenzy.integration.hotelscom.config.HotelsComConfig;
import com.clenzy.integration.hotelscom.dto.HotelsComAvailabilityDto;
import com.clenzy.integration.hotelscom.dto.HotelsComReservationDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link HotelsComApiClient}.
 *
 * Covers REST verbs (GET/PUT/POST), Basic auth header (apiKey:secret base64),
 * URL construction, exception propagation, and null body handling.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("HotelsComApiClient")
class HotelsComApiClientTest {

    @Mock private HotelsComConfig config;
    @Mock private RestTemplate restTemplate;

    private HotelsComApiClient client;

    private static final String API_BASE = "https://services.expediapartnercentral.com";
    private static final String PROPERTY_ID = "prop-99";
    private static final String API_KEY = "k";
    private static final String API_SECRET = "s";

    @BeforeEach
    void setUp() {
        client = new HotelsComApiClient(config, restTemplate);
    }

    private void stubBaseAndAuth() {
        when(config.getApiBaseUrl()).thenReturn(API_BASE);
        when(config.getApiKey()).thenReturn(API_KEY);
        when(config.getApiSecret()).thenReturn(API_SECRET);
    }

    private HotelsComAvailabilityDto availability(LocalDate date) {
        return new HotelsComAvailabilityDto(PROPERTY_ID, "room-1", "rp-1",
                date, true, BigDecimal.valueOf(120), "EUR",
                5, 1, 30, false, false);
    }

    // ─── getAvailability ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getAvailability")
    class GetAvailability {

        @Test
        @DisplayName("returns availability list on 200")
        void returns200() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of(availability(LocalDate.of(2026, 6, 1)))));

            List<HotelsComAvailabilityDto> result = client.getAvailability(PROPERTY_ID,
                    LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30));

            assertThat(result).hasSize(1);
            assertThat(result.get(0).propertyId()).isEqualTo(PROPERTY_ID);
        }

        @Test
        @DisplayName("returns empty when body is null")
        void nullBody() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(null));

            List<HotelsComAvailabilityDto> result = client.getAvailability(PROPERTY_ID,
                    LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("URL contains property ID + date range")
        void urlIsCorrect() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of()));

            client.getAvailability(PROPERTY_ID, LocalDate.of(2026, 6, 1),
                    LocalDate.of(2026, 6, 30));

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class));
            String url = urlCap.getValue();
            assertThat(url).contains("/properties/" + PROPERTY_ID + "/availability");
            assertThat(url).contains("startDate=2026-06-01");
            assertThat(url).contains("endDate=2026-06-30");
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagates() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenThrow(new RestClientException("network down"));

            assertThatThrownBy(() -> client.getAvailability(PROPERTY_ID,
                    LocalDate.now(), LocalDate.now().plusDays(1)))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ─── updateAvailability ────────────────────────────────────────────────

    @Nested
    @DisplayName("updateAvailability")
    class UpdateAvailability {

        @Test
        @DisplayName("PUTs availability list and includes URL")
        void puts() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(Void.class)))
                    .thenReturn(ResponseEntity.ok().build());

            client.updateAvailability(PROPERTY_ID, List.of(availability(LocalDate.of(2026, 6, 1))));

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.PUT), any(),
                    eq(Void.class));
            assertThat(urlCap.getValue())
                    .isEqualTo(API_BASE + "/properties/" + PROPERTY_ID + "/availability");
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagates() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(Void.class)))
                    .thenThrow(new RestClientException("net"));

            assertThatThrownBy(() -> client.updateAvailability(PROPERTY_ID, List.of()))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ─── getReservations ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getReservations")
    class GetReservations {

        @Test
        @DisplayName("returns reservations list on 200")
        void returns200() {
            stubBaseAndAuth();
            HotelsComReservationDto r = new HotelsComReservationDto(
                    "CONF-1", PROPERTY_ID, "room-1", "Jane", "Smith",
                    "jane@x.com", "+1234", LocalDate.of(2026, 6, 1),
                    LocalDate.of(2026, 6, 5), "BOOKED",
                    BigDecimal.valueOf(450), "USD", 2, 1, null, "hotels.com");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of(r)));

            List<HotelsComReservationDto> result = client.getReservations(PROPERTY_ID,
                    LocalDate.now(), LocalDate.now().plusDays(30));

            assertThat(result).hasSize(1);
            assertThat(result.get(0).confirmationNumber()).isEqualTo("CONF-1");
        }

        @Test
        @DisplayName("returns empty when body is null")
        void nullBody() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(null));

            List<HotelsComReservationDto> result = client.getReservations(PROPERTY_ID,
                    LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("URL contains property ID + date range")
        void urlIsCorrect() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of()));

            client.getReservations(PROPERTY_ID, LocalDate.of(2026, 6, 1),
                    LocalDate.of(2026, 6, 30));

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class));
            String url = urlCap.getValue();
            assertThat(url).contains("/properties/" + PROPERTY_ID + "/reservations");
            assertThat(url).contains("startDate=2026-06-01");
            assertThat(url).contains("endDate=2026-06-30");
        }
    }

    // ─── confirmReservation ────────────────────────────────────────────────

    @Nested
    @DisplayName("confirmReservation")
    class ConfirmReservation {

        @Test
        @DisplayName("POSTs confirmation URL")
        void posts() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Void.class)))
                    .thenReturn(ResponseEntity.ok().build());

            client.confirmReservation(PROPERTY_ID, "CONF-77");

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.POST), any(),
                    eq(Void.class));
            assertThat(urlCap.getValue()).isEqualTo(
                    API_BASE + "/properties/" + PROPERTY_ID + "/reservations/CONF-77/confirm");
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagates() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Void.class)))
                    .thenThrow(new RestClientException("err"));

            assertThatThrownBy(() -> client.confirmReservation(PROPERTY_ID, "C-1"))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ─── Authentication headers ────────────────────────────────────────────

    @Nested
    @DisplayName("Basic auth header")
    class AuthHeaders {

        @Test
        @DisplayName("Authorization header is Basic <base64(key:secret)>")
        void basicAuth() {
            stubBaseAndAuth();
            ArgumentCaptor<HttpEntity> cap = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), cap.capture(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of()));

            client.getAvailability(PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(1));

            HttpHeaders headers = cap.getValue().getHeaders();
            String expected = "Basic " + Base64.getEncoder().encodeToString(
                    (API_KEY + ":" + API_SECRET).getBytes(StandardCharsets.UTF_8));
            assertThat(headers.getFirst("Authorization")).isEqualTo(expected);
            assertThat(headers.getContentType()).isNotNull();
            assertThat(headers.getContentType().toString()).contains("application/json");
        }
    }
}
