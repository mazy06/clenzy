package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.ICalFeed;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.service.ICalImportService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ICalChannelAdapterTest {

    @Mock private ICalImportService iCalImportService;
    @Mock private ICalFeedRepository iCalFeedRepository;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private ICalChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new ICalChannelAdapter(iCalImportService, iCalFeedRepository, channelMappingRepository);
    }

    @Test void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.ICAL);
    }

    @Test void capabilities() {
        assertThat(adapter.getCapabilities()).contains(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.POLLING
        );
    }

    @Test void resolveMapping() {
        ChannelMapping mapping = mock(ChannelMapping.class);
        when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.ICAL, 1L))
                .thenReturn(Optional.of(mapping));

        Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
        assertThat(result).isPresent();
    }

    @Test void handleInboundEvent_icalPoll_success() {
        ICalFeed feed = mock(ICalFeed.class);
        when(iCalFeedRepository.findByPropertyIdAndUrl(1L, "https://cal.ics", 1L)).thenReturn(feed);

        Map<String, Object> data = Map.of("feedUrl", "https://cal.ics", "propertyId", 1L);
        adapter.handleInboundEvent("ical.poll", data, 1L);

        verify(iCalImportService).syncFeeds(List.of(feed));
    }

    @Test void handleInboundEvent_missingData() {
        Map<String, Object> data = Map.of("feedUrl", "https://cal.ics");
        adapter.handleInboundEvent("ical.poll", data, 1L);
        verifyNoInteractions(iCalImportService);
    }

    @Test void handleInboundEvent_invalidPropertyId() {
        Map<String, Object> data = Map.of("feedUrl", "https://cal.ics", "propertyId", "not-a-number");
        adapter.handleInboundEvent("ical.poll", data, 1L);
        verifyNoInteractions(iCalImportService);
    }

    @Test void handleInboundEvent_feedNotFound() {
        when(iCalFeedRepository.findByPropertyIdAndUrl(1L, "https://cal.ics", 1L)).thenReturn(null);

        Map<String, Object> data = Map.of("feedUrl", "https://cal.ics", "propertyId", 1L);
        adapter.handleInboundEvent("ical.poll", data, 1L);

        verifyNoInteractions(iCalImportService);
    }

    @Test void handleInboundEvent_unknownEventType() {
        Map<String, Object> data = Map.of("feedUrl", "url", "propertyId", 1L);
        adapter.handleInboundEvent("unknown.event", data, 1L);
        verifyNoInteractions(iCalImportService);
    }

    @Test void checkHealth_alwaysHealthy() {
        assertThat(adapter.checkHealth(1L)).isEqualTo(HealthStatus.HEALTHY);
    }
}
