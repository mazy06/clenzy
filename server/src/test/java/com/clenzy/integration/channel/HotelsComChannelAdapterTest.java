package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.hotelscom.config.HotelsComConfig;
import com.clenzy.integration.hotelscom.model.HotelsComConnection;
import com.clenzy.integration.hotelscom.model.HotelsComConnection.HotelsComConnectionStatus;
import com.clenzy.integration.hotelscom.repository.HotelsComConnectionRepository;
import com.clenzy.integration.hotelscom.service.HotelsComApiClient;
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
class HotelsComChannelAdapterTest {

    @Mock private HotelsComConfig hotelsComConfig;
    @Mock private HotelsComConnectionRepository hotelsComConnectionRepository;
    @Mock private HotelsComApiClient hotelsComApiClient;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private HotelsComChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new HotelsComChannelAdapter(hotelsComConfig, hotelsComConnectionRepository,
                hotelsComApiClient, channelMappingRepository);
    }

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.HOTELS_COM);
    }

    @Test
    void capabilities() {
        assertThat(adapter.getCapabilities()).containsExactlyInAnyOrder(
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.POLLING
        );
    }

    @Nested
    @DisplayName("resolveMapping")
    class ResolveMappingTests {

        @Test
        @DisplayName("returns mapping when found")
        void resolveMapping_found() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.HOTELS_COM, 1L))
                    .thenReturn(Optional.of(mapping));

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isPresent();
        }

        @Test
        @DisplayName("returns empty when not found")
        void resolveMapping_notFound() {
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.HOTELS_COM, 1L))
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
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.HOTELS_COM, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun mapping Hotels.com");
        }

        @Test
        @DisplayName("returns SKIPPED when config is incomplete")
        void pushCalendarUpdate_configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.HOTELS_COM, orgId))
                    .thenReturn(Optional.of(mapping));
            when(hotelsComConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Configuration Hotels.com incomplete");
        }

        @Test
        @DisplayName("returns SKIPPED — implementation pending (current behavior)")
        void pushCalendarUpdate_skippedPendingImplementation() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("hcom-prop-789");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.HOTELS_COM, orgId))
                    .thenReturn(Optional.of(mapping));
            when(hotelsComConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("phase suivante");
        }

        @Test
        @DisplayName("returns FAILED when exception is thrown")
        void pushCalendarUpdate_exception() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenThrow(new RuntimeException("Hotels.com API error"));
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.HOTELS_COM, orgId))
                    .thenReturn(Optional.of(mapping));
            when(hotelsComConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Push calendrier Hotels.com echoue");
        }
    }

    @Nested
    @DisplayName("checkHealth")
    class CheckHealthTests {

        @Test
        @DisplayName("returns UNKNOWN when connection not found")
        void checkHealth_connectionNotFound() {
            when(hotelsComConnectionRepository.findById(99L)).thenReturn(Optional.empty());

            HealthStatus status = adapter.checkHealth(99L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }

        @Test
        @DisplayName("returns HEALTHY when connection is ACTIVE")
        void checkHealth_active() {
            HotelsComConnection connection = new HotelsComConnection();
            connection.setStatus(HotelsComConnectionStatus.ACTIVE);
            when(hotelsComConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.HEALTHY);
        }

        @Test
        @DisplayName("returns UNHEALTHY when connection is ERROR")
        void checkHealth_error() {
            HotelsComConnection connection = new HotelsComConnection();
            connection.setStatus(HotelsComConnectionStatus.ERROR);
            when(hotelsComConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNHEALTHY);
        }

        @Test
        @DisplayName("returns DEGRADED when connection is INACTIVE")
        void checkHealth_inactive() {
            HotelsComConnection connection = new HotelsComConnection();
            connection.setStatus(HotelsComConnectionStatus.INACTIVE);
            when(hotelsComConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.DEGRADED);
        }

        @Test
        @DisplayName("returns UNKNOWN when repository throws exception")
        void checkHealth_exception() {
            when(hotelsComConnectionRepository.findById(1L))
                    .thenThrow(new RuntimeException("DB error"));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }
    }

    @Nested
    @DisplayName("handleInboundEvent")
    class HandleInboundEventTests {

        @Test
        @DisplayName("does not throw on any event type (delegates to polling scheduler)")
        void handleInboundEvent_noOp() {
            adapter.handleInboundEvent("reservation.created", Map.of(), 1L);
            // No exception should be thrown; delegates to polling scheduler
        }
    }
}
