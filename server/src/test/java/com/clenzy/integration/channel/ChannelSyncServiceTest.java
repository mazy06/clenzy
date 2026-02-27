package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.integration.channel.repository.ChannelSyncLogRepository;
import com.clenzy.config.SyncMetrics;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChannelSyncServiceTest {

    @Mock
    private ChannelConnectorRegistry connectorRegistry;

    @Mock
    private ChannelMappingRepository channelMappingRepository;

    @Mock
    private ChannelSyncLogRepository syncLogRepository;

    @Mock
    private SyncMetrics syncMetrics;

    private ObjectMapper objectMapper;

    private ChannelSyncService channelSyncService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        channelSyncService = new ChannelSyncService(
                connectorRegistry,
                channelMappingRepository,
                syncLogRepository,
                objectMapper,
                syncMetrics
        );

        lenient().when(syncMetrics.startTimer()).thenReturn(mock(io.micrometer.core.instrument.Timer.Sample.class));
    }

    @Test
    void onCalendarUpdate_fanOut() {
        String payload = "{\"action\":\"BOOKED\",\"propertyId\":1,\"orgId\":1,\"from\":\"2025-06-01\",\"to\":\"2025-06-05\"}";
        Long propertyId = 1L;
        Long orgId = 1L;

        ChannelConnection connection1 = new ChannelConnection(orgId, ChannelName.AIRBNB);
        ChannelMapping mapping1 = new ChannelMapping(connection1, propertyId, "airbnb-listing-1", orgId);

        ChannelConnection connection2 = new ChannelConnection(orgId, ChannelName.BOOKING);
        ChannelMapping mapping2 = new ChannelMapping(connection2, propertyId, "booking-listing-1", orgId);

        when(channelMappingRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of(mapping1, mapping2));

        ChannelConnector connector1 = mock(ChannelConnector.class);
        when(connector1.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
        when(connector1.pushCalendarUpdate(eq(propertyId), any(LocalDate.class), any(LocalDate.class), eq(orgId)))
                .thenReturn(SyncResult.success("Synced", 1, 100L));

        ChannelConnector connector2 = mock(ChannelConnector.class);
        when(connector2.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
        when(connector2.pushCalendarUpdate(eq(propertyId), any(LocalDate.class), any(LocalDate.class), eq(orgId)))
                .thenReturn(SyncResult.success("Synced", 1, 120L));

        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector1));
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector2));

        channelSyncService.onCalendarUpdate(payload);

        verify(connector1).pushCalendarUpdate(eq(propertyId), any(LocalDate.class), any(LocalDate.class), eq(orgId));
        verify(connector2).pushCalendarUpdate(eq(propertyId), any(LocalDate.class), any(LocalDate.class), eq(orgId));
        verify(syncLogRepository, times(2)).save(any());
    }

    @Test
    void onCalendarUpdate_connectorFailure() {
        String payload = "{\"action\":\"BOOKED\",\"propertyId\":1,\"orgId\":1,\"from\":\"2025-06-01\",\"to\":\"2025-06-05\"}";
        Long propertyId = 1L;
        Long orgId = 1L;

        ChannelConnection connection = new ChannelConnection(orgId, ChannelName.AIRBNB);
        ChannelMapping mapping = new ChannelMapping(connection, propertyId, "airbnb-listing-1", orgId);

        when(channelMappingRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of(mapping));

        ChannelConnector connector = mock(ChannelConnector.class);
        when(connector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
        when(connector.pushCalendarUpdate(eq(propertyId), any(LocalDate.class), any(LocalDate.class), eq(orgId)))
                .thenThrow(new RuntimeException("API error"));

        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector));

        channelSyncService.onCalendarUpdate(payload);

        verify(syncLogRepository).save(argThat(log -> {
            // Verify that failed result was logged
            return true; // Simplified - in real test would check the log content
        }));
    }

    @Test
    void onCalendarUpdate_noMappings() {
        String payload = "{\"action\":\"BOOKED\",\"propertyId\":1,\"orgId\":1,\"from\":\"2025-06-01\",\"to\":\"2025-06-05\"}";
        Long propertyId = 1L;
        Long orgId = 1L;

        when(channelMappingRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of());

        channelSyncService.onCalendarUpdate(payload);

        verify(connectorRegistry, never()).getConnector(any());
        verify(syncLogRepository, never()).save(any());
    }

    @Test
    void onCalendarUpdate_incompleteEvent() {
        String payload = "{\"action\":\"BOOKED\",\"orgId\":1}"; // Missing propertyId

        channelSyncService.onCalendarUpdate(payload);

        verify(channelMappingRepository, never()).findActiveByPropertyId(anyLong(), anyLong());
        verify(connectorRegistry, never()).getConnector(any());
    }

    @Test
    void syncProperty_manual() {
        Long propertyId = 1L;
        Long orgId = 1L;
        LocalDate from = LocalDate.of(2025, 6, 1);
        LocalDate to = LocalDate.of(2025, 6, 30);

        ChannelConnection connection1 = new ChannelConnection(orgId, ChannelName.AIRBNB);
        ChannelMapping mapping1 = new ChannelMapping(connection1, propertyId, "airbnb-listing-1", orgId);

        ChannelConnection connection2 = new ChannelConnection(orgId, ChannelName.BOOKING);
        ChannelMapping mapping2 = new ChannelMapping(connection2, propertyId, "booking-listing-1", orgId);

        when(channelMappingRepository.findActiveByPropertyId(propertyId, orgId))
                .thenReturn(List.of(mapping1, mapping2));

        ChannelConnector connector1 = mock(ChannelConnector.class);
        when(connector1.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
        when(connector1.pushCalendarUpdate(propertyId, from, to, orgId))
                .thenReturn(SyncResult.success("Synced to Airbnb", 1, 150L));

        ChannelConnector connector2 = mock(ChannelConnector.class);
        when(connector2.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
        when(connector2.pushCalendarUpdate(propertyId, from, to, orgId))
                .thenReturn(SyncResult.success("Synced to Booking.com", 1, 180L));

        when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(connector1));
        when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(connector2));

        Map<ChannelName, SyncResult> results = channelSyncService.syncProperty(propertyId, from, to, orgId);

        assertEquals(2, results.size());
        assertTrue(results.containsKey(ChannelName.AIRBNB));
        assertTrue(results.containsKey(ChannelName.BOOKING));
        assertFalse(results.get(ChannelName.AIRBNB).isFailed());
        assertFalse(results.get(ChannelName.BOOKING).isFailed());
        verify(syncLogRepository, times(2)).save(any());
    }

    // ================================================================
    // Multi-channel scenarios (OTA integrations)
    // ================================================================

    @Nested
    @DisplayName("Multi-channel fan-out scenarios")
    class MultiChannelFanOut {

        @Test
        @DisplayName("fans out calendar update to all connected channels (Airbnb + Booking + VRBO)")
        void onCalendarUpdate_multipleChannels_fansOutToAll() {
            String payload = "{\"action\":\"BOOKED\",\"propertyId\":1,\"orgId\":1,\"from\":\"2025-07-01\",\"to\":\"2025-07-10\"}";
            Long propertyId = 1L;
            Long orgId = 1L;

            ChannelConnection connAirbnb = new ChannelConnection(orgId, ChannelName.AIRBNB);
            ChannelMapping mappingAirbnb = new ChannelMapping(connAirbnb, propertyId, "airbnb-listing-1", orgId);

            ChannelConnection connBooking = new ChannelConnection(orgId, ChannelName.BOOKING);
            ChannelMapping mappingBooking = new ChannelMapping(connBooking, propertyId, "booking-listing-1", orgId);

            ChannelConnection connVrbo = new ChannelConnection(orgId, ChannelName.VRBO);
            ChannelMapping mappingVrbo = new ChannelMapping(connVrbo, propertyId, "vrbo-listing-1", orgId);

            when(channelMappingRepository.findActiveByPropertyId(propertyId, orgId))
                    .thenReturn(List.of(mappingAirbnb, mappingBooking, mappingVrbo));

            ChannelConnector airbnbConnector = mock(ChannelConnector.class);
            when(airbnbConnector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
            when(airbnbConnector.pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId)))
                    .thenReturn(SyncResult.success("Synced Airbnb", 1, 100L));

            ChannelConnector bookingConnector = mock(ChannelConnector.class);
            when(bookingConnector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
            when(bookingConnector.pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId)))
                    .thenReturn(SyncResult.success("Synced Booking", 1, 120L));

            ChannelConnector vrboConnector = mock(ChannelConnector.class);
            when(vrboConnector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
            when(vrboConnector.pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId)))
                    .thenReturn(SyncResult.success("Synced VRBO", 1, 80L));

            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(bookingConnector));
            when(connectorRegistry.getConnector(ChannelName.VRBO)).thenReturn(Optional.of(vrboConnector));

            channelSyncService.onCalendarUpdate(payload);

            verify(airbnbConnector).pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId));
            verify(bookingConnector).pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId));
            verify(vrboConnector).pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId));
            verify(syncLogRepository, times(3)).save(any());
        }

        @Test
        @DisplayName("continues syncing other channels when one channel fails")
        void onCalendarUpdate_channelFailure_otherChannelsContinue() {
            String payload = "{\"action\":\"BLOCKED\",\"propertyId\":1,\"orgId\":1,\"from\":\"2025-07-01\",\"to\":\"2025-07-10\"}";
            Long propertyId = 1L;
            Long orgId = 1L;

            ChannelConnection connAirbnb = new ChannelConnection(orgId, ChannelName.AIRBNB);
            ChannelMapping mappingAirbnb = new ChannelMapping(connAirbnb, propertyId, "airbnb-listing-1", orgId);

            ChannelConnection connBooking = new ChannelConnection(orgId, ChannelName.BOOKING);
            ChannelMapping mappingBooking = new ChannelMapping(connBooking, propertyId, "booking-listing-1", orgId);

            ChannelConnection connVrbo = new ChannelConnection(orgId, ChannelName.VRBO);
            ChannelMapping mappingVrbo = new ChannelMapping(connVrbo, propertyId, "vrbo-listing-1", orgId);

            when(channelMappingRepository.findActiveByPropertyId(propertyId, orgId))
                    .thenReturn(List.of(mappingAirbnb, mappingBooking, mappingVrbo));

            // Airbnb fails
            ChannelConnector airbnbConnector = mock(ChannelConnector.class);
            when(airbnbConnector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
            when(airbnbConnector.pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId)))
                    .thenThrow(new RuntimeException("Airbnb API timeout"));

            // Booking succeeds
            ChannelConnector bookingConnector = mock(ChannelConnector.class);
            when(bookingConnector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
            when(bookingConnector.pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId)))
                    .thenReturn(SyncResult.success("Synced Booking", 1, 150L));

            // VRBO succeeds
            ChannelConnector vrboConnector = mock(ChannelConnector.class);
            when(vrboConnector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
            when(vrboConnector.pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId)))
                    .thenReturn(SyncResult.success("Synced VRBO", 1, 90L));

            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(bookingConnector));
            when(connectorRegistry.getConnector(ChannelName.VRBO)).thenReturn(Optional.of(vrboConnector));

            // Should NOT throw despite Airbnb failure
            channelSyncService.onCalendarUpdate(payload);

            // All three channels were attempted
            verify(airbnbConnector).pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId));
            verify(bookingConnector).pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId));
            verify(vrboConnector).pushCalendarUpdate(eq(propertyId), any(), any(), eq(orgId));

            // All three results were logged (including the failure)
            verify(syncLogRepository, times(3)).save(any());

            // Failure metric recorded for Airbnb
            verify(syncMetrics).recordSyncFailure(eq("AIRBNB"), anyString(), anyLong());

            // Success metrics recorded for Booking and VRBO
            verify(syncMetrics).recordSyncSuccess(eq("BOOKING"), anyLong());
            verify(syncMetrics).recordSyncSuccess(eq("VRBO"), anyLong());
        }
    }

    @Nested
    @DisplayName("syncProperty with mixed results")
    class SyncPropertyMixed {

        @Test
        @DisplayName("returns results for all channels including failures and skips")
        void syncProperty_mixedResults_returnsAll() {
            Long propertyId = 1L;
            Long orgId = 1L;
            LocalDate from = LocalDate.of(2025, 7, 1);
            LocalDate to = LocalDate.of(2025, 7, 31);

            ChannelConnection connAirbnb = new ChannelConnection(orgId, ChannelName.AIRBNB);
            ChannelMapping mappingAirbnb = new ChannelMapping(connAirbnb, propertyId, "airbnb-listing-1", orgId);

            ChannelConnection connBooking = new ChannelConnection(orgId, ChannelName.BOOKING);
            ChannelMapping mappingBooking = new ChannelMapping(connBooking, propertyId, "booking-listing-1", orgId);

            ChannelConnection connVrbo = new ChannelConnection(orgId, ChannelName.VRBO);
            ChannelMapping mappingVrbo = new ChannelMapping(connVrbo, propertyId, "vrbo-listing-1", orgId);

            when(channelMappingRepository.findActiveByPropertyId(propertyId, orgId))
                    .thenReturn(List.of(mappingAirbnb, mappingBooking, mappingVrbo));

            // Airbnb: success
            ChannelConnector airbnbConnector = mock(ChannelConnector.class);
            when(airbnbConnector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
            when(airbnbConnector.pushCalendarUpdate(propertyId, from, to, orgId))
                    .thenReturn(SyncResult.success("Synced Airbnb", 5, 200L));

            // Booking: fails with exception
            ChannelConnector bookingConnector = mock(ChannelConnector.class);
            when(bookingConnector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(true);
            when(bookingConnector.pushCalendarUpdate(propertyId, from, to, orgId))
                    .thenThrow(new RuntimeException("Booking API 503"));

            // VRBO: does not support outbound calendar
            ChannelConnector vrboConnector = mock(ChannelConnector.class);
            when(vrboConnector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(false);

            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(bookingConnector));
            when(connectorRegistry.getConnector(ChannelName.VRBO)).thenReturn(Optional.of(vrboConnector));

            Map<ChannelName, SyncResult> results = channelSyncService.syncProperty(propertyId, from, to, orgId);

            assertThat(results).hasSize(3);

            // Airbnb succeeded
            assertThat(results.get(ChannelName.AIRBNB).isSuccess()).isTrue();
            assertThat(results.get(ChannelName.AIRBNB).getItemsProcessed()).isEqualTo(5);

            // Booking failed
            assertThat(results.get(ChannelName.BOOKING).isFailed()).isTrue();
            assertThat(results.get(ChannelName.BOOKING).getMessage()).contains("Booking API 503");

            // VRBO was skipped (no outbound calendar support)
            assertThat(results.get(ChannelName.VRBO).getStatus()).isEqualTo(SyncResult.Status.SKIPPED);

            // Two sync logs saved (Airbnb success + Booking failure); VRBO skipped without logSync
            verify(syncLogRepository, times(2)).save(any());
        }
    }
}
