package com.clenzy.integration.channel;

import com.clenzy.integration.agoda.config.AgodaConfig;
import com.clenzy.integration.agoda.model.AgodaConnection;
import com.clenzy.integration.agoda.model.AgodaConnection.AgodaConnectionStatus;
import com.clenzy.integration.agoda.repository.AgodaConnectionRepository;
import com.clenzy.integration.agoda.service.AgodaApiClient;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
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
class AgodaChannelAdapterTest {

    @Mock private AgodaConfig agodaConfig;
    @Mock private AgodaConnectionRepository agodaConnectionRepository;
    @Mock private AgodaApiClient agodaApiClient;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private AgodaChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new AgodaChannelAdapter(agodaConfig, agodaConnectionRepository,
                agodaApiClient, channelMappingRepository);
    }

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.AGODA);
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
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.AGODA, 1L))
                    .thenReturn(Optional.of(mapping));

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isPresent();
        }

        @Test
        @DisplayName("returns empty when not found")
        void resolveMapping_notFound() {
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.AGODA, 1L))
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
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.AGODA, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun mapping Agoda");
        }

        @Test
        @DisplayName("returns SKIPPED when config is incomplete")
        void pushCalendarUpdate_configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.AGODA, orgId))
                    .thenReturn(Optional.of(mapping));
            when(agodaConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Configuration Agoda incomplete");
        }

        @Test
        @DisplayName("returns SKIPPED — implementation pending (current behavior)")
        void pushCalendarUpdate_skippedPendingImplementation() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("agoda-prop-456");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.AGODA, orgId))
                    .thenReturn(Optional.of(mapping));
            when(agodaConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("phase suivante");
        }

        @Test
        @DisplayName("returns FAILED when exception is thrown")
        void pushCalendarUpdate_exception() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenThrow(new RuntimeException("Agoda API error"));
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.AGODA, orgId))
                    .thenReturn(Optional.of(mapping));
            when(agodaConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Push calendrier Agoda echoue");
        }
    }

    @Nested
    @DisplayName("checkHealth")
    class CheckHealthTests {

        @Test
        @DisplayName("returns UNKNOWN when connection not found")
        void checkHealth_connectionNotFound() {
            when(agodaConnectionRepository.findById(99L)).thenReturn(Optional.empty());

            HealthStatus status = adapter.checkHealth(99L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }

        @Test
        @DisplayName("returns HEALTHY when connection is ACTIVE")
        void checkHealth_active() {
            AgodaConnection connection = new AgodaConnection();
            connection.setStatus(AgodaConnectionStatus.ACTIVE);
            when(agodaConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.HEALTHY);
        }

        @Test
        @DisplayName("returns UNHEALTHY when connection is ERROR")
        void checkHealth_error() {
            AgodaConnection connection = new AgodaConnection();
            connection.setStatus(AgodaConnectionStatus.ERROR);
            when(agodaConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNHEALTHY);
        }

        @Test
        @DisplayName("returns DEGRADED when connection is INACTIVE")
        void checkHealth_inactive() {
            AgodaConnection connection = new AgodaConnection();
            connection.setStatus(AgodaConnectionStatus.INACTIVE);
            when(agodaConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.DEGRADED);
        }

        @Test
        @DisplayName("returns UNKNOWN when repository throws exception")
        void checkHealth_exception() {
            when(agodaConnectionRepository.findById(1L))
                    .thenThrow(new RuntimeException("DB error"));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }
    }

    @Nested
    @DisplayName("handleInboundEvent")
    class HandleInboundEventTests {

        @Test
        @DisplayName("does not throw on any event type (delegates to Kafka consumers)")
        void handleInboundEvent_noOp() {
            adapter.handleInboundEvent("reservation.created", Map.of(), 1L);
            // No exception should be thrown; delegates to Kafka polling consumers
        }
    }
}
