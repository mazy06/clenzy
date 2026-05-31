package com.clenzy.integration.expedia.service;

import com.clenzy.integration.expedia.config.ExpediaConfig;
import com.clenzy.integration.expedia.dto.ExpediaAvailabilityDto;
import com.clenzy.integration.expedia.dto.ExpediaReservationDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Field;
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
 * Tests for {@link ExpediaApiClient}.
 *
 * The {@code RestTemplate} is created in the constructor so we inject a mock via reflection,
 * matching the approach used in other API client tests in this codebase.
 */
@ExtendWith(MockitoExtension.class)
class ExpediaApiClientTest {

    @Mock private ExpediaConfig config;
    @Mock private RestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ExpediaApiClient client;

    private static final String PROPERTY_ID = "prop-42";
    private static final String API_BASE = "https://services.expediapartnercentral.com";

    @BeforeEach
    void setUp() throws Exception {
        client = new ExpediaApiClient(config, objectMapper);
        injectMockRestTemplate();
    }

    private void injectMockRestTemplate() throws Exception {
        Field field = ExpediaApiClient.class.getDeclaredField("restTemplate");
        field.setAccessible(true);
        field.set(client, restTemplate);
    }

    private void stubConfigCredentials() {
        when(config.getApiKey()).thenReturn("api-key-xyz");
        when(config.getApiSecret()).thenReturn("secret-xyz");
    }

    private void stubBaseUrl() {
        when(config.getApiBaseUrl()).thenReturn(API_BASE);
    }

    // ─── getAvailability ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getAvailability")
    class GetAvailability {

        @Test
        @DisplayName("parses availability response with all fields")
        void parsesFullResponse() {
            stubConfigCredentials();
            stubBaseUrl();
            String body = "{\"availabilities\":[" +
                    "{\"roomTypeId\":\"room-1\",\"date\":\"2026-06-01\"," +
                    "\"totalInventoryAvailable\":3,\"ratePlanId\":\"rp-1\"," +
                    "\"pricePerNight\":\"129.50\",\"currency\":\"EUR\"," +
                    "\"minLOS\":2,\"maxLOS\":30," +
                    "\"closedToArrival\":true,\"closedToDeparture\":false}]}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(body));

            List<ExpediaAvailabilityDto> result = client.getAvailability(
                    PROPERTY_ID, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 2));

            assertThat(result).hasSize(1);
            ExpediaAvailabilityDto dto = result.get(0);
            assertThat(dto.propertyId()).isEqualTo(PROPERTY_ID);
            assertThat(dto.roomTypeId()).isEqualTo("room-1");
            assertThat(dto.date()).isEqualTo(LocalDate.of(2026, 6, 1));
            assertThat(dto.totalInventoryAvailable()).isEqualTo(3);
            assertThat(dto.ratePlanId()).isEqualTo("rp-1");
            assertThat(dto.pricePerNight()).isEqualByComparingTo("129.50");
            assertThat(dto.currency()).isEqualTo("EUR");
            assertThat(dto.minLOS()).isEqualTo(2);
            assertThat(dto.maxLOS()).isEqualTo(30);
            assertThat(dto.closedToArrival()).isTrue();
            assertThat(dto.closedToDeparture()).isFalse();
        }

