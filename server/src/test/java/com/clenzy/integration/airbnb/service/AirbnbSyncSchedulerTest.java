package com.clenzy.integration.airbnb.service;

import com.clenzy.integration.airbnb.config.AirbnbConfig;
import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@link AirbnbSyncScheduler}.
 *
 * Covers:
 * - syncEnabled gating (refresh + sync skipped when disabled)
 * - OAuth token refresh threshold + per-connection error isolation
 * - Listing mapping sync (lastSyncAt update + per-org error isolation)
 * - cleanup job is a noop (no exception)
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("AirbnbSyncScheduler")
class AirbnbSyncSchedulerTest {

    @Mock private AirbnbConfig config;
    @Mock private AirbnbConnectionRepository connectionRepository;
    @Mock private AirbnbListingMappingRepository listingMappingRepository;
    @Mock private AirbnbOAuthService oAuthService;

    private AirbnbSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new AirbnbSyncScheduler(config, connectionRepository,
                listingMappingRepository, oAuthService);
    }

    private AirbnbConnection conn(Long orgId, String userId,
                                   AirbnbConnection.AirbnbConnectionStatus status,
                                   LocalDateTime expiresAt) {
        AirbnbConnection c = new AirbnbConnection();
        c.setId(orgId);
        c.setOrganizationId(orgId);
        c.setUserId(userId);
        c.setStatus(status);
        c.setTokenExpiresAt(expiresAt);
        return c;
    }

    private AirbnbListingMapping mapping(Long orgId, String airbnbListingId) {
        AirbnbListingMapping m = new AirbnbListingMapping();
        m.setId(1L);
        m.setOrganizationId(orgId);
        m.setAirbnbListingId(airbnbListingId);
        m.setSyncEnabled(true);
        return m;
    }

    // ─── refreshExpiringTokens ─────────────────────────────────────────────

    @Nested
    @DisplayName("refreshExpiringTokens")
    class RefreshExpiring {

        @Test
        @DisplayName("syncEnabled=false skips repository lookup")
        void disabled_skips() {
            when(config.isSyncEnabled()).thenReturn(false);

            scheduler.refreshExpiringTokens();

            verify(connectionRepository, never()).findByStatus(any());
            verify(oAuthService, never()).refreshToken(anyString());
        }

        @Test
        @DisplayName("no active connections -> noop")
        void noConnections_noop() {
            when(config.isSyncEnabled()).thenReturn(true);
            when(connectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of());

            scheduler.refreshExpiringTokens();

            verify(oAuthService, never()).refreshToken(anyString());
        }

        @Test
        @DisplayName("token expiring within 60 minutes -> refresh")
        void refreshesNearExpiry() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbConnection c = conn(1L, "user-1",
                    AirbnbConnection.AirbnbConnectionStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(30));
            when(connectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of(c));

            scheduler.refreshExpiringTokens();

            verify(oAuthService).refreshToken("user-1");
        }

        @Test
        @DisplayName("token expiring beyond threshold -> skip")
        void skipsBeyondThreshold() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbConnection c = conn(1L, "user-1",
                    AirbnbConnection.AirbnbConnectionStatus.ACTIVE,
                    LocalDateTime.now().plusHours(5));
            when(connectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of(c));

            scheduler.refreshExpiringTokens();

            verify(oAuthService, never()).refreshToken(anyString());
        }

        @Test
        @DisplayName("token expiresAt is null -> skip")
        void nullExpiresAt_skip() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbConnection c = conn(1L, "user-1",
                    AirbnbConnection.AirbnbConnectionStatus.ACTIVE, null);
            when(connectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of(c));

            scheduler.refreshExpiringTokens();

            verify(oAuthService, never()).refreshToken(anyString());
        }

        @Test
        @DisplayName("connection without organizationId is filtered out")
        void nullOrgIdSkipped() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbConnection c = conn(null, "user-1",
                    AirbnbConnection.AirbnbConnectionStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(10));
            c.setOrganizationId(null);
            when(connectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of(c));

            scheduler.refreshExpiringTokens();

            verify(oAuthService, never()).refreshToken(anyString());
        }

        @Test
        @DisplayName("one refresh failure doesn't block others")
        void refreshFailureIsolated() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbConnection c1 = conn(1L, "u-1",
                    AirbnbConnection.AirbnbConnectionStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(15));
            AirbnbConnection c2 = conn(2L, "u-2",
                    AirbnbConnection.AirbnbConnectionStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(20));
            when(connectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of(c1, c2));
            doThrow(new RuntimeException("expired token")).when(oAuthService).refreshToken("u-1");

            scheduler.refreshExpiringTokens();

            verify(oAuthService).refreshToken("u-1");
            verify(oAuthService).refreshToken("u-2");
        }

        @Test
        @DisplayName("multiple orgs are processed independently")
        void multipleOrgs() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbConnection c1 = conn(1L, "u-1",
                    AirbnbConnection.AirbnbConnectionStatus.ACTIVE,
                    LocalDateTime.now().plusMinutes(10));
            AirbnbConnection c2 = conn(2L, "u-2",
                    AirbnbConnection.AirbnbConnectionStatus.ACTIVE,
                    LocalDateTime.now().plusHours(5));
            when(connectionRepository.findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE))
                    .thenReturn(List.of(c1, c2));

            scheduler.refreshExpiringTokens();

            verify(oAuthService, times(1)).refreshToken("u-1");
            verify(oAuthService, never()).refreshToken("u-2");
        }
    }

    // ─── syncReservations ──────────────────────────────────────────────────

    @Nested
    @DisplayName("syncReservations")
    class SyncReservations {

        @Test
        @DisplayName("syncEnabled=false skips lookup")
        void disabled_skips() {
            when(config.isSyncEnabled()).thenReturn(false);

            scheduler.syncReservations();

            verify(listingMappingRepository, never()).findBySyncEnabled(any(Boolean.class));
        }

        @Test
        @DisplayName("no mappings -> noop")
        void noMappings_noop() {
            when(config.isSyncEnabled()).thenReturn(true);
            when(listingMappingRepository.findBySyncEnabled(true)).thenReturn(List.of());

            scheduler.syncReservations();

            verify(listingMappingRepository, never()).save(any());
        }

        @Test
        @DisplayName("mapping with null orgId is filtered")
        void nullOrgIdFiltered() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbListingMapping m = mapping(null, "L-1");
            when(listingMappingRepository.findBySyncEnabled(true)).thenReturn(List.of(m));

            scheduler.syncReservations();

            verify(listingMappingRepository, never()).save(any());
        }

        @Test
        @DisplayName("updates lastSyncAt and saves the mapping")
        void savesAndUpdatesLastSync() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbListingMapping m = mapping(10L, "L-1");
            when(listingMappingRepository.findBySyncEnabled(true)).thenReturn(List.of(m));

            scheduler.syncReservations();

            ArgumentCaptor<AirbnbListingMapping> cap = ArgumentCaptor.forClass(AirbnbListingMapping.class);
            verify(listingMappingRepository).save(cap.capture());
            assertThat(cap.getValue().getLastSyncAt()).isNotNull();
        }

        @Test
        @DisplayName("multiple mappings across orgs all saved")
        void multipleOrgs() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbListingMapping m1 = mapping(1L, "L-1");
            AirbnbListingMapping m2 = mapping(2L, "L-2");
            when(listingMappingRepository.findBySyncEnabled(true)).thenReturn(List.of(m1, m2));

            scheduler.syncReservations();

            verify(listingMappingRepository, times(2)).save(any(AirbnbListingMapping.class));
        }

        @Test
        @DisplayName("when save throws on one mapping the loop keeps going")
        void saveFailureIsolated() {
            when(config.isSyncEnabled()).thenReturn(true);
            AirbnbListingMapping m1 = mapping(1L, "L-1");
            AirbnbListingMapping m2 = mapping(2L, "L-2");
            when(listingMappingRepository.findBySyncEnabled(true)).thenReturn(List.of(m1, m2));
            when(listingMappingRepository.save(eq(m1)))
                    .thenThrow(new RuntimeException("db down"));

            scheduler.syncReservations();

            verify(listingMappingRepository).save(m1);
            verify(listingMappingRepository).save(m2);
        }
    }

    // ─── cleanupOldWebhookEvents ───────────────────────────────────────────

    @Nested
    @DisplayName("cleanupOldWebhookEvents")
    class Cleanup {

        @Test
        @DisplayName("runs without throwing (currently a noop)")
        void runsCleanly() {
            scheduler.cleanupOldWebhookEvents();
            // Pure log call, no side effects expected; just verify it doesn't blow up.
        }
    }
}
