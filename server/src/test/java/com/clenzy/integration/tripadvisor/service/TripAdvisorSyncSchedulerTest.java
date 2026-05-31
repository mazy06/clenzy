package com.clenzy.integration.tripadvisor.service;

import com.clenzy.integration.tripadvisor.config.TripAdvisorConfig;
import com.clenzy.integration.tripadvisor.model.TripAdvisorConnection;
import com.clenzy.integration.tripadvisor.repository.TripAdvisorConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link TripAdvisorSyncScheduler}.
 * Validates feature flag gating and per-organisation error isolation
 * for push availability and pull bookings.
 */
@ExtendWith(MockitoExtension.class)
class TripAdvisorSyncSchedulerTest {

    @Mock private TripAdvisorConfig config;
    @Mock private TripAdvisorConnectionRepository connectionRepository;
    @Mock private TripAdvisorSyncService syncService;

    private TripAdvisorSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new TripAdvisorSyncScheduler(config, connectionRepository, syncService);
    }

    private TripAdvisorConnection createConnection(Long orgId, String partnerId) {
        TripAdvisorConnection connection = new TripAdvisorConnection();
        connection.setId(orgId);
        connection.setOrganizationId(orgId);
        connection.setPartnerId(partnerId);
        connection.setStatus(TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE);
        return connection;
    }

    @Nested
    @DisplayName("pushAvailability")
    class PushAvailability {

        @Test
        void whenNotConfigured_thenSkips() {
            when(config.isConfigured()).thenReturn(false);

            scheduler.pushAvailability();

            verifyNoInteractions(connectionRepository, syncService);
        }

        @Test
        void whenNoActiveConnections_thenDoesNothing() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            scheduler.pushAvailability();

            verify(syncService, never()).pushAvailability(anyLong(), any(), any());
        }

        @Test
        void whenActiveConnections_thenPushesEach() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE))
                    .thenReturn(List.of(
                            createConnection(1L, "partner-1"),
                            createConnection(2L, "partner-2")));
            when(syncService.pushAvailability(anyLong(), any(LocalDate.class), any(LocalDate.class)))
                    .thenReturn(10);

            scheduler.pushAvailability();

            verify(syncService).pushAvailability(eq(1L), any(), any());
            verify(syncService).pushAvailability(eq(2L), any(), any());
            verify(syncService, times(2)).pushAvailability(anyLong(), any(), any());
        }

        @Test
        void whenOneOrgFails_thenContinuesWithOthers() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE))
                    .thenReturn(List.of(
                            createConnection(1L, "partner-1"),
                            createConnection(2L, "partner-2")));
            when(syncService.pushAvailability(eq(1L), any(), any()))
                    .thenThrow(new RuntimeException("403"));
            when(syncService.pushAvailability(eq(2L), any(), any())).thenReturn(0);

            scheduler.pushAvailability();

            verify(syncService, times(2)).pushAvailability(anyLong(), any(), any());
        }

        @Test
        void whenSyncReturnsNegative_thenStillIteratesAllConnections() {
            // -1 means no connection in service layer; scheduler still iterates.
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE))
                    .thenReturn(List.of(createConnection(1L, "partner-1")));
            when(syncService.pushAvailability(anyLong(), any(), any())).thenReturn(-1);

            scheduler.pushAvailability();

            verify(syncService).pushAvailability(eq(1L), any(), any());
        }
    }

    @Nested
    @DisplayName("pullBookings")
    class PullBookings {

        @Test
        void whenNotConfigured_thenSkips() {
            when(config.isConfigured()).thenReturn(false);

            scheduler.pullBookings();

            verifyNoInteractions(connectionRepository, syncService);
        }

        @Test
        void whenNoActiveConnections_thenDoesNothing() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            scheduler.pullBookings();

            verify(syncService, never()).pullBookings(anyLong());
        }

        @Test
        void whenActiveConnections_thenPullsEach() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE))
                    .thenReturn(List.of(
                            createConnection(1L, "partner-1"),
                            createConnection(2L, "partner-2")));

            scheduler.pullBookings();

            verify(syncService).pullBookings(1L);
            verify(syncService).pullBookings(2L);
        }

        @Test
        void whenOneOrgFails_thenContinuesWithOthers() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    TripAdvisorConnection.TripAdvisorConnectionStatus.ACTIVE))
                    .thenReturn(List.of(
                            createConnection(1L, "partner-1"),
                            createConnection(2L, "partner-2")));
            when(syncService.pullBookings(1L)).thenThrow(new RuntimeException("rate limit"));

            scheduler.pullBookings();

            verify(syncService).pullBookings(1L);
            verify(syncService).pullBookings(2L);
        }
    }
}
