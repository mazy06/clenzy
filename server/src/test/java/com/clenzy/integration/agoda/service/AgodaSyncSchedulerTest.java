package com.clenzy.integration.agoda.service;

import com.clenzy.integration.agoda.config.AgodaConfig;
import com.clenzy.integration.agoda.model.AgodaConnection;
import com.clenzy.integration.agoda.repository.AgodaConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link AgodaSyncScheduler}.
 * Validates per-connection sync isolation, error handling, and health check transitions.
 */
@ExtendWith(MockitoExtension.class)
class AgodaSyncSchedulerTest {

    @Mock private AgodaConfig config;
    @Mock private AgodaConnectionRepository connectionRepository;
    @Mock private AgodaApiClient agodaApiClient;

    private AgodaSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new AgodaSyncScheduler(config, connectionRepository, agodaApiClient);
    }

    private AgodaConnection createConnection(Long orgId, String propertyId,
                                              AgodaConnection.AgodaConnectionStatus status) {
        AgodaConnection connection = new AgodaConnection();
        connection.setId(orgId);
        connection.setOrganizationId(orgId);
        connection.setPropertyId(propertyId);
        connection.setStatus(status);
        return connection;
    }

    @Nested
    @DisplayName("syncReservations")
    class SyncReservations {

        @Test
        void whenNoActiveConnections_thenDoesNothing() {
            when(connectionRepository.findAllActive()).thenReturn(List.of());

            scheduler.syncReservations();

            verify(agodaApiClient, never()).getReservations(anyString(), any(), any());
            verify(connectionRepository, never()).save(any());
        }

        @Test
        void whenSuccessfulSync_thenUpdatesLastSyncAtAndClearsError() {
            AgodaConnection conn = createConnection(1L, "prop-1",
                    AgodaConnection.AgodaConnectionStatus.ACTIVE);
            conn.setErrorMessage("previous failure");
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(agodaApiClient.getReservations(eq("prop-1"), any(), any())).thenReturn(List.of());

            scheduler.syncReservations();

            ArgumentCaptor<AgodaConnection> captor = ArgumentCaptor.forClass(AgodaConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getLastSyncAt()).isNotNull();
            assertThat(captor.getValue().getErrorMessage()).isNull();
            assertThat(captor.getValue().getStatus())
                    .isEqualTo(AgodaConnection.AgodaConnectionStatus.ACTIVE);
        }

        @Test
        void whenApiCallFails_thenMarksConnectionError() {
            AgodaConnection conn = createConnection(1L, "prop-1",
                    AgodaConnection.AgodaConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(agodaApiClient.getReservations(eq("prop-1"), any(), any()))
                    .thenThrow(new RuntimeException("403 forbidden"));

            scheduler.syncReservations();

            ArgumentCaptor<AgodaConnection> captor = ArgumentCaptor.forClass(AgodaConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus())
                    .isEqualTo(AgodaConnection.AgodaConnectionStatus.ERROR);
            assertThat(captor.getValue().getErrorMessage()).contains("403 forbidden");
        }

        @Test
        void whenMultipleConnections_thenIsolatesErrors() {
            AgodaConnection ok = createConnection(1L, "prop-1",
                    AgodaConnection.AgodaConnectionStatus.ACTIVE);
            AgodaConnection fail = createConnection(2L, "prop-2",
                    AgodaConnection.AgodaConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(ok, fail));
            when(agodaApiClient.getReservations(eq("prop-1"), any(), any())).thenReturn(List.of());
            when(agodaApiClient.getReservations(eq("prop-2"), any(), any()))
                    .thenThrow(new RuntimeException("boom"));

            scheduler.syncReservations();

            verify(connectionRepository, times(2)).save(any(AgodaConnection.class));
        }

        @Test
        void whenLastSyncAtSet_thenStartsFromThatDate() {
            AgodaConnection conn = createConnection(1L, "prop-1",
                    AgodaConnection.AgodaConnectionStatus.ACTIVE);
            LocalDateTime lastSync = LocalDateTime.now().minusDays(4);
            conn.setLastSyncAt(lastSync);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(agodaApiClient.getReservations(eq("prop-1"), any(), any())).thenReturn(List.of());

            scheduler.syncReservations();

            ArgumentCaptor<LocalDate> fromCaptor = ArgumentCaptor.forClass(LocalDate.class);
            verify(agodaApiClient).getReservations(eq("prop-1"), fromCaptor.capture(), any());
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

            verify(agodaApiClient, never()).getAvailability(anyString(), any(), any());
            verify(connectionRepository, never()).save(any());
        }

        @Test
        void whenActiveConnectionHealthy_thenDoesNotResave() {
            AgodaConnection conn = createConnection(1L, "prop-1",
                    AgodaConnection.AgodaConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(agodaApiClient.getAvailability(eq("prop-1"), any(), any())).thenReturn(List.of());

            scheduler.checkConnectionHealth();

            verify(connectionRepository, never()).save(any(AgodaConnection.class));
        }

        @Test
        void whenErrorConnectionRecovers_thenSetsActiveAndClearsError() {
            AgodaConnection conn = createConnection(1L, "prop-1",
                    AgodaConnection.AgodaConnectionStatus.ERROR);
            conn.setErrorMessage("old failure");
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(agodaApiClient.getAvailability(eq("prop-1"), any(), any())).thenReturn(List.of());

            scheduler.checkConnectionHealth();

            ArgumentCaptor<AgodaConnection> captor = ArgumentCaptor.forClass(AgodaConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus())
                    .isEqualTo(AgodaConnection.AgodaConnectionStatus.ACTIVE);
            assertThat(captor.getValue().getErrorMessage()).isNull();
        }

        @Test
        void whenHealthCheckFails_thenMarksConnectionError() {
            AgodaConnection conn = createConnection(1L, "prop-1",
                    AgodaConnection.AgodaConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(agodaApiClient.getAvailability(eq("prop-1"), any(), any()))
                    .thenThrow(new RuntimeException("timeout"));

            scheduler.checkConnectionHealth();

            ArgumentCaptor<AgodaConnection> captor = ArgumentCaptor.forClass(AgodaConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus())
                    .isEqualTo(AgodaConnection.AgodaConnectionStatus.ERROR);
            assertThat(captor.getValue().getErrorMessage()).contains("timeout");
        }
    }
}
