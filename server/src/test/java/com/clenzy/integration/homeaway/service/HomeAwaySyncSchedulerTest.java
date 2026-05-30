package com.clenzy.integration.homeaway.service;

import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.dto.HomeAwayReservationDto;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link HomeAwaySyncScheduler}.
 * Validates OAuth token refresh, per-connection sync isolation, and reservation handling.
 */
@ExtendWith(MockitoExtension.class)
class HomeAwaySyncSchedulerTest {

    @Mock private HomeAwayConfig config;
    @Mock private HomeAwayConnectionRepository connectionRepository;
    @Mock private HomeAwayApiClient apiClient;
    @Mock private HomeAwayOAuthService oAuthService;
    @Mock private HomeAwaySyncService syncService;

    private HomeAwaySyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new HomeAwaySyncScheduler(
                config, connectionRepository, apiClient, oAuthService, syncService);
    }

    private HomeAwayConnection createConnection(Long orgId, String listingId,
                                                 HomeAwayConnection.HomeAwayConnectionStatus status) {
        HomeAwayConnection connection = new HomeAwayConnection();
        connection.setId(orgId);
        connection.setOrganizationId(orgId);
        connection.setListingId(listingId);
        connection.setStatus(status);
        return connection;
    }

    private HomeAwayReservationDto createReservation(String reservationId, String listingId) {
        return new HomeAwayReservationDto(
                reservationId, listingId,
                "John", "Doe", "john@example.com", "+33611223344",
                LocalDate.now().plusDays(7), LocalDate.now().plusDays(10),
                "CONFIRMED", BigDecimal.valueOf(400), "EUR",
                3, 2, 1, null);
    }

    @Nested
    @DisplayName("refreshExpiringTokens")
    class RefreshExpiringTokens {

        @Test
        void whenNoActiveConnections_thenDoesNothing() {
            when(connectionRepository.findAllActive()).thenReturn(List.of());

            scheduler.refreshExpiringTokens();

            verify(oAuthService, never()).refreshToken(anyLong());
        }

        @Test
        void whenTokenExpiresWithinThreshold_thenRefreshes() {
            HomeAwayConnection conn = createConnection(1L, "listing-1",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            // expires in 30 min (within 60 min threshold)
            conn.setTokenExpiresAt(LocalDateTime.now().plusMinutes(30));
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));

            scheduler.refreshExpiringTokens();

            verify(oAuthService).refreshToken(1L);
        }

        @Test
        void whenTokenNotExpiringSoon_thenDoesNotRefresh() {
            HomeAwayConnection conn = createConnection(1L, "listing-1",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            conn.setTokenExpiresAt(LocalDateTime.now().plusHours(5));
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));

            scheduler.refreshExpiringTokens();

            verify(oAuthService, never()).refreshToken(anyLong());
        }

        @Test
        void whenTokenExpiresAtIsNull_thenDoesNotRefresh() {
            HomeAwayConnection conn = createConnection(1L, "listing-1",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            conn.setTokenExpiresAt(null);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));

            scheduler.refreshExpiringTokens();

            verify(oAuthService, never()).refreshToken(anyLong());
        }

        @Test
        void whenOneRefreshFails_thenContinuesWithOthers() {
            HomeAwayConnection c1 = createConnection(1L, "listing-1",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            c1.setTokenExpiresAt(LocalDateTime.now().plusMinutes(10));
            HomeAwayConnection c2 = createConnection(2L, "listing-2",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            c2.setTokenExpiresAt(LocalDateTime.now().plusMinutes(15));
            when(connectionRepository.findAllActive()).thenReturn(List.of(c1, c2));
            doThrow(new RuntimeException("expired refresh token"))
                    .when(oAuthService).refreshToken(1L);

            scheduler.refreshExpiringTokens();

            verify(oAuthService).refreshToken(1L);
            verify(oAuthService).refreshToken(2L);
        }
    }

    @Nested
    @DisplayName("syncReservations")
    class SyncReservations {

        @Test
        void whenNoActiveConnections_thenDoesNothing() {
            when(connectionRepository.findAllActive()).thenReturn(List.of());

            scheduler.syncReservations();

            verify(apiClient, never()).getReservations(anyString(), any(), any(), anyString());
            verify(syncService, never()).handleReservationCreated(anyMap(), anyLong());
        }

        @Test
        void whenConnectionHasNullListingId_thenStillUpdatesLastSyncAt() {
            HomeAwayConnection conn = createConnection(1L, null,
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(oAuthService.getValidAccessToken(1L)).thenReturn("token");

            scheduler.syncReservations();

            verify(apiClient, never()).getReservations(anyString(), any(), any(), anyString());
            verify(connectionRepository).save(any(HomeAwayConnection.class));
        }

        @Test
        void whenConnectionHasReservations_thenDelegatesEachToSyncService() {
            HomeAwayConnection conn = createConnection(1L, "listing-1",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            conn.setErrorMessage("previous");
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(oAuthService.getValidAccessToken(1L)).thenReturn("token");
            when(apiClient.getReservations(eq("listing-1"), any(), any(), eq("token")))
                    .thenReturn(List.of(
                            createReservation("R1", "listing-1"),
                            createReservation("R2", "listing-1")));

            scheduler.syncReservations();

            verify(syncService, times(2)).handleReservationCreated(anyMap(), eq(1L));
            ArgumentCaptor<HomeAwayConnection> captor = ArgumentCaptor.forClass(HomeAwayConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getErrorMessage()).isNull();
            assertThat(captor.getValue().getLastSyncAt()).isNotNull();
        }

        @Test
        void whenReservationProcessingThrows_thenContinuesWithOthers() {
            HomeAwayConnection conn = createConnection(1L, "listing-1",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(oAuthService.getValidAccessToken(1L)).thenReturn("token");
            when(apiClient.getReservations(eq("listing-1"), any(), any(), eq("token")))
                    .thenReturn(List.of(
                            createReservation("R1", "listing-1"),
                            createReservation("R2", "listing-1")));
            doThrow(new RuntimeException("kafka"))
                    .when(syncService).handleReservationCreated(anyMap(), anyLong());

            scheduler.syncReservations();

            verify(syncService, times(2)).handleReservationCreated(anyMap(), eq(1L));
        }

        @Test
        void whenApiCallFails_thenSavesErrorMessage() {
            HomeAwayConnection conn = createConnection(1L, "listing-1",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(oAuthService.getValidAccessToken(1L))
                    .thenThrow(new RuntimeException("token revoked"));

            scheduler.syncReservations();

            ArgumentCaptor<HomeAwayConnection> captor = ArgumentCaptor.forClass(HomeAwayConnection.class);
            verify(connectionRepository).save(captor.capture());
            assertThat(captor.getValue().getErrorMessage()).contains("token revoked");
        }

        @Test
        void whenMultipleConnections_thenIsolatesErrors() {
            HomeAwayConnection ok = createConnection(1L, "listing-1",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            HomeAwayConnection fail = createConnection(2L, "listing-2",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            when(connectionRepository.findAllActive()).thenReturn(List.of(ok, fail));
            when(oAuthService.getValidAccessToken(1L)).thenReturn("token-1");
            when(oAuthService.getValidAccessToken(2L))
                    .thenThrow(new RuntimeException("boom"));
            when(apiClient.getReservations(eq("listing-1"), any(), any(), eq("token-1")))
                    .thenReturn(List.of());

            scheduler.syncReservations();

            verify(connectionRepository, times(2)).save(any(HomeAwayConnection.class));
        }

        @Test
        void whenLastSyncAtIsSet_thenStartsFromThatDate() {
            HomeAwayConnection conn = createConnection(1L, "listing-1",
                    HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            LocalDateTime lastSync = LocalDateTime.now().minusDays(3);
            conn.setLastSyncAt(lastSync);
            when(connectionRepository.findAllActive()).thenReturn(List.of(conn));
            when(oAuthService.getValidAccessToken(1L)).thenReturn("token");
            when(apiClient.getReservations(eq("listing-1"), any(), any(), eq("token")))
                    .thenReturn(List.of());

            scheduler.syncReservations();

            ArgumentCaptor<LocalDate> fromCaptor = ArgumentCaptor.forClass(LocalDate.class);
            verify(apiClient).getReservations(
                    eq("listing-1"), fromCaptor.capture(), any(), eq("token"));
            assertThat(fromCaptor.getValue()).isEqualTo(lastSync.toLocalDate());
        }
    }
}
