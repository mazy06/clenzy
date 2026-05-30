package com.clenzy.integration.tripadvisor.service;

import com.clenzy.integration.tripadvisor.config.TripAdvisorConfig;
import com.clenzy.integration.tripadvisor.dto.TripAdvisorBookingDto;
import com.clenzy.integration.tripadvisor.model.TripAdvisorConnection;
import com.clenzy.integration.tripadvisor.model.TripAdvisorConnection.TripAdvisorConnectionStatus;
import com.clenzy.integration.tripadvisor.repository.TripAdvisorConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TripAdvisorSyncServiceTest {

    @Mock private TripAdvisorConfig config;
    @Mock private TripAdvisorApiClient apiClient;
    @Mock private TripAdvisorConnectionRepository connectionRepository;

    private TripAdvisorSyncService service;

    @BeforeEach
    void setUp() {
        service = new TripAdvisorSyncService(config, apiClient, connectionRepository);
    }

    private TripAdvisorConnection createConnection(Long orgId, String partnerId, TripAdvisorConnectionStatus status) {
        TripAdvisorConnection c = new TripAdvisorConnection(orgId, partnerId);
        c.setId(orgId);
        c.setStatus(status);
        return c;
    }

    @Nested
    @DisplayName("pushAvailability")
    class PushAvailability {

        @Test
        @DisplayName("returns -1 when no connection exists for org")
        void noConnection_returnsMinusOne() {
            when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

            int result = service.pushAvailability(1L,
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 2, 1));

            assertThat(result).isEqualTo(-1);
            verifyNoInteractions(apiClient);
        }

        @Test
        @DisplayName("returns -1 when connection is INACTIVE")
        void inactiveConnection_returnsMinusOne() {
            TripAdvisorConnection conn = createConnection(1L, "partner-1",
                    TripAdvisorConnectionStatus.INACTIVE);
            when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.of(conn));

            int result = service.pushAvailability(1L,
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 2, 1));

            assertThat(result).isEqualTo(-1);
            verifyNoInteractions(apiClient);
        }

        @Test
        @DisplayName("calls apiClient.pushAvailability and updates lastSyncAt on active connection")
        void activeConnection_pushesAndStamps() {
            TripAdvisorConnection conn = createConnection(1L, "partner-1",
                    TripAdvisorConnectionStatus.ACTIVE);
            when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.of(conn));

            int result = service.pushAvailability(1L,
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 2, 1));

            assertThat(result).isEqualTo(0); // placeholder empty availability list
            verify(apiClient).pushAvailability(eq("partner-1"), anyList());
            verify(connectionRepository).save(conn);
            assertThat(conn.getLastSyncAt()).isNotNull();
        }

        @Test
        @DisplayName("returns -1 when connection is ERROR")
        void errorConnection_returnsMinusOne() {
            TripAdvisorConnection conn = createConnection(1L, "partner-1",
                    TripAdvisorConnectionStatus.ERROR);
            when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.of(conn));

            int result = service.pushAvailability(1L,
                    LocalDate.of(2025, 1, 1), LocalDate.of(2025, 2, 1));

            assertThat(result).isEqualTo(-1);
        }
    }

    @Nested
    @DisplayName("pullBookings")
    class PullBookings {

        @Test
        @DisplayName("returns empty list when no connection")
        void noConnection_emptyList() {
            when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.empty());

            List<TripAdvisorBookingDto> result = service.pullBookings(1L);

            assertThat(result).isEmpty();
            verifyNoInteractions(apiClient);
        }

        @Test
        @DisplayName("returns empty list when connection inactive")
        void inactiveConnection_emptyList() {
            TripAdvisorConnection conn = createConnection(1L, "partner-1",
                    TripAdvisorConnectionStatus.INACTIVE);
            when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.of(conn));

            List<TripAdvisorBookingDto> result = service.pullBookings(1L);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns bookings from api when connection active and updates lastSync")
        void activeConnection_returnsBookings() {
            TripAdvisorConnection conn = createConnection(1L, "partner-1",
                    TripAdvisorConnectionStatus.ACTIVE);
            when(connectionRepository.findByOrganizationId(1L)).thenReturn(Optional.of(conn));
            when(apiClient.getBookings("partner-1")).thenReturn(List.of());

            List<TripAdvisorBookingDto> result = service.pullBookings(1L);

            assertThat(result).isEmpty();
            verify(connectionRepository).save(conn);
            assertThat(conn.getLastSyncAt()).isNotNull();
        }
    }

    @Nested
    @DisplayName("handleBookingWebhook")
    class HandleBookingWebhook {

        @Test
        @DisplayName("dispatches booking.created event without throwing")
        void bookingCreated_handles() {
            service.handleBookingWebhook("booking.created",
                    Map.of("booking_id", "TA-123"), 1L);

            // Currently placeholder implementation, just verify no throw and no repo call
            verifyNoInteractions(connectionRepository, apiClient);
        }

        @Test
        @DisplayName("dispatches booking.modified event")
        void bookingModified_handles() {
            service.handleBookingWebhook("booking.modified",
                    Map.of("booking_id", "TA-456"), 1L);
            verifyNoInteractions(connectionRepository, apiClient);
        }

        @Test
        @DisplayName("dispatches booking.cancelled event")
        void bookingCancelled_handles() {
            service.handleBookingWebhook("booking.cancelled",
                    Map.of("booking_id", "TA-789"), 1L);
            verifyNoInteractions(connectionRepository, apiClient);
        }

        @Test
        @DisplayName("logs warning on unknown event type without throwing")
        void unknownEvent_ignored() {
            // Should not throw on unknown event type
            service.handleBookingWebhook("booking.unknown_event", Map.of(), 1L);
        }

        @Test
        @DisplayName("handles null booking_id gracefully")
        void nullBookingId_handles() {
            // Passing empty map - the handlers cast null to String
            service.handleBookingWebhook("booking.created", Map.of(), 1L);
        }
    }
}
