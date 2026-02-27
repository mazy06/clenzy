package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.homeaway.config.HomeAwayConfig;
import com.clenzy.integration.homeaway.model.HomeAwayConnection;
import com.clenzy.integration.homeaway.repository.HomeAwayConnectionRepository;
import com.clenzy.integration.homeaway.service.HomeAwayApiClient;
import com.clenzy.integration.homeaway.service.HomeAwayOAuthService;
import com.clenzy.integration.homeaway.service.HomeAwaySyncService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HomeAwayChannelAdapterTest {

    @Mock private HomeAwayConfig homeAwayConfig;
    @Mock private HomeAwayConnectionRepository homeAwayConnectionRepository;
    @Mock private HomeAwayApiClient homeAwayApiClient;
    @Mock private HomeAwayOAuthService homeAwayOAuthService;
    @Mock private HomeAwaySyncService homeAwaySyncService;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private HomeAwayChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new HomeAwayChannelAdapter(homeAwayConfig, homeAwayConnectionRepository,
                homeAwayApiClient, homeAwayOAuthService, homeAwaySyncService,
                channelMappingRepository);
    }

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.HOMEAWAY);
    }

    @Test
    void capabilities() {
        assertThat(adapter.getCapabilities()).containsExactlyInAnyOrder(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS,
                ChannelCapability.OAUTH
        );
    }

    @Nested
    @DisplayName("resolveMapping")
    class ResolveMappingTests {

        @Test
        @DisplayName("returns mapping when found")
        void resolveMapping_found() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.HOMEAWAY, 1L))
                    .thenReturn(Optional.of(mapping));

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isPresent();
        }

        @Test
        @DisplayName("returns empty when not found")
        void resolveMapping_notFound() {
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.HOMEAWAY, 1L))
                    .thenReturn(Optional.empty());

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("pushCalendarUpdate")
    class PushCalendarUpdateTests {

        private final Long propertyId = 42L;
        private final Long orgId = 1L;
        private final LocalDate from = LocalDate.of(2026, 3, 1);
        private final LocalDate to = LocalDate.of(2026, 3, 15);

        @Test
        @DisplayName("returns SKIPPED when no mapping exists")
        void pushCalendarUpdate_noMapping() {
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.HOMEAWAY, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun mapping HomeAway");
        }

        @Test
        @DisplayName("returns SKIPPED when config is incomplete")
        void pushCalendarUpdate_configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.HOMEAWAY, orgId))
                    .thenReturn(Optional.of(mapping));
            when(homeAwayConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Configuration HomeAway incomplete");
        }

        @Test
        @DisplayName("returns SKIPPED when OAuth is not connected")
        void pushCalendarUpdate_oauthNotConnected() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.HOMEAWAY, orgId))
                    .thenReturn(Optional.of(mapping));
            when(homeAwayConfig.isConfigured()).thenReturn(true);
            when(homeAwayOAuthService.isConnected(orgId)).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Pas de connexion OAuth HomeAway active");
        }

        @Test
        @DisplayName("returns SKIPPED — implementation pending (current behavior)")
        void pushCalendarUpdate_skippedPendingImplementation() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("homeaway-listing-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.HOMEAWAY, orgId))
                    .thenReturn(Optional.of(mapping));
            when(homeAwayConfig.isConfigured()).thenReturn(true);
            when(homeAwayOAuthService.isConnected(orgId)).thenReturn(true);
            when(homeAwayOAuthService.getValidAccessToken(orgId)).thenReturn("valid-token");

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("phase suivante");
        }

        @Test
        @DisplayName("returns FAILED when exception is thrown")
        void pushCalendarUpdate_exception() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("homeaway-listing-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.HOMEAWAY, orgId))
                    .thenReturn(Optional.of(mapping));
            when(homeAwayConfig.isConfigured()).thenReturn(true);
            when(homeAwayOAuthService.isConnected(orgId)).thenReturn(true);
            when(homeAwayOAuthService.getValidAccessToken(orgId))
                    .thenThrow(new RuntimeException("OAuth token refresh failed"));

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Push calendrier HomeAway echoue");
            assertThat(result.getMessage()).contains("OAuth token refresh failed");
        }
    }

    @Nested
    @DisplayName("handleInboundEvent")
    class HandleInboundEventTests {

        @Test
        @DisplayName("delegates reservation.created to syncService")
        void handleInboundEvent_reservationCreated() {
            Map<String, Object> data = Map.of("reservationId", "HA-12345");

            adapter.handleInboundEvent("reservation.created", data, 1L);

            verify(homeAwaySyncService).handleReservationCreated(data, 1L);
        }

        @Test
        @DisplayName("delegates reservation.updated to syncService")
        void handleInboundEvent_reservationUpdated() {
            Map<String, Object> data = Map.of("reservationId", "HA-12345");

            adapter.handleInboundEvent("reservation.updated", data, 1L);

            verify(homeAwaySyncService).handleReservationUpdated(data, 1L);
        }

        @Test
        @DisplayName("delegates reservation.cancelled to syncService")
        void handleInboundEvent_reservationCancelled() {
            Map<String, Object> data = Map.of("reservationId", "HA-12345");

            adapter.handleInboundEvent("reservation.cancelled", data, 1L);

            verify(homeAwaySyncService).handleReservationCancelled(data, 1L);
        }

        @Test
        @DisplayName("delegates availability.updated to syncService")
        void handleInboundEvent_availabilityUpdated() {
            Map<String, Object> data = Map.of("propertyId", "HA-PROP-1");

            adapter.handleInboundEvent("availability.updated", data, 1L);

            verify(homeAwaySyncService).handleAvailabilityUpdate(data, 1L);
        }

        @Test
        @DisplayName("does not call any sync method for unknown event types")
        void handleInboundEvent_unknownType() {
            adapter.handleInboundEvent("unknown.event", Map.of(), 1L);

            verifyNoInteractions(homeAwaySyncService);
        }
    }

    @Nested
    @DisplayName("checkHealth")
    class CheckHealthTests {

        @Test
        @DisplayName("returns UNKNOWN when connection not found")
        void checkHealth_connectionNotFound() {
            when(homeAwayConnectionRepository.findById(99L)).thenReturn(Optional.empty());

            HealthStatus status = adapter.checkHealth(99L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }

        @Test
        @DisplayName("returns UNHEALTHY when connection is not active")
        void checkHealth_inactive() {
            HomeAwayConnection connection = new HomeAwayConnection();
            connection.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.INACTIVE);
            when(homeAwayConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNHEALTHY);
        }

        @Test
        @DisplayName("returns DEGRADED when connection is active but token is expired")
        void checkHealth_tokenExpired() {
            HomeAwayConnection connection = new HomeAwayConnection();
            connection.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            connection.setTokenExpiresAt(LocalDateTime.now().minusHours(1));
            when(homeAwayConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.DEGRADED);
        }

        @Test
        @DisplayName("returns HEALTHY when connection is active and token is valid")
        void checkHealth_healthy() {
            HomeAwayConnection connection = new HomeAwayConnection();
            connection.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            connection.setTokenExpiresAt(LocalDateTime.now().plusHours(1));
            when(homeAwayConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.HEALTHY);
        }

        @Test
        @DisplayName("returns HEALTHY when connection is active and no token expiry set")
        void checkHealth_noTokenExpiry() {
            HomeAwayConnection connection = new HomeAwayConnection();
            connection.setStatus(HomeAwayConnection.HomeAwayConnectionStatus.ACTIVE);
            connection.setTokenExpiresAt(null);
            when(homeAwayConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.HEALTHY);
        }

        @Test
        @DisplayName("returns UNKNOWN when repository throws exception")
        void checkHealth_exception() {
            when(homeAwayConnectionRepository.findById(1L))
                    .thenThrow(new RuntimeException("DB error"));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }
    }
}
