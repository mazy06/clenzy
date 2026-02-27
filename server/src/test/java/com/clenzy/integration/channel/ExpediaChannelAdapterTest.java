package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.expedia.config.ExpediaConfig;
import com.clenzy.integration.expedia.model.ExpediaConnection;
import com.clenzy.integration.expedia.model.ExpediaConnection.ExpediaConnectionStatus;
import com.clenzy.integration.expedia.repository.ExpediaConnectionRepository;
import com.clenzy.integration.expedia.service.ExpediaApiClient;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpediaChannelAdapterTest {

    @Mock private ExpediaConfig expediaConfig;
    @Mock private ExpediaApiClient expediaApiClient;
    @Mock private ExpediaConnectionRepository expediaConnectionRepository;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private ExpediaChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new ExpediaChannelAdapter(expediaConfig, expediaApiClient,
                expediaConnectionRepository, channelMappingRepository);
    }

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.VRBO);
    }

    @Test
    void capabilities() {
        assertThat(adapter.getCapabilities()).containsExactlyInAnyOrder(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.OUTBOUND_RESERVATIONS,
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
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.VRBO, 1L))
                    .thenReturn(Optional.of(mapping));

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isPresent();
        }

        @Test
        @DisplayName("returns empty when not found")
        void resolveMapping_notFound() {
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.VRBO, 1L))
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
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.VRBO, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun mapping Expedia/VRBO");
        }

        @Test
        @DisplayName("returns SKIPPED when Expedia is not configured")
        void pushCalendarUpdate_notConfigured() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.VRBO, orgId))
                    .thenReturn(Optional.of(mapping));
            when(expediaConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Expedia non configure");
        }

        @Test
        @DisplayName("returns SUCCESS when API call succeeds")
        void pushCalendarUpdate_success() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("exp-prop-789");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.VRBO, orgId))
                    .thenReturn(Optional.of(mapping));
            when(expediaConfig.isConfigured()).thenReturn(true);
            when(expediaApiClient.updateAvailability(eq("exp-prop-789"), anyList())).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isGreaterThan(0);
        }

        @Test
        @DisplayName("returns FAILED when API call returns false")
        void pushCalendarUpdate_apiFailure() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("exp-prop-789");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.VRBO, orgId))
                    .thenReturn(Optional.of(mapping));
            when(expediaConfig.isConfigured()).thenReturn(true);
            when(expediaApiClient.updateAvailability(eq("exp-prop-789"), anyList())).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Echec mise a jour disponibilite Expedia");
        }

        @Test
        @DisplayName("returns FAILED when API throws exception")
        void pushCalendarUpdate_exception() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("exp-prop-789");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.VRBO, orgId))
                    .thenReturn(Optional.of(mapping));
            when(expediaConfig.isConfigured()).thenReturn(true);
            when(expediaApiClient.updateAvailability(eq("exp-prop-789"), anyList()))
                    .thenThrow(new RuntimeException("API timeout"));

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur API Expedia");
            assertThat(result.getMessage()).contains("API timeout");
        }
    }

    @Nested
    @DisplayName("pushReservationUpdate")
    class PushReservationUpdateTests {

        @Test
        @DisplayName("returns SKIPPED when Expedia is not configured")
        void pushReservationUpdate_notConfigured() {
            when(expediaConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushReservationUpdate(1L, 1L);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Expedia non configure");
        }

        @Test
        @DisplayName("returns SKIPPED — not yet implemented")
        void pushReservationUpdate_skipped() {
            when(expediaConfig.isConfigured()).thenReturn(true);

            SyncResult result = adapter.pushReservationUpdate(1L, 1L);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("prochaine iteration");
        }
    }

    @Nested
    @DisplayName("checkHealth")
    class CheckHealthTests {

        @Test
        @DisplayName("returns UNKNOWN when connection not found")
        void checkHealth_connectionNotFound() {
            when(expediaConnectionRepository.findById(99L)).thenReturn(Optional.empty());

            HealthStatus status = adapter.checkHealth(99L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }

        @Test
        @DisplayName("returns HEALTHY when connection is ACTIVE")
        void checkHealth_active() {
            ExpediaConnection connection = new ExpediaConnection();
            connection.setStatus(ExpediaConnectionStatus.ACTIVE);
            when(expediaConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.HEALTHY);
        }

        @Test
        @DisplayName("returns DEGRADED when connection is INACTIVE")
        void checkHealth_inactive() {
            ExpediaConnection connection = new ExpediaConnection();
            connection.setStatus(ExpediaConnectionStatus.INACTIVE);
            when(expediaConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.DEGRADED);
        }

        @Test
        @DisplayName("returns UNHEALTHY when connection is ERROR")
        void checkHealth_error() {
            ExpediaConnection connection = new ExpediaConnection();
            connection.setStatus(ExpediaConnectionStatus.ERROR);
            when(expediaConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNHEALTHY);
        }

        @Test
        @DisplayName("returns UNKNOWN when repository throws exception")
        void checkHealth_exception() {
            when(expediaConnectionRepository.findById(1L))
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
            adapter.handleInboundEvent("calendar.updated", Map.of(), 1L);
            // No exception should be thrown; delegates to Kafka consumers
        }
    }
}