        @Test
        @DisplayName("returns empty when no availabilities array")
        void emptyWhenNoArray() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{\"other\":1}"));

            List<ExpediaAvailabilityDto> result = client.getAvailability(
                    PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns empty when body is null")
        void emptyWhenNullBody() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(null));

            List<ExpediaAvailabilityDto> result = client.getAvailability(
                    PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns empty when body is empty string")
        void emptyWhenEmptyBody() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(""));

            List<ExpediaAvailabilityDto> result = client.getAvailability(
                    PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns empty when parsing JSON throws")
        void emptyWhenInvalidJson() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{not json"));

            List<ExpediaAvailabilityDto> result = client.getAvailability(
                    PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("uses defaults when fields are missing")
        void appliesDefaultsForMissingFields() {
            stubConfigCredentials();
            stubBaseUrl();
            String body = "{\"availabilities\":[{\"date\":\"2026-07-01\"}]}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(body));

            List<ExpediaAvailabilityDto> result = client.getAvailability(
                    PROPERTY_ID, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 2));

            assertThat(result).hasSize(1);
            ExpediaAvailabilityDto dto = result.get(0);
            assertThat(dto.totalInventoryAvailable()).isZero();
            assertThat(dto.currency()).isEqualTo("EUR");
            assertThat(dto.minLOS()).isEqualTo(1);
            assertThat(dto.maxLOS()).isEqualTo(365);
            assertThat(dto.closedToArrival()).isFalse();
            assertThat(dto.closedToDeparture()).isFalse();
            assertThat(dto.pricePerNight()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("builds URL with property + date range")
        void buildsExpectedUrl() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{}"));

            client.getAvailability(PROPERTY_ID, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 10));

            ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET), any(), eq(String.class));
            String url = urlCaptor.getValue();
            assertThat(url).contains("/v3/properties/" + PROPERTY_ID + "/availability");
            assertThat(url).contains("startDate=2026-06-01");
            assertThat(url).contains("endDate=2026-06-10");
        }

        @Test
        @DisplayName("propagates RestClientException to circuit breaker")
        void propagatesException() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenThrow(new RestClientException("network error"));

            assertThatThrownBy(() -> client.getAvailability(
                    PROPERTY_ID, LocalDate.now(), LocalDate.now().plusDays(1)))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ─── updateAvailability ────────────────────────────────────────────────

    @Nested
    @DisplayName("updateAvailability")
    class UpdateAvailability {

        @Test
        @DisplayName("returns true on 2xx response")
        void successOn2xx() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            boolean ok = client.updateAvailability(PROPERTY_ID,
                    List.of(buildAvailability(LocalDate.of(2026, 6, 1))));

            assertThat(ok).isTrue();
        }

        @Test
        @DisplayName("returns false on non-2xx response")
        void failureOnNon2xx() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("err", HttpStatus.BAD_REQUEST));

            boolean ok = client.updateAvailability(PROPERTY_ID,
                    List.of(buildAvailability(LocalDate.of(2026, 6, 1))));

            assertThat(ok).isFalse();
        }

        @Test
        @DisplayName("includes minLOS and maxLOS in payload when positive")
        void payloadIncludesLos() {
            stubConfigCredentials();
            stubBaseUrl();
            ArgumentCaptor<HttpEntity> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), captor.capture(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            ExpediaAvailabilityDto dto = buildAvailability(LocalDate.of(2026, 6, 1));
            boolean ok = client.updateAvailability(PROPERTY_ID, List.of(dto));

            assertThat(ok).isTrue();
            Object body = captor.getValue().getBody();
            assertThat(body).isInstanceOf(Map.class);
            Map<?, ?> map = (Map<?, ?>) body;
            assertThat(map.keySet()).anyMatch("availabilities"::equals);
        }

        @Test
        @DisplayName("returns false when API throws RestClientException — wrapped by circuit breaker")
        void exceptionPropagates() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenThrow(new RestClientException("net"));

            assertThatThrownBy(() -> client.updateAvailability(PROPERTY_ID,
                    List.of(buildAvailability(LocalDate.now()))))
                    .isInstanceOf(RestClientException.class);
        }

        private ExpediaAvailabilityDto buildAvailability(LocalDate date) {
            return new ExpediaAvailabilityDto(
                    PROPERTY_ID, "room-1", date,
                    5, "rate-1", new BigDecimal("120.00"), "EUR",
                    2, 14, false, false);
        }
    }

    // ─── updateRates ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateRates")
    class UpdateRates {

        @Test
        @DisplayName("returns true on 2xx")
        void successOn2xx() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            boolean ok = client.updateRates(PROPERTY_ID, "rate-plan-1",
                    List.of(Map.of("date", "2026-06-01", "rate", 150)));

            assertThat(ok).isTrue();
        }

        @Test
        @DisplayName("returns false on non-2xx")
        void failureOnNon2xx() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("err", HttpStatus.INTERNAL_SERVER_ERROR));

            boolean ok = client.updateRates(PROPERTY_ID, "rate-plan-1",
                    List.of(Map.of("date", "2026-06-01", "rate", 99)));

            assertThat(ok).isFalse();
        }

        @Test
        @DisplayName("builds URL with property + ratePlan")
        void urlContainsRatePlan() {
            stubConfigCredentials();
            stubBaseUrl();
            ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
            when(restTemplate.exchange(urlCaptor.capture(), eq(HttpMethod.PUT), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("ok"));

            client.updateRates(PROPERTY_ID, "rate-plan-42", List.of());

            String url = urlCaptor.getValue();
            assertThat(url).contains("/v3/properties/" + PROPERTY_ID);
            assertThat(url).contains("/ratePlans/rate-plan-42/rates");
        }
    }

    // ─── getReservations ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getReservations")
    class GetReservations {

        @Test
        @DisplayName("parses reservations response with all fields")
        void parsesFullResponse() {
            stubConfigCredentials();
            stubBaseUrl();
            String body = "{\"reservations\":[" +
                    "{\"reservationId\":\"res-1\",\"propertyId\":\"prop-1\",\"roomId\":\"room-1\"," +
                    "\"guestFirstName\":\"John\",\"guestLastName\":\"Doe\",\"guestEmail\":\"j@d.com\"," +
                    "\"checkIn\":\"2026-06-01\",\"checkOut\":\"2026-06-05\",\"status\":\"CONFIRMED\"," +
                    "\"totalAmount\":\"600.00\",\"currency\":\"EUR\"," +
                    "\"numberOfAdults\":2,\"numberOfChildren\":1," +
                    "\"specialRequests\":\"late check-in\",\"source\":\"VRBO\"}]}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(body));

            List<ExpediaReservationDto> result = client.getReservations(
                    "prop-1", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 7, 1));

            assertThat(result).hasSize(1);
            ExpediaReservationDto r = result.get(0);
            assertThat(r.reservationId()).isEqualTo("res-1");
            assertThat(r.propertyId()).isEqualTo("prop-1");
            assertThat(r.guestFirstName()).isEqualTo("John");
            assertThat(r.guestLastName()).isEqualTo("Doe");
            assertThat(r.totalAmount()).isEqualByComparingTo("600.00");
            assertThat(r.numberOfAdults()).isEqualTo(2);
            assertThat(r.numberOfChildren()).isEqualTo(1);
            assertThat(r.source()).isEqualTo("VRBO");
        }

        @Test
        @DisplayName("returns empty when no reservations key")
        void emptyWhenNoArray() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{}"));

            List<ExpediaReservationDto> result = client.getReservations(
                    "prop-1", LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns empty when invalid JSON")
        void emptyWhenInvalidJson() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("garbage"));

            List<ExpediaReservationDto> result = client.getReservations(
                    "prop-1", LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns empty when body is null")
        void emptyWhenNullBody() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(null));

            List<ExpediaReservationDto> result = client.getReservations(
                    "prop-1", LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("defaults applied for missing fields")
        void defaultsApplied() {
            stubConfigCredentials();
            stubBaseUrl();
            String body = "{\"reservations\":[" +
                    "{\"reservationId\":\"res-2\",\"propertyId\":\"prop-2\"," +
                    "\"checkIn\":\"2026-06-01\",\"checkOut\":\"2026-06-03\"}]}";
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(body));

            List<ExpediaReservationDto> result = client.getReservations(
                    "prop-2", LocalDate.now(), LocalDate.now().plusDays(1));

            assertThat(result).hasSize(1);
            ExpediaReservationDto r = result.get(0);
            assertThat(r.status()).isEqualTo("CONFIRMED");
            assertThat(r.currency()).isEqualTo("EUR");
            assertThat(r.numberOfAdults()).isEqualTo(1);
            assertThat(r.numberOfChildren()).isZero();
            assertThat(r.source()).isEqualTo("EXPEDIA");
            assertThat(r.totalAmount()).isEqualByComparingTo("0");
        }
    }

    // ─── confirmReservation ────────────────────────────────────────────────

    @Nested
    @DisplayName("confirmReservation")
    class ConfirmReservation {

        @Test
        @DisplayName("returns true on 2xx")
        void successOn2xx() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(""));

            boolean ok = client.confirmReservation("prop-1", "res-1");

            assertThat(ok).isTrue();
        }

        @Test
        @DisplayName("returns false on non-2xx")
        void failureOnNon2xx() {
            stubConfigCredentials();
            stubBaseUrl();
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(String.class)))
                    .thenReturn(new ResponseEntity<>("nope", HttpStatus.CONFLICT));

            boolean ok = client.confirmReservation("prop-1", "res-1");

            assertThat(ok).isFalse();
        }

        @Test
        @DisplayName("URL contains reservation id + /confirm")
        void urlIsCorrect() {
            stubConfigCredentials();
            stubBaseUrl();
            ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
            when(restTemplate.exchange(urlCaptor.capture(), eq(HttpMethod.POST), any(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok(""));

            client.confirmReservation("prop-9", "res-99");

            String url = urlCaptor.getValue();
            assertThat(url).contains("/v3/properties/prop-9/reservations/res-99/confirm");
        }
    }

    // ─── Auth header building (via spy on exchanged headers) ───────────────

    @Nested
    @DisplayName("Authentication headers")
    class AuthHeaders {

        @Test
        @DisplayName("sets EAN authorization header with apikey + signature + timestamp")
        void authHeaderFormatIsEan() {
            stubConfigCredentials();
            stubBaseUrl();
            ArgumentCaptor<HttpEntity> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), captor.capture(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{}"));

            client.getAvailability("prop-x", LocalDate.now(), LocalDate.now().plusDays(1));

            HttpHeaders headers = captor.getValue().getHeaders();
            String auth = headers.getFirst("Authorization");
            assertThat(auth).isNotNull();
            assertThat(auth).startsWith("EAN apikey=api-key-xyz");
            assertThat(auth).contains("signature=");
            assertThat(auth).contains("timestamp=");
        }

        @Test
        @DisplayName("Content-Type and Accept set to application/json")
        void contentTypeIsJson() {
            stubConfigCredentials();
            stubBaseUrl();
            ArgumentCaptor<HttpEntity> captor = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), captor.capture(), eq(String.class)))
                    .thenReturn(ResponseEntity.ok("{}"));

            client.getAvailability("prop-x", LocalDate.now(), LocalDate.now().plusDays(1));

            HttpHeaders headers = captor.getValue().getHeaders();
            assertThat(headers.getContentType()).isNotNull();
            assertThat(headers.getContentType().toString()).contains("application/json");
            assertThat(headers.getAccept()).isNotEmpty();
        }
    }
}
