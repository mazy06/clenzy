package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.direct.config.DirectBookingConfig;
import com.clenzy.integration.direct.model.DirectBookingConfiguration;
import com.clenzy.integration.direct.repository.DirectBookingConfigRepository;
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
class DirectChannelAdapterTest {

    @Mock private DirectBookingConfig config;
    @Mock private DirectBookingConfigRepository configRepository;

    private DirectChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new DirectChannelAdapter(config, configRepository);
    }

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.DIRECT);
    }

    @Test
    void capabilities() {
        assertThat(adapter.getCapabilities()).containsExactlyInAnyOrder(
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.OUTBOUND_CALENDAR
        );
    }

    @Nested
    @DisplayName("resolveMapping")
    class ResolveMappingTests {

        @Test
        @DisplayName("returns empty when direct booking is disabled globally")
        void resolveMapping_disabledGlobally() {
            when(config.isEnabled()).thenReturn(false);

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isEmpty();
            verifyNoInteractions(configRepository);
        }

        @Test
        @DisplayName("returns empty when no DirectBookingConfiguration found for property")
        void resolveMapping_noConfig() {
            when(config.isEnabled()).thenReturn(true);
            when(configRepository.findEnabledByPropertyId(1L, 1L)).thenReturn(Optional.empty());

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns virtual mapping when direct booking is enabled for property")
        void resolveMapping_found() {
            when(config.isEnabled()).thenReturn(true);
            DirectBookingConfiguration dbConfig = new DirectBookingConfiguration(1L, 42L);
            when(configRepository.findEnabledByPropertyId(42L, 1L))
                    .thenReturn(Optional.of(dbConfig));

            Optional<ChannelMapping> result = adapter.resolveMapping(42L, 1L);

            assertThat(result).isPresent();
            ChannelMapping mapping = result.get();
            assertThat(mapping.getInternalId()).isEqualTo(42L);
            assertThat(mapping.getExternalId()).isEqualTo("direct-42");
            assertThat(mapping.getEntityType()).isEqualTo("PROPERTY");
            assertThat(mapping.getOrganizationId()).isEqualTo(1L);
            assertThat(mapping.isSyncEnabled()).isTrue();
        }
    }

    @Nested
    @DisplayName("pushCalendarUpdate")
    class PushCalendarUpdateTests {

        @Test
        @DisplayName("returns SKIPPED — calendar is already local for direct channel")
        void pushCalendarUpdate_noOp() {
            SyncResult result = adapter.pushCalendarUpdate(
                    42L,
                    LocalDate.of(2026, 3, 1),
                    LocalDate.of(2026, 3, 15),
                    1L
            );

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("calendrier est deja local");
        }
    }

    @Nested
    @DisplayName("pushReservationUpdate")
    class PushReservationUpdateTests {

        @Test
        @DisplayName("returns SKIPPED — reservation is already local for direct channel")
        void pushReservationUpdate_noOp() {
            SyncResult result = adapter.pushReservationUpdate(1L, 1L);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("reservation est deja locale");
        }
    }

    @Nested
    @DisplayName("checkHealth")
    class CheckHealthTests {

        @Test
        @DisplayName("always returns HEALTHY — no external dependency")
        void checkHealth_alwaysHealthy() {
            assertThat(adapter.checkHealth(1L)).isEqualTo(HealthStatus.HEALTHY);
            assertThat(adapter.checkHealth(99L)).isEqualTo(HealthStatus.HEALTHY);
            assertThat(adapter.checkHealth(null)).isEqualTo(HealthStatus.HEALTHY);
        }
    }

    @Nested
    @DisplayName("handleInboundEvent")
    class HandleInboundEventTests {

        @Test
        @DisplayName("does not throw on any event type (handled by DirectBookingService)")
        void handleInboundEvent_noOp() {
            adapter.handleInboundEvent("booking.created", Map.of(), 1L);
            // No exception should be thrown; direct bookings are handled by DirectBookingService
        }
    }
}
