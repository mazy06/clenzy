package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.tripadvisor.config.TripAdvisorConfig;
import com.clenzy.integration.tripadvisor.service.TripAdvisorSyncService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TripAdvisorChannelAdapterTest {

    @Mock private TripAdvisorConfig config;
    @Mock private TripAdvisorSyncService syncService;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private TripAdvisorChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new TripAdvisorChannelAdapter(config, syncService, channelMappingRepository);
    }

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.TRIPADVISOR);
    }

    @Test
    void capabilities() {
        assertThat(adapter.getCapabilities()).containsExactlyInAnyOrder(
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS
        );
    }

    @Nested
    @DisplayName("resolveMapping")
    class ResolveMappingTests {

        @Test
        @DisplayName("returns mapping when found")
        void resolveMapping_found() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.TRIPADVISOR, 1L))
                    .thenReturn(Optional.of(mapping));

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isPresent();
        }

        @Test
        @DisplayName("returns empty when not found")
        void resolveMapping_notFound() {
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.TRIPADVISOR, 1L))
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
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    propertyId, ChannelName.TRIPADVISOR, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun mapping TripAdvisor");
        }

        @Test
        @DisplayName("returns SKIPPED when TripAdvisor is not configured")
        void pushCalendarUpdate_notConfigured() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    propertyId, ChannelName.TRIPADVISOR, orgId))
                    .thenReturn(Optional.of(mapping));
            when(config.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("TripAdvisor non configure");
        }

        @Test
        @DisplayName("returns SKIPPED when sync service returns negative (no active connection)")
        void pushCalendarUpdate_noActiveConnection() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    propertyId, ChannelName.TRIPADVISOR, orgId))
                    .thenReturn(Optional.of(mapping));
            when(config.isConfigured()).thenReturn(true);
            when(syncService.pushAvailability(orgId, from, to)).thenReturn(-1);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Pas de connexion TripAdvisor active");
        }

        @Test
        @DisplayName("returns SUCCESS when sync service pushes items")
        void pushCalendarUpdate_success() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    propertyId, ChannelName.TRIPADVISOR, orgId))
                    .thenReturn(Optional.of(mapping));
            when(config.isConfigured()).thenReturn(true);
            when(syncService.pushAvailability(orgId, from, to)).thenReturn(14);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(14);
        }

        @Test
        @DisplayName("returns FAILED when sync service throws exception")
        void pushCalendarUpdate_exception() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    propertyId, ChannelName.TRIPADVISOR, orgId))
                    .thenReturn(Optional.of(mapping));
            when(config.isConfigured()).thenReturn(true);
            when(syncService.pushAvailability(orgId, from, to))
                    .thenThrow(new RuntimeException("TripAdvisor API unavailable"));

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur TripAdvisor");
            assertThat(result.getMessage()).contains("TripAdvisor API unavailable");
        }
    }

    @Nested
    @DisplayName("handleInboundEvent")
    class HandleInboundEventTests {

        @Test
        @DisplayName("delegates to syncService.handleBookingWebhook")
        void handleInboundEvent_delegatesToSyncService() {
            Map<String, Object> data = Map.of("reservationId", "TA-12345");

            adapter.handleInboundEvent("reservation.created", data, 1L);

            verify(syncService).handleBookingWebhook("reservation.created", data, 1L);
        }

        @Test
        @DisplayName("delegates unknown event types to syncService as well")
        void handleInboundEvent_unknownType() {
            Map<String, Object> data = Map.of();

            adapter.handleInboundEvent("unknown.event", data, 1L);

            verify(syncService).handleBookingWebhook("unknown.event", data, 1L);
        }
    }

    @Nested
    @DisplayName("checkHealth")
    class CheckHealthTests {

        @Test
        @DisplayName("returns UNKNOWN (not yet implemented)")
        void checkHealth_unknown() {
            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }
    }
}
