package com.clenzy.service;

import com.clenzy.integration.channel.*;
import com.clenzy.integration.channel.model.ChannelConnection;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateAuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RateDistributionServiceTest {

    @Mock private AdvancedRateManager advancedRateManager;
    @Mock private ChannelConnectorRegistry connectorRegistry;
    @Mock private ChannelMappingRepository channelMappingRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private RateAuditLogRepository rateAuditLogRepository;
    @Mock private KafkaTemplate<String, Object> kafkaTemplate;
    @Mock private ObjectMapper objectMapper;

    private RateDistributionService service;

    // Test fixtures
    private static final Long PROPERTY_ID = 42L;
    private static final Long ORG_ID = 1L;
    private static final LocalDate FROM = LocalDate.of(2025, 7, 1);
    private static final LocalDate TO = LocalDate.of(2025, 7, 8);

    @BeforeEach
    void setUp() {
        service = new RateDistributionService(
                advancedRateManager,
                connectorRegistry,
                channelMappingRepository,
                propertyRepository,
                rateAuditLogRepository,
                kafkaTemplate,
                objectMapper
        );
    }

    // -- Helper methods -------------------------------------------------------

    private ChannelMapping createMapping(ChannelName channel) {
        ChannelConnection connection = new ChannelConnection(ORG_ID, channel);
        ChannelMapping mapping = new ChannelMapping(connection, PROPERTY_ID, "ext-" + channel.name(), ORG_ID);
        mapping.setId(100L);
        return mapping;
    }

    private ChannelConnector mockConnector(ChannelName channel, boolean supportsOutbound) {
        ChannelConnector connector = mock(ChannelConnector.class);
        lenient().when(connector.getChannelName()).thenReturn(channel);
        lenient().when(connector.supports(ChannelCapability.OUTBOUND_CALENDAR)).thenReturn(supportsOutbound);
        return connector;
    }

    // =========================================================================
    // distributeRates
    // =========================================================================

    @Nested
    @DisplayName("distributeRates")
    class DistributeRatesTests {

        @Test
        @DisplayName("pushes to all connected channels successfully")
        void distributeRates_pushesToAllConnectedChannels() {
            // Arrange
            ChannelMapping airbnbMapping = createMapping(ChannelName.AIRBNB);
            ChannelMapping bookingMapping = createMapping(ChannelName.BOOKING);

            when(channelMappingRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(airbnbMapping, bookingMapping));

            ChannelConnector airbnbConnector = mockConnector(ChannelName.AIRBNB, true);
            ChannelConnector bookingConnector = mockConnector(ChannelName.BOOKING, true);

            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));
            when(connectorRegistry.getConnector(ChannelName.BOOKING)).thenReturn(Optional.of(bookingConnector));

            when(airbnbConnector.pushCalendarUpdate(PROPERTY_ID, FROM, TO, ORG_ID))
                    .thenReturn(SyncResult.success(7, 150));
            when(bookingConnector.pushCalendarUpdate(PROPERTY_ID, FROM, TO, ORG_ID))
                    .thenReturn(SyncResult.success(7, 200));

            when(advancedRateManager.resolveChannelPriceRange(eq(PROPERTY_ID), eq(FROM), eq(TO), any(), eq(ORG_ID)))
                    .thenReturn(Map.of());

            // Act
            Map<ChannelName, SyncResult> results = service.distributeRates(PROPERTY_ID, FROM, TO, ORG_ID);

            // Assert
            assertThat(results).hasSize(2);
            assertThat(results.get(ChannelName.AIRBNB).isSuccess()).isTrue();
            assertThat(results.get(ChannelName.BOOKING).isSuccess()).isTrue();
            verify(rateAuditLogRepository, times(2)).save(any());
        }

        @Test
        @DisplayName("channel not registered returns FAILED")
        void distributeRates_channelNotRegistered_returnsFailed() {
            // Arrange
            ChannelMapping airbnbMapping = createMapping(ChannelName.AIRBNB);

            when(channelMappingRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(airbnbMapping));
            when(connectorRegistry.getConnector(ChannelName.AIRBNB))
                    .thenReturn(Optional.empty());

            // Act
            Map<ChannelName, SyncResult> results = service.distributeRates(PROPERTY_ID, FROM, TO, ORG_ID);

            // Assert
            assertThat(results).hasSize(1);
            assertThat(results.get(ChannelName.AIRBNB).isFailed()).isTrue();
            assertThat(results.get(ChannelName.AIRBNB).getMessage()).contains("non enregistre");
        }

        @Test
        @DisplayName("channel does not support OUTBOUND_CALENDAR returns SKIPPED")
        void distributeRates_channelDoesNotSupportOutbound_returnsSkipped() {
            // Arrange
            ChannelMapping icalMapping = createMapping(ChannelName.ICAL);

            when(channelMappingRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(icalMapping));

            ChannelConnector icalConnector = mockConnector(ChannelName.ICAL, false);
            when(connectorRegistry.getConnector(ChannelName.ICAL)).thenReturn(Optional.of(icalConnector));

            // Act
            Map<ChannelName, SyncResult> results = service.distributeRates(PROPERTY_ID, FROM, TO, ORG_ID);

            // Assert
            assertThat(results).hasSize(1);
            SyncResult icalResult = results.get(ChannelName.ICAL);
            assertThat(icalResult.getStatus()).isEqualTo(SyncResult.Status.SKIPPED);
            assertThat(icalResult.getMessage()).contains("OUTBOUND_CALENDAR");
        }

        @Test
        @DisplayName("API error returns FAILED with error message")
        void distributeRates_apiError_returnsFailed() {
            // Arrange
            ChannelMapping airbnbMapping = createMapping(ChannelName.AIRBNB);

            when(channelMappingRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of(airbnbMapping));

            ChannelConnector airbnbConnector = mockConnector(ChannelName.AIRBNB, true);
            when(connectorRegistry.getConnector(ChannelName.AIRBNB)).thenReturn(Optional.of(airbnbConnector));

            when(advancedRateManager.resolveChannelPriceRange(eq(PROPERTY_ID), eq(FROM), eq(TO), eq(ChannelName.AIRBNB), eq(ORG_ID)))
                    .thenReturn(Map.of());
            when(airbnbConnector.pushCalendarUpdate(PROPERTY_ID, FROM, TO, ORG_ID))
                    .thenThrow(new RuntimeException("API timeout"));

            // Act
            Map<ChannelName, SyncResult> results = service.distributeRates(PROPERTY_ID, FROM, TO, ORG_ID);

            // Assert
            assertThat(results).hasSize(1);
            assertThat(results.get(ChannelName.AIRBNB).isFailed()).isTrue();
            assertThat(results.get(ChannelName.AIRBNB).getMessage()).contains("API timeout");
        }

        @Test
        @DisplayName("no mappings returns empty map")
        void distributeRates_noMappings_returnsEmptyMap() {
            // Arrange
            when(channelMappingRepository.findActiveByPropertyId(PROPERTY_ID, ORG_ID))
                    .thenReturn(List.of());

            // Act
            Map<ChannelName, SyncResult> results = service.distributeRates(PROPERTY_ID, FROM, TO, ORG_ID);

            // Assert
            assertThat(results).isEmpty();
            verify(connectorRegistry, never()).getConnector(any());
        }
    }
}
