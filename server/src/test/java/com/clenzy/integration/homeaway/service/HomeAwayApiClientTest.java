package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.dto.HomeAwayAvailabilityDto;
import com.clenzy.integration.homeaway.dto.HomeAwayListingDto;
import com.clenzy.integration.homeaway.dto.HomeAwayReservationDto;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link HomeAwayApiClient}.
 *
 * Covers the HTTP REST API surface, the OAuth Bearer authentication header,
 * URL construction with date ranges, and exception propagation.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("HomeAwayApiClient")
class HomeAwayApiClientTest {

    @Mock private HomeAwayConfig config;
    @Mock private RestTemplate restTemplate;

    private HomeAwayApiClient client;

    private static final String LISTING_ID = "listing-42";
    private static final String API_BASE = "https://ws.homeaway.com/public";
    private static final String ACCESS_TOKEN = "ya29.access-token-xyz";

    @BeforeEach
    void setUp() {
        client = new HomeAwayApiClient(config, restTemplate);
    }

    // ─── getListing ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getListing")
    class GetListing {

        @Test
        @DisplayName("returns parsed listing on success")
        void returnsListing() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            HomeAwayListingDto dto = new HomeAwayListingDto(
                    LISTING_ID, "Studio Paris", "Cozy", "APT",
                    1, 1, 2, "5 rue de la Paix", "Paris", "FR",
                    BigDecimal.valueOf(89), "EUR", "ACTIVE");
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(HomeAwayListingDto.class)))
                    .thenReturn(ResponseEntity.ok(dto));

            HomeAwayListingDto result = client.getListing(LISTING_ID, ACCESS_TOKEN);

            assertThat(result).isNotNull();
            assertThat(result.listingId()).isEqualTo(LISTING_ID);
            assertThat(result.city()).isEqualTo("Paris");
        }

        @Test
        @DisplayName("URL is /listings/{id}")
        void buildsCorrectUrl() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(HomeAwayListingDto.class)))
                    .thenReturn(ResponseEntity.ok(null));

            client.getListing(LISTING_ID, ACCESS_TOKEN);

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.GET), any(),
                    eq(HomeAwayListingDto.class));
            assertThat(urlCap.getValue()).isEqualTo(API_BASE + "/listings/" + LISTING_ID);
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagatesException() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(HomeAwayListingDto.class)))
                    .thenThrow(new RestClientException("net down"));

            assertThatThrownBy(() -> client.getListing(LISTING_ID, ACCESS_TOKEN))
                    .isInstanceOf(RestClientException.class);
        }

        @Test
        @DisplayName("returns null body when response body is null")
        void nullBody() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(), eq(HomeAwayListingDto.class)))
                    .thenReturn(ResponseEntity.ok(null));

            HomeAwayListingDto result = client.getListing(LISTING_ID, ACCESS_TOKEN);
            assertThat(result).isNull();
        }
    }

    // ─── getAvailability ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getAvailability")
    class GetAvailability {

        @Test
        @DisplayName("returns parsed list on success")
        void returnsAvailability() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            List<HomeAwayAvailabilityDto> entries = List.of(
                    new HomeAwayAvailabilityDto(LISTING_ID, LocalDate.of(2026, 6, 1),
                            true, BigDecimal.valueOf(120), "EUR", 2, 30,
                            false, false, "SUN"));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(entries));

            List<HomeAwayAvailabilityDto> result = client.getAvailability(LISTING_ID,
                    LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), ACCESS_TOKEN);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).listingId()).isEqualTo(LISTING_ID);
        }

        @Test
        @DisplayName("returns empty list when body is null")
        void emptyOnNullBody() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(null));

            List<HomeAwayAvailabilityDto> result = client.getAvailability(LISTING_ID,
                    LocalDate.now(), LocalDate.now().plusDays(1), ACCESS_TOKEN);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("URL includes startDate and endDate")
        void buildsCorrectUrl() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of()));

            client.getAvailability(LISTING_ID, LocalDate.of(2026, 6, 1),
                    LocalDate.of(2026, 6, 30), ACCESS_TOKEN);

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class));
            String url = urlCap.getValue();
            assertThat(url).contains("/listings/" + LISTING_ID + "/availability");
            assertThat(url).contains("startDate=2026-06-01");
            assertThat(url).contains("endDate=2026-06-30");
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagatesException() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenThrow(new RestClientException("boom"));

            assertThatThrownBy(() -> client.getAvailability(LISTING_ID,
                    LocalDate.now(), LocalDate.now().plusDays(1), ACCESS_TOKEN))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ─── updateAvailability ────────────────────────────────────────────────

    @Nested
    @DisplayName("updateAvailability")
    class UpdateAvailability {

        @Test
        @DisplayName("calls PUT with body and listing URL")
        void updatesViaPut() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(Void.class)))
                    .thenReturn(ResponseEntity.ok().build());

            HomeAwayAvailabilityDto avail = new HomeAwayAvailabilityDto(LISTING_ID,
                    LocalDate.of(2026, 6, 1), true, BigDecimal.valueOf(120), "EUR",
                    2, 30, false, false, null);

            client.updateAvailability(LISTING_ID, List.of(avail), ACCESS_TOKEN);

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.PUT), any(), eq(Void.class));
            assertThat(urlCap.getValue()).endsWith("/listings/" + LISTING_ID + "/availability");
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagatesException() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.PUT), any(), eq(Void.class)))
                    .thenThrow(new RestClientException("network"));

            assertThatThrownBy(() -> client.updateAvailability(LISTING_ID, List.of(), ACCESS_TOKEN))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ─── getReservations ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getReservations")
    class GetReservations {

        @Test
        @DisplayName("returns parsed list on success")
        void returnsReservations() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            List<HomeAwayReservationDto> entries = List.of(
                    new HomeAwayReservationDto(
                            "res-1", LISTING_ID, "John", "Doe", "j@d.com", "+33611",
                            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 7),
                            "CONFIRMED", BigDecimal.valueOf(600), "EUR",
                            2, 2, 0, null));
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(entries));

            List<HomeAwayReservationDto> result = client.getReservations(LISTING_ID,
                    LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), ACCESS_TOKEN);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).reservationId()).isEqualTo("res-1");
        }

        @Test
        @DisplayName("returns empty list when body is null")
        void emptyOnNullBody() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(null));

            List<HomeAwayReservationDto> result = client.getReservations(LISTING_ID,
                    LocalDate.now(), LocalDate.now().plusDays(1), ACCESS_TOKEN);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("URL contains listing id + date range")
        void buildsCorrectUrl() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of()));

            client.getReservations(LISTING_ID, LocalDate.of(2026, 6, 1),
                    LocalDate.of(2026, 6, 30), ACCESS_TOKEN);

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.GET), any(),
                    any(ParameterizedTypeReference.class));
            String url = urlCap.getValue();
            assertThat(url).contains("/listings/" + LISTING_ID + "/reservations");
            assertThat(url).contains("startDate=2026-06-01");
            assertThat(url).contains("endDate=2026-06-30");
        }
    }

    // ─── confirmReservation ────────────────────────────────────────────────

    @Nested
    @DisplayName("confirmReservation")
    class ConfirmReservation {

        @Test
        @DisplayName("calls POST with /confirm URL")
        void confirmsViaPost() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Void.class)))
                    .thenReturn(ResponseEntity.ok().build());

            client.confirmReservation(LISTING_ID, "res-77", ACCESS_TOKEN);

            ArgumentCaptor<String> urlCap = ArgumentCaptor.forClass(String.class);
            verify(restTemplate).exchange(urlCap.capture(), eq(HttpMethod.POST), any(), eq(Void.class));
            assertThat(urlCap.getValue()).isEqualTo(
                    API_BASE + "/listings/" + LISTING_ID + "/reservations/res-77/confirm");
        }

        @Test
        @DisplayName("propagates RestClientException")
        void propagatesException() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(), eq(Void.class)))
                    .thenThrow(new RestClientException("nope"));

            assertThatThrownBy(() -> client.confirmReservation(LISTING_ID, "res-1", ACCESS_TOKEN))
                    .isInstanceOf(RestClientException.class);
        }
    }

    // ─── Authentication headers ────────────────────────────────────────────

    @Nested
    @DisplayName("buildAuthHeaders (Bearer)")
    class AuthHeaders {

        @Test
        @DisplayName("sets Authorization Bearer header on getListing")
        void bearerHeaderSetOnGet() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            ArgumentCaptor<HttpEntity> entityCap = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), entityCap.capture(),
                    eq(HomeAwayListingDto.class)))
                    .thenReturn(ResponseEntity.ok(null));

            client.getListing(LISTING_ID, ACCESS_TOKEN);

            HttpHeaders headers = entityCap.getValue().getHeaders();
            String auth = headers.getFirst("Authorization");
            assertThat(auth).isEqualTo("Bearer " + ACCESS_TOKEN);
            assertThat(headers.getContentType()).isNotNull();
            assertThat(headers.getContentType().toString()).contains("application/json");
        }

        @Test
        @DisplayName("sets Authorization Bearer header on getAvailability")
        void bearerHeaderSetOnAvailability() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            ArgumentCaptor<HttpEntity> entityCap = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), entityCap.capture(),
                    any(ParameterizedTypeReference.class)))
                    .thenReturn(ResponseEntity.ok(List.of()));

            client.getAvailability(LISTING_ID, LocalDate.now(),
                    LocalDate.now().plusDays(1), ACCESS_TOKEN);

            HttpHeaders headers = entityCap.getValue().getHeaders();
            assertThat(headers.getFirst("Authorization")).isEqualTo("Bearer " + ACCESS_TOKEN);
        }

        @Test
        @DisplayName("uses different access tokens correctly")
        void supportsDifferentTokens() {
            when(config.getApiBaseUrl()).thenReturn(API_BASE);
            ArgumentCaptor<HttpEntity> entityCap = ArgumentCaptor.forClass(HttpEntity.class);
            when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), entityCap.capture(),
                    eq(HomeAwayListingDto.class)))
                    .thenReturn(ResponseEntity.ok(null));

            client.getListing(LISTING_ID, "another-token-zzz");

            String auth = entityCap.getValue().getHeaders().getFirst("Authorization");
            assertThat(auth).isEqualTo("Bearer another-token-zzz");
        }
    }
}
