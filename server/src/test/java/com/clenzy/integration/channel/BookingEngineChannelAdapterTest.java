package com.clenzy.integration.channel;

import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingEngineChannelAdapterTest {

    @Mock private ChannelMappingRepository channelMappingRepository;
    @Mock private CacheManager cacheManager;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private ObjectProvider<SimpMessagingTemplate> messagingProvider;
    @Mock private Cache cache;

    private BookingEngineChannelAdapter adapter;

    @BeforeEach
    void setUp() {
        when(messagingProvider.getIfAvailable()).thenReturn(messagingTemplate);
        adapter = new BookingEngineChannelAdapter(channelMappingRepository, cacheManager, messagingProvider);
    }

    @Test
    void getChannelName_isBookingEngine() {
        assertEquals(ChannelName.BOOKING_ENGINE, adapter.getChannelName());
    }

    @Test
    void getCapabilities_includesOutboundHostProfileAndContentSync() {
        assertTrue(adapter.getCapabilities().contains(ChannelCapability.OUTBOUND_HOST_PROFILE));
        assertTrue(adapter.getCapabilities().contains(ChannelCapability.CONTENT_SYNC));
        assertEquals(2, adapter.getCapabilities().size());
    }

    @Test
    void resolveMapping_delegatesToRepository() {
        ChannelMapping mapping = new ChannelMapping();
        when(channelMappingRepository.findByPropertyIdAndChannel(1L, ChannelName.BOOKING_ENGINE, 5L))
            .thenReturn(Optional.of(mapping));

        Optional<ChannelMapping> result = adapter.resolveMapping(1L, 5L);

        assertTrue(result.isPresent());
    }

    @Test
    void handleInboundEvent_noOp() {
        // Should not throw
        assertDoesNotThrow(() -> adapter.handleInboundEvent("any", Map.of(), 1L));
    }

    @Test
    void pushHostProfile_validProfile_evictsCacheAndBroadcasts() {
        when(cacheManager.getCache(BookingEngineChannelAdapter.PROPERTY_CACHE)).thenReturn(cache);
        HostProfileUpdate profile = new HostProfileUpdate(
            42L, "John", "Doe", "j@x.com", "+33", "https://pic.url");

        SyncResult result = adapter.pushHostProfile(profile, 1L);

        assertTrue(result.isSuccess());
        assertEquals(1, result.getItemsProcessed());
        verify(cache).clear();
        verify(messagingTemplate).convertAndSend(eq("/topic/booking-engine/host/42"), any(Map.class));
    }

    @Test
    void pushHostProfile_nullProfile_returnsFailure() {
        SyncResult result = adapter.pushHostProfile(null, 1L);
        assertTrue(result.isFailed());
        verify(cache, never()).clear();
    }

    @Test
    void pushHostProfile_nullUserId_returnsFailure() {
        HostProfileUpdate profile = new HostProfileUpdate(null, "F", "L", "e", "p", "u");
        SyncResult result = adapter.pushHostProfile(profile, 1L);
        assertTrue(result.isFailed());
    }

    @Test
    void pushHostProfile_noCacheRegistered_stillSucceeds() {
        when(cacheManager.getCache(any())).thenReturn(null);
        HostProfileUpdate profile = new HostProfileUpdate(1L, "F", "L", "e", "p", "u");

        SyncResult result = adapter.pushHostProfile(profile, 1L);

        assertTrue(result.isSuccess());
    }

    @Test
    void pushHostProfile_nullFirstName_handledGracefully() {
        when(cacheManager.getCache(any())).thenReturn(cache);
        HostProfileUpdate profile = new HostProfileUpdate(1L, null, null, "e", "p", null);

        SyncResult result = adapter.pushHostProfile(profile, 1L);

        assertTrue(result.isSuccess());
        verify(messagingTemplate).convertAndSend(any(String.class), any(Map.class));
    }

    @Test
    void pushHostProfile_messagingThrows_stillSucceeds() {
        when(cacheManager.getCache(any())).thenReturn(cache);
        doThrow(new RuntimeException("boom")).when(messagingTemplate).convertAndSend(any(String.class), any(Map.class));
        HostProfileUpdate profile = new HostProfileUpdate(1L, "F", "L", null, null, null);

        SyncResult result = adapter.pushHostProfile(profile, 1L);

        assertTrue(result.isSuccess());
    }

    @Test
    void pushHostProfile_withoutMessagingTemplate_stillSucceeds() {
        ObjectProvider<SimpMessagingTemplate> emptyProvider = mock(ObjectProvider.class);
        when(emptyProvider.getIfAvailable()).thenReturn(null);
        BookingEngineChannelAdapter localAdapter = new BookingEngineChannelAdapter(
            channelMappingRepository, cacheManager, emptyProvider);
        when(cacheManager.getCache(any())).thenReturn(cache);
        HostProfileUpdate profile = new HostProfileUpdate(1L, "F", "L", null, null, null);

        SyncResult result = localAdapter.pushHostProfile(profile, 1L);

        assertTrue(result.isSuccess());
    }
}
