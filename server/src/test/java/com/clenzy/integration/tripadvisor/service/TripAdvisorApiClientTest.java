package com.clenzy.integration.tripadvisor.service;

import com.clenzy.integration.tripadvisor.config.TripAdvisorConfig;
import com.clenzy.integration.tripadvisor.dto.TripAdvisorAvailabilityDto;
import com.clenzy.integration.tripadvisor.dto.TripAdvisorBookingDto;
import com.clenzy.integration.tripadvisor.dto.TripAdvisorListingDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Tests unitaires pour {@link TripAdvisorApiClient}.
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>Court-circuit quand TripAdvisor non configure (config.isConfigured == false)</li>
 *   <li>Execution sans erreur quand configure (les methodes sont stubs/TODO mais doivent traverser)</li>
 *   <li>Fallbacks circuit breaker accessibles par reflexion</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class TripAdvisorApiClientTest {

    @Mock
    private TripAdvisorConfig config;

    private TripAdvisorApiClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        // Even if config.getApiBaseUrl returns null, baseUrl(null) is illegal; use a fake url
        lenient().when(config.getApiBaseUrl()).thenReturn("https://api.tripadvisor.example/v1");
        client = new TripAdvisorApiClient(config, builder);
    }

    // ─── pushAvailability ────────────────────────────────────────────────

    @Test
    @DisplayName("pushAvailability does nothing when not configured")
    void pushAvailability_notConfigured_noOp() {
        when(config.isConfigured()).thenReturn(false);

        // Should not throw
        client.pushAvailability("partner-1",
                List.of(new TripAdvisorAvailabilityDto("list1", LocalDate.now(), true,
                        BigDecimal.valueOf(100), "EUR", 2)));
        // No assertions on side-effects: just exercising the no-op path.
    }

    @Test
    @DisplayName("pushAvailability runs through when configured (TODO body, exercises log/empty loop)")
    void pushAvailability_configured_noException() {
        when(config.isConfigured()).thenReturn(true);

        List<TripAdvisorAvailabilityDto> availability = List.of(
                new TripAdvisorAvailabilityDto("list1", LocalDate.now(), true,
                        BigDecimal.valueOf(100), "EUR", 2),
                new TripAdvisorAvailabilityDto("list2", LocalDate.now().plusDays(1), false,
                        BigDecimal.valueOf(150), "EUR", 1)
        );

        // Should not throw — body is a TODO log only
        client.pushAvailability("partner-1", availability);
    }

    // ─── getBookings ─────────────────────────────────────────────────────

    @Test
    @DisplayName("getBookings returns empty list when not configured")
    void getBookings_notConfigured_returnsEmptyList() {
        when(config.isConfigured()).thenReturn(false);

        List<TripAdvisorBookingDto> result = client.getBookings("partner-x");

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("getBookings returns empty list when configured (TODO body)")
    void getBookings_configured_returnsEmptyListForNow() {
        when(config.isConfigured()).thenReturn(true);

        List<TripAdvisorBookingDto> result = client.getBookings("partner-x");

        assertThat(result).isEmpty();
    }

    // ─── pushListingData ─────────────────────────────────────────────────

    @Test
    @DisplayName("pushListingData does nothing when not configured")
    void pushListingData_notConfigured_noOp() {
        when(config.isConfigured()).thenReturn(false);

        TripAdvisorListingDto listing = new TripAdvisorListingDto(
                "tl-1", "p-1", "Villa Test", "desc", "VILLA", 6, 3, 2,
                List.of("WIFI", "POOL"));

        client.pushListingData("partner-1", listing);
        // No exception expected
    }

    @Test
    @DisplayName("pushListingData runs through when configured")
    void pushListingData_configured_noException() {
        when(config.isConfigured()).thenReturn(true);

        TripAdvisorListingDto listing = new TripAdvisorListingDto(
                "tl-1", "p-1", "Villa Test", "desc", "VILLA", 6, 3, 2,
                List.of("WIFI", "POOL"));

        client.pushListingData("partner-1", listing);
    }

    // ─── updateBookingStatus ─────────────────────────────────────────────

    @Test
    @DisplayName("updateBookingStatus does nothing when not configured")
    void updateBookingStatus_notConfigured_noOp() {
        when(config.isConfigured()).thenReturn(false);

        client.updateBookingStatus("partner-1", "BK-001", "CANCELLED");
    }

    @Test
    @DisplayName("updateBookingStatus runs through when configured")
    void updateBookingStatus_configured_noException() {
        when(config.isConfigured()).thenReturn(true);

        client.updateBookingStatus("partner-1", "BK-001", "CONFIRMED");
    }

    // ─── Fallback methods (circuit breaker) ──────────────────────────────

    @Test
    @DisplayName("pushAvailabilityFallback logs and returns void (accessible via reflection)")
    void pushAvailabilityFallback_invokesWithoutException() throws Exception {
        Method m = TripAdvisorApiClient.class.getDeclaredMethod(
                "pushAvailabilityFallback", String.class, List.class, Throwable.class);
        m.setAccessible(true);
        // Should not throw
        m.invoke(client, "partner-1", List.<TripAdvisorAvailabilityDto>of(),
                new RuntimeException("circuit-open"));
    }

    @Test
    @DisplayName("getBookingsFallback returns empty list")
    void getBookingsFallback_returnsEmptyList() throws Exception {
        Method m = TripAdvisorApiClient.class.getDeclaredMethod(
                "getBookingsFallback", String.class, Throwable.class);
        m.setAccessible(true);

        @SuppressWarnings("unchecked")
        List<TripAdvisorBookingDto> result =
                (List<TripAdvisorBookingDto>) m.invoke(client, "partner-1",
                        new RuntimeException("fail"));

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("pushListingDataFallback logs and returns void")
    void pushListingDataFallback_invokesWithoutException() throws Exception {
        Method m = TripAdvisorApiClient.class.getDeclaredMethod(
                "pushListingDataFallback", String.class, TripAdvisorListingDto.class, Throwable.class);
        m.setAccessible(true);
        TripAdvisorListingDto listing = new TripAdvisorListingDto(
                "tl-1", "p-1", "Test", "desc", "VILLA", 4, 2, 1, List.of());

        m.invoke(client, "partner-1", listing, new RuntimeException("circuit-open"));
    }

    @Test
    @DisplayName("updateBookingStatusFallback logs and returns void")
    void updateBookingStatusFallback_invokesWithoutException() throws Exception {
        Method m = TripAdvisorApiClient.class.getDeclaredMethod(
                "updateBookingStatusFallback", String.class, String.class, String.class, Throwable.class);
        m.setAccessible(true);

        m.invoke(client, "partner-1", "BK-001", "CONFIRMED",
                new RuntimeException("circuit-open"));
    }

    // ─── Internal state ──────────────────────────────────────────────────

    @Test
    @DisplayName("constructor stores config and creates RestClient")
    void constructor_storesDependencies() {
        Object storedConfig = ReflectionTestUtils.getField(client, "config");
        Object storedClient = ReflectionTestUtils.getField(client, "restClient");

        assertThat(storedConfig).isSameAs(config);
        assertThat(storedClient).isNotNull();
    }
}
