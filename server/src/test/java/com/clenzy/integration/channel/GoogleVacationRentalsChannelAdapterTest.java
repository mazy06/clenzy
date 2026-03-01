package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.google.config.GoogleVacationRentalsConfig;
import com.clenzy.integration.google.service.GoogleVrSyncService;
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
class GoogleVacationRentalsChannelAdapterTest {

    @Mock private GoogleVacationRentalsConfig config;
    @Mock private GoogleVrSyncService syncService;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private GoogleVacationRentalsChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new GoogleVacationRentalsChannelAdapter(config, syncService, channelMappingRepository);
    }

    @Test
    void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.GOOGLE_VACATION_RENTALS);
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
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    1L, ChannelName.GOOGLE_VACATION_RENTALS, 1L))
                    .thenReturn(Optional.of(mapping));

            Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
            assertThat(result).isPresent();
        }

        @Test
        @DisplayName("returns empty when not found")
        void resolveMapping_notFound() {
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    1L, ChannelName.GOOGLE_VACATION_RENTALS, 1L))
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
                    propertyId, ChannelName.GOOGLE_VACATION_RENTALS, orgId))
                    .thenReturn(Optional.empty());

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Aucun mapping Google VR");
        }

        @Test
        @DisplayName("returns SKIPPED when Google VR is not configured")
        void pushCalendarUpdate_notConfigured() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    propertyId, ChannelName.GOOGLE_VACATION_RENTALS, orgId))
                    .thenReturn(Optional.of(mapping));
            when(config.isConfigured()).thenReturn(false);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Google Vacation Rentals non configure");
        }

        @Test
        @DisplayName("returns SKIPPED when sync service returns negative (no active connection)")
        void pushCalendarUpdate_noActiveConnection() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    propertyId, ChannelName.GOOGLE_VACATION_RENTALS, orgId))
                    .thenReturn(Optional.of(mapping));
            when(config.isConfigured()).thenReturn(true);
            when(syncService.pushAvailabilityAndRates(orgId, from, to)).thenReturn(-1);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(result.getMessage()).contains("Pas de connexion Google VR active");
        }

        @Test
        @DisplayName("returns SUCCESS when sync service pushes items")
        void pushCalendarUpdate_success() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    propertyId, ChannelName.GOOGLE_VACATION_RENTALS, orgId))
                    .thenReturn(Optional.of(mapping));
            when(config.isConfigured()).thenReturn(true);
            when(syncService.pushAvailabilityAndRates(orgId, from, to)).thenReturn(14);

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.SUCCESS);
            assertThat(result.getItemsProcessed()).isEqualTo(14);
        }

        @Test
        @DisplayName("returns FAILED when sync service throws exception")
        void pushCalendarUpdate_exception() {
            ChannelMapping mapping = mock(ChannelMapping.class);
            when(channelMappingRepository.findByPropertyIdAndChannel(
                    propertyId, ChannelName.GOOGLE_VACATION_RENTALS, orgId))
                    .thenReturn(Optional.of(mapping));
            when(config.isConfigured()).thenReturn(true);
            when(syncService.pushAvailabilityAndRates(orgId, from, to))
                    .thenThrow(new RuntimeException("Google API unavailable"));

            SyncResult result = adapter.pushCalendarUpdate(propertyId, from, to, orgId);

            assertThat(result.getStatus()).isEqualTo(SyncResult.Status.FAILED);
            assertThat(result.getMessage()).contains("Erreur Google VR");
            assertThat(result.getMessage()).contains("Google API unavailable");
        }
    }

    @Nested
    @DisplayName("handleInboundEvent")
    class HandleInboundEventTests {

        @Test
        @DisplayName("calls syncService.pullBookings for google_vr.bookings.poll event")
        void handleInboundEvent_pollBookings() {
            adapter.handleInboundEvent("google_vr.bookings.poll", Map.of(), 1L);

            verify(syncService).pullBookings(1L);
        }

        @Test
        @DisplayName("does not call pullBookings for other event types")
        void handleInboundEvent_otherEventType() {
            adapter.handleInboundEvent("other.event.type", Map.of(), 1L);

            verify(syncService, never()).pullBookings(anyLong());
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
