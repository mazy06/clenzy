package com.clenzy.integration.google.service;

import com.clenzy.integration.google.config.GoogleVacationRentalsConfig;
import com.clenzy.integration.google.model.GoogleVrConnection;
import com.clenzy.integration.google.repository.GoogleVrConnectionRepository;
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
 * Tests for {@link GoogleVrSyncScheduler}.
 * Validates feature flag gating and per-organisation error isolation
 * for ARI push and bookings pull.
 */
@ExtendWith(MockitoExtension.class)
class GoogleVrSyncSchedulerTest {

    @Mock private GoogleVacationRentalsConfig config;
    @Mock private GoogleVrConnectionRepository connectionRepository;
    @Mock private GoogleVrSyncService syncService;

    private GoogleVrSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new GoogleVrSyncScheduler(config, connectionRepository, syncService);
    }

    private GoogleVrConnection createConnection(Long orgId, String partnerId) {
        GoogleVrConnection connection = new GoogleVrConnection();
        connection.setId(orgId);
        connection.setOrganizationId(orgId);
        connection.setPartnerId(partnerId);
        connection.setStatus(GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE);
        return connection;
    }

    @Nested
    @DisplayName("pushAvailabilityAndRates")
    class PushAvailabilityAndRates {

        @Test
        void whenNotConfigured_thenSkips() {
            when(config.isConfigured()).thenReturn(false);

            scheduler.pushAvailabilityAndRates();

            verifyNoInteractions(connectionRepository, syncService);
        }

        @Test
        void whenNoActiveConnections_thenDoesNothing() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            scheduler.pushAvailabilityAndRates();

            verify(syncService, never()).pushAvailabilityAndRates(anyLong(), any(), any());
        }

        @Test
        void whenActiveConnections_thenPushesEach() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE))
                    .thenReturn(List.of(
                            createConnection(1L, "partner-1"),
                            createConnection(2L, "partner-2")));
            when(syncService.pushAvailabilityAndRates(
                    anyLong(), any(LocalDate.class), any(LocalDate.class)))
                    .thenReturn(30);

            scheduler.pushAvailabilityAndRates();

            verify(syncService).pushAvailabilityAndRates(eq(1L), any(), any());
            verify(syncService).pushAvailabilityAndRates(eq(2L), any(), any());
            verify(syncService, times(2)).pushAvailabilityAndRates(anyLong(), any(), any());
        }

        @Test
        void whenOneOrgFails_thenContinuesWithOthers() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE))
                    .thenReturn(List.of(
                            createConnection(1L, "partner-1"),
                            createConnection(2L, "partner-2")));
            when(syncService.pushAvailabilityAndRates(eq(1L), any(), any()))
                    .thenThrow(new RuntimeException("OAuth invalid"));
            when(syncService.pushAvailabilityAndRates(eq(2L), any(), any())).thenReturn(0);

            scheduler.pushAvailabilityAndRates();

            verify(syncService, times(2)).pushAvailabilityAndRates(anyLong(), any(), any());
        }

        @Test
        void whenSyncReturnsNegative_thenStillIteratesAllConnections() {
            // -1 means no connection in service; scheduler still iterates.
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE))
                    .thenReturn(List.of(createConnection(1L, "partner-1")));
            when(syncService.pushAvailabilityAndRates(anyLong(), any(), any())).thenReturn(-1);

            scheduler.pushAvailabilityAndRates();

            verify(syncService).pushAvailabilityAndRates(eq(1L), any(), any());
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
                    GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            scheduler.pullBookings();

            verify(syncService, never()).pullBookings(anyLong());
        }

        @Test
        void whenActiveConnections_thenPullsEach() {
            when(config.isConfigured()).thenReturn(true);
            when(connectionRepository.findByStatus(
                    GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE))
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
                    GoogleVrConnection.GoogleVrConnectionStatus.ACTIVE))
                    .thenReturn(List.of(
                            createConnection(1L, "partner-1"),
                            createConnection(2L, "partner-2")));
            when(syncService.pullBookings(1L)).thenThrow(new RuntimeException("quota"));

            scheduler.pullBookings();

            verify(syncService).pullBookings(1L);
            verify(syncService).pullBookings(2L);
        }
    }
}
