package com.clenzy.integration.hotelscom.service;

import com.clenzy.integration.hotelscom.config.HotelsComConfig;
import com.clenzy.integration.hotelscom.dto.HotelsComReservationDto;
import com.clenzy.integration.hotelscom.model.HotelsComConnection;
import com.clenzy.integration.hotelscom.repository.HotelsComConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link HotelsComSyncScheduler}.
 * Validates per-connection sync isolation, reservation handling, and health check behavior.
 */
@ExtendWith(MockitoExtension.class)
class HotelsComSyncSchedulerTest {

    @Mock private HotelsComConfig config;
    @Mock private HotelsComConnectionRepository connectionRepository;
    @Mock private HotelsComApiClient apiClient;
    @Mock private HotelsComSyncService syncService;

    private HotelsComSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new HotelsComSyncScheduler(config, connectionRepository, apiClient, syncService);
    }

    private HotelsComConnection createConnection(Long orgId, String propertyId,
                                                  HotelsComConnection.HotelsComConnectionStatus status) {
        HotelsComConnection connection = new HotelsComConnection();
        connection.setId(orgId);
        connection.setOrganizationId(orgId);
        connection.setPropertyId(propertyId);
        connection.setStatus(status);
        return connection;
    }

    private HotelsComReservationDto createReservation(String confirmationNumber, String propertyId) {
        return new HotelsComReservationDto(
                confirmationNumber, propertyId, "room-1",
                "John", "Doe", "john@example.com", "+33611223344",
                LocalDate.now().plusDays(7), LocalDate.now().plusDays(10),
                "CONFIRMED", BigDecimal.valueOf(300), "EUR",
                2, 1, null, "hotels.com");
    }

    @Nested
    @DisplayName("syncReservations")
    class SyncReservations {

        @Test
        void whenNoActiveConnections_thenDoesNothing() {
            when(connectionRepository.findAllActive()).thenReturn(List.of());

            scheduler.syncReservations();

            verify(apiClient, never()).getReservations(anyString(), any(), any());
            verify(syncService, never()).handleReservationCreated(anyMap());
            verify(connectionRepository, never()).save(any());
        }

        @Test
        void whenConnectionHasNoReservations_thenUpdatesLastSyncAtAndClearsError() {
            HotelsComConnection conn = createConnection(1L, "prop-1",
                    HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
            conn.setErrorMessage("previous error");
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(apiClient.getReservations(eq("prop-1"), any(), any())).thenReturn(List.of());

            scheduler.syncReservations();

            ArgumentCaptor<HotelsComConnection> captor = ArgumentCaptor.forClass(HotelsComConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getLastSyncAt()).isNotNull();
            assertThat(captor.getValue().getErrorMessage()).isNull();
            verify(syncService, never()).handleReservationCreated(anyMap());
        }

        @Test
        void whenConnectionHasReservations_thenDelegatesEachToSyncService() {
            HotelsComConnection conn = createConnection(1L, "prop-1",
                    HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(apiClient.getReservations(eq("prop-1"), any(), any()))
                    .thenReturn(List.of(
                            createReservation("CONF-1", "prop-1"),
                            createReservation("CONF-2", "prop-1")));

            scheduler.syncReservations();

            verify(syncService, times(2)).handleReservationCreated(anyMap());
            verify(connectionRepository).save(any(HotelsComConnection.class));
        }

        @Test
        void whenReservationProcessingThrows_thenContinuesWithOthers() {
            HotelsComConnection conn = createConnection(1L, "prop-1",
                    HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(apiClient.getReservations(eq("prop-1"), any(), any()))
                    .thenReturn(List.of(
                            createReservation("CONF-1", "prop-1"),
                            createReservation("CONF-2", "prop-1")));

            doThrow(new RuntimeException("kafka down"))
                    .when(syncService).handleReservationCreated(anyMap());

            scheduler.syncReservations();

            verify(syncService, times(2)).handleReservationCreated(anyMap());
            // Connection state still updated despite per-reservation failures
            verify(connectionRepository).save(any(HotelsComConnection.class));
        }

        @Test
        void whenApiClientThrows_thenMarksConnectionError() {
            HotelsComConnection conn = createConnection(1L, "prop-1",
                    HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(apiClient.getReservations(eq("prop-1"), any(), any()))
                    .thenThrow(new RuntimeException("API unreachable"));

            scheduler.syncReservations();

            ArgumentCaptor<HotelsComConnection> captor = ArgumentCaptor.forClass(HotelsComConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus())
                    .isEqualTo(HotelsComConnection.HotelsComConnectionStatus.ERROR);
            assertThat(captor.getValue().getErrorMessage()).contains("API unreachable");
        }

        @Test
        void whenMultipleConnections_thenIsolatesErrors() {
            HotelsComConnection ok = createConnection(1L, "prop-1",
                    HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
            HotelsComConnection fail = createConnection(2L, "prop-2",
                    HotelsComConnection.HotelsComConnectionStatus.ACTIVE);

            when(connectionRepository.findAllActive()).thenReturn(List.of(ok, fail));
            when(apiClient.getReservations(eq("prop-1"), any(), any())).thenReturn(List.of());
            when(apiClient.getReservations(eq("prop-2"), any(), any()))
                    .thenThrow(new RuntimeException("boom"));

            scheduler.syncReservations();

            // Both connections saved (one OK, one in ERROR)
            verify(connectionRepository, times(2)).save(any(HotelsComConnection.class));
        }

        @Test
        void whenConnectionHasLastSyncAt_thenStartsFromThatDate() {
            HotelsComConnection conn = createConnection(1L, "prop-1",
                    HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
            LocalDateTime lastSync = LocalDateTime.now().minusDays(2);
            conn.setLastSyncAt(lastSync);

            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(apiClient.getReservations(eq("prop-1"), any(), any())).thenReturn(List.of());

            scheduler.syncReservations();

            ArgumentCaptor<LocalDate> fromCaptor = ArgumentCaptor.forClass(LocalDate.class);
            verify(apiClient).getReservations(eq("prop-1"), fromCaptor.capture(), any());
            assertThat(fromCaptor.getValue()).isEqualTo(lastSync.toLocalDate());
        }
    }

    @Nested
    @DisplayName("checkConnectionHealth")
    class CheckConnectionHealth {

        @Test
        void whenNoActiveConnections_thenDoesNothing() {
            when(connectionRepository.findAllActive()).thenReturn(List.of());

            scheduler.checkConnectionHealth();

            verify(apiClient, never()).getAvailability(anyString(), any(), any());
            verify(connectionRepository, never()).save(any());
        }

        @Test
        void whenActiveConnectionHealthy_thenDoesNotResaveActive() {
            HotelsComConnection conn = createConnection(1L, "prop-1",
                    HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(apiClient.getAvailability(eq("prop-1"), any(), any())).thenReturn(List.of());

            scheduler.checkConnectionHealth();

            // ACTIVE -> still ACTIVE; the scheduler only re-saves when status was ERROR
            verify(connectionRepository, never()).save(any(HotelsComConnection.class));
        }

        @Test
        void whenErrorConnectionRecovers_thenSetsActiveAndClearsError() {
            HotelsComConnection conn = createConnection(1L, "prop-1",
                    HotelsComConnection.HotelsComConnectionStatus.ERROR);
            conn.setErrorMessage("old failure");
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(apiClient.getAvailability(eq("prop-1"), any(), any())).thenReturn(List.of());

            scheduler.checkConnectionHealth();

            ArgumentCaptor<HotelsComConnection> captor = ArgumentCaptor.forClass(HotelsComConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus())
                    .isEqualTo(HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
            assertThat(captor.getValue().getErrorMessage()).isNull();
        }

        @Test
        void whenHealthCheckFails_thenMarksConnectionError() {
            HotelsComConnection conn = createConnection(1L, "prop-1",
                    HotelsComConnection.HotelsComConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(apiClient.getAvailability(eq("prop-1"), any(), any()))
                    .thenThrow(new RuntimeException("401 unauthorized"));

            scheduler.checkConnectionHealth();

            ArgumentCaptor<HotelsComConnection> captor = ArgumentCaptor.forClass(HotelsComConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus())
                    .isEqualTo(HotelsComConnection.HotelsComConnectionStatus.ERROR);
            assertThat(captor.getValue().getErrorMessage()).contains("401 unauthorized");
        }
    }
}
