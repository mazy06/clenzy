package com.clenzy.integration.agoda.service;

import com.clenzy.integration.agoda.config.AgodaConfig;
import com.clenzy.integration.agoda.dto.AgodaAvailabilityDto;
import com.clenzy.integration.agoda.dto.AgodaReservationDto;
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
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link AgodaApiClient}.
 *
 * Covers REST verbs (GET/PUT), the dual API key + secret headers, URL
 * construction with `from=` / `to=` query parameters and exception
 * propagation.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AgodaApiClient")
class AgodaApiClientTest {

    @Mock private AgodaConfig config;
    @Mock private RestTemplate restTemplate;

    private AgodaApiClient client;

    private static final String API_BASE = "https://supply-api.agoda.com/api/v3";
    private static final String PROPERTY_ID = "agoda-prop-1";
    private static final String API_KEY = "ak";
    private static final String API_SECRET = "as";

    @BeforeEach
    void setUp() {
        client = new AgodaApiClient(config, restTemplate);
    }

    private void stubBaseAndAuth() {
        when(config.getApiBaseUrl()).thenReturn(API_BASE);
        when(config.getApiKey()).thenReturn(API_KEY);
        when(config.getApiSecret()).thenReturn(API_SECRET);
    }

    private AgodaAvailabilityDto availability(LocalDate date) {
        return new AgodaAvailabilityDto(PROPERTY_ID, "rt-1", date, true,
                BigDecimal.valueOf(150), "USD", 5, 1, 30, false, false);
    }

    // ─── getAvailability ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getAvailability")
    class GetAvailability {

        @Test
        @DisplayName("returns parsed list on 200")
        void returns200() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of(availability(LocalDate.of(2026, 6, 1)))));

            List<AgodaAvailabilityDto> result = client.getAvailability(PROPERTY_ID,
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

            List<AgodaAvailabilityDto> result = client.getAvailability(PROPERTY_ID,
                    LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("URL contains property ID + from/to params")
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
            assertThat(url).contains("from=2026-06-01");
            assertThat(url).contains("to=2026-06-30");
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagates() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenThrow(new RestClientException("boom"));

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
        @DisplayName("calls PUT")
        void puts() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(Void.class)))
                    .thenReturn(ResponseEntity.ok().build());

            client.updateAvailability(PROPERTY_ID, List.of(availability(LocalDate.of(2026, 6, 1))));

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.PUT), any(),
                    eq(Void.class));
            assertThat(urlCap.getValue()).isEqualTo(API_BASE + "/properties/" + PROPERTY_ID
                    + "/availability");
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagates() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(Void.class)))
                    .thenThrow(new RestClientException("err"));

            assertThatThrownBy(() -> client.updateAvailability(PROPERTY_ID, List.of()))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ─── updateRates ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateRates")
    class UpdateRates {

        @Test
        @DisplayName("PUTs with body containing room_type_id and rate")
        void puts() {
            stubBaseAndAuth();
            ArgumentCaptor<HttpEntity> entityCap = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), entityCap.capture(),
                    eq(Void.class)))
                    .thenReturn(ResponseEntity.ok().build());

            client.updateRates(PROPERTY_ID, "room-1",
                    LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 10),
                    BigDecimal.valueOf(199), "EUR");

            Object body = entityCap.getValue().getBody();
            assertThat(body).isInstanceOf(Map.class);
            Map<?, ?> map = (Map<?, ?>) body;
            assertThat(map.get("room_type_id")).isEqualTo("room-1");
            assertThat(map.get("rate")).isEqualTo(BigDecimal.valueOf(199));
            assertThat(map.get("currency")).isEqualTo("EUR");
            assertThat(map.get("from")).isEqualTo("2026-06-01");
            assertThat(map.get("to")).isEqualTo("2026-06-10");
        }

        @Test
        @DisplayName("URL ends with /rates")
        void urlIsCorrect() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(Void.class)))
                    .thenReturn(ResponseEntity.ok().build());

            client.updateRates(PROPERTY_ID, "room-1",
                    LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5),
                    BigDecimal.TEN, "EUR");

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.PUT), any(),
                    eq(Void.class));
            assertThat(urlCap.getValue()).isEqualTo(API_BASE + "/properties/"
                    + PROPERTY_ID + "/rates");
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagates() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(Void.class)))
                    .thenThrow(new RestClientException("err"));

            assertThatThrownBy(() -> client.updateRates(PROPERTY_ID, "room-1",
                    LocalDate.now(), LocalDate.now().plusDays(1),
                    BigDecimal.TEN, "EUR"))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ─── getReservations ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getReservations")
    class GetReservations {

        @Test
        @DisplayName("returns parsed list on 200")
        void returns200() {
            stubBaseAndAuth();
            AgodaReservationDto r = new AgodaReservationDto(
                    "BK-1", PROPERTY_ID, "rt-1", "Tom", "tom@x.com",
                    LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5),
                    "confirmed", BigDecimal.valueOf(450), "USD", 2, null);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of(r)));

            List<AgodaReservationDto> result = client.getReservations(PROPERTY_ID,
                    LocalDate.now(), LocalDate.now().plusDays(30));

            assertThat(result).hasSize(1);
            assertThat(result.get(0).bookingId()).isEqualTo("BK-1");
        }

        @Test
        @DisplayName("returns empty when body is null")
        void nullBody() {
            stubBaseAndAuth();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(null));

            List<AgodaReservationDto> result = client.getReservations(PROPERTY_ID,
                    LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("URL contains /reservations + from/to params")
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
            assertThat(url).contains("from=2026-06-01");
            assertThat(url).contains("to=2026-06-30");
        }
    }

    // ─── Auth headers ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("auth headers")
    class AuthHeaders {

        @Test
        @DisplayName("Authorization=apikey <key> + X-Api-Secret=<secret>")
        void apiKeyAndSecret() {
            stubBaseAndAuth();
            ArgumentCaptor<HttpEntity> cap = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), cap.capture(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of()));

            client.getAvailability(PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(1));

            HttpHeaders headers = cap.getValue().getHeaders();
            assertThat(headers.getFirst("Authorization")).isEqualTo("apikey " + API_KEY);
            assertThat(headers.getFirst("X-Api-Secret")).isEqualTo(API_SECRET);
            assertThat(headers.getContentType()).isNotNull();
            assertThat(headers.getContentType().toString()).contains("application/json");
        }
    }
}
