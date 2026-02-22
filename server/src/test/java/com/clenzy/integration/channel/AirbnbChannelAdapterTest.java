package com.clenzy.integration.channel;

import com.clenzy.integration.airbnb.service.AirbnbOAuthService;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AirbnbChannelAdapterTest {

    @Mock private AirbnbOAuthService airbnbOAuthService;
    @Mock private ChannelMappingRepository channelMappingRepository;

    private AirbnbChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new AirbnbChannelAdapter(airbnbOAuthService, channelMappingRepository);
    }

    @Test void channelName() {
        assertThat(adapter.getChannelName()).isEqualTo(ChannelName.AIRBNB);
    }

    @Test void capabilities() {
        assertThat(adapter.getCapabilities()).contains(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS,
                ChannelCapability.OAUTH,
                ChannelCapability.MESSAGING
        );
    }

    @Test void resolveMapping_found() {
        ChannelMapping mapping = mock(ChannelMapping.class);
        when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.AIRBNB, 1L))
                .thenReturn(Optional.of(mapping));

        Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
        assertThat(result).isPresent();
    }

    @Test void resolveMapping_notFound() {
        when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.AIRBNB, 1L))
                .thenReturn(Optional.empty());

        Optional<ChannelMapping> result = adapter.resolveMapping(1L, 1L);
        assertThat(result).isEmpty();
    }
}
