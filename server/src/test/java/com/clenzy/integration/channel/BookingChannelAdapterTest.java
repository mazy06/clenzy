package com.clenzy.integration.channel;

import com.clenzy.integration.booking.config.BookingConfig;
import com.clenzy.integration.booking.model.BookingConnection;
import com.clenzy.integration.booking.repository.BookingConnectionRepository;
import com.clenzy.integration.booking.service.BookingApiClient;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.service.PriceEngine;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingChannelAdapterTest {

    @Mock private BookingConfig bookingConfig;
    @Mock private BookingApiClient bookingApiClient;
    @Mock private BookingConnectionRepository bookingConnectionRepository;
    @Mock private ChannelMappingRepository channelMappingRepository;
    @Mock private PriceEngine priceEngine;

    private BookingChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new BookingChannelAdapter(bookingConfig, bookingApiClient,
                bookingConnectionRepository, channelMappingRepository, priceEngine);
    }

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.BOOKING);
    }

    @Test
    void capabilities() {
        assertThat(adapter.getCapabilities()).containsExactlyInAnyOrder(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.OUTBOUND_RESERVATIONS,
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
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.BOOKING, 1L))
                    .thenReturn(Optional.of(mapping));

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isPresent();
        }

        @Test
        @DisplayName("returns empty when not found")
        void resolveMapping_notFound() {
            when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.BOOKING, 1L))
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
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun mapping Booking.com");
        }

        @Test
        @DisplayName("returns FAILED when config is incomplete")
        void pushCalendarUpdate_configIncomplete() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Configuration Booking.com incomplete");
        }

        @Test
        @DisplayName("returns SUCCESS when API call succeeds")
        void pushCalendarUpdate_success() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(true);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
        }

        @Test
        @DisplayName("returns FAILED when API call returns false")
        void pushCalendarUpdate_apiFailure() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(bookingApiClient.updateAvailability(anyList())).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Echec mise a jour");
        }

        @Test
        @DisplayName("returns FAILED when API throws exception")
        void pushCalendarUpdate_exception() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(mapping.getExternalId()).thenReturn("room-123");
            when(channelMappingRepository.findByPropertyIdAndChannel(propertyId, ChannelName.BOOKING, orgId))
                    .thenReturn(Optional.of(mapping));
            when(bookingConfig.isConfigured()).thenReturn(true);
            when(bookingApiClient.updateAvailability(anyList()))
                    .thenThrow(new RuntimeException("Connection timeout"));

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur API Booking.com");
            assertThat(result.getMessage()).contains("Connection timeout");
        }
    }

    @Nested
    @DisplayName("checkHealth")
    class CheckHealthTests {

        @Test
        @DisplayName("returns UNKNOWN when connection not found")
        void checkHealth_connectionNotFound() {
            when(bookingConnectionRepository.findById(99L)).thenReturn(Optional.empty());

            HealthStatus status = adapter.checkHealth(99L);
            assertThat(status).isEqualTo(HealthStatus.UNKNOWN);
        }

        @Test
        @DisplayName("returns UNHEALTHY when connection is inactive")
        void checkHealth_inactive() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.INACTIVE);
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNHEALTHY);
        }

        @Test
        @DisplayName("returns UNHEALTHY when config is not configured")
        void checkHealth_configNotConfigured() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.ACTIVE);
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));
            when(bookingConfig.isConfigured()).thenReturn(false);

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.UNHEALTHY);
        }

        @Test
        @DisplayName("returns HEALTHY when active with recent sync")
        void checkHealth_healthyRecentSync() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.ACTIVE);
            connection.setLastSyncAt(LocalDateTime.now().minusMinutes(30));
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));
            when(bookingConfig.isConfigured()).thenReturn(true);

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.HEALTHY);
        }

        @Test
        @DisplayName("returns DEGRADED when active but has error message and no recent sync")
        void checkHealth_degraded() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.ACTIVE);
            connection.setLastSyncAt(LocalDateTime.now().minusHours(2));
            connection.setErrorMessage("Temporary API error");
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));
            when(bookingConfig.isConfigured()).thenReturn(true);

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.DEGRADED);
        }

        @Test
        @DisplayName("returns HEALTHY when active with no recent sync but no error")
        void checkHealth_healthyNoRecentSyncNoError() {
            BookingConnection connection = new BookingConnection();
            connection.setStatus(BookingConnection.BookingConnectionStatus.ACTIVE);
            connection.setLastSyncAt(LocalDateTime.now().minusHours(2));
            connection.setErrorMessage(null);
            when(bookingConnectionRepository.findById(1L)).thenReturn(Optional.of(connection));
            when(bookingConfig.isConfigured()).thenReturn(true);

            HealthStatus status = adapter.checkHealth(1L);
            assertThat(status).isEqualTo(HealthStatus.HEALTHY);
        }
    }

    @Nested
    @DisplayName("handleInboundEvent")
    class HandleInboundEventTests {

        @Test
        @DisplayName("does not throw on any event type (delegates to Kafka consumers)")
        void handleInboundEvent_noOp() {
            // handleInboundEvent is a no-op for Booking — it delegates to Kafka consumers
            adapter.handleInboundEvent("calendar.updated", Map.of(), 1L);
            // No exception should be thrown; no mock interactions expected
        }
    }

    @Nested
    @DisplayName("pushReservationUpdate")
    class PushReservationUpdateTests {

        @Test
        @DisplayName("returns SKIPPED — Booking manages reservations externally")
        void pushReservationUpdate_skipped() {
            SyncResult result = adapter.pushReservationUpdate(1L, 1L);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Booking.com gere les reservations");
        }
    }
}
