package com.clenzy.service;

import com.clenzy.dto.UserPresenceDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PresenceServiceTest {

    @Mock private StringRedisTemplate redis;
    @Mock private SetOperations<String, String> setOps;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private ObjectProvider<SimpMessagingTemplate> messagingProvider;

    private PresenceService service;

    @BeforeEach
    void setUp() {
        when(redis.opsForSet()).thenReturn(setOps);
        when(redis.opsForValue()).thenReturn(valueOps);
        when(messagingProvider.getIfAvailable()).thenReturn(messagingTemplate);

        service = new PresenceService(redis, messagingProvider);
    }

    private PresenceService serviceWithoutMessaging() {
        when(messagingProvider.getIfAvailable()).thenReturn(null);
        return new PresenceService(redis, messagingProvider);
    }

    // ----- markOnline -----

    @Test
    void markOnline_addsSessionAndExpire() {
        // Was offline
        when(setOps.size(startsWith("presence:sessions:"))).thenReturn(0L);

        service.markOnline("user-1", "session-1");

        verify(setOps).add("presence:sessions:user-1", "session-1");
        verify(redis).expire(eq("presence:sessions:user-1"), eq(Duration.ofMinutes(15)));
    }

    @Test
    void markOnline_firstSession_broadcastsOnline() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(0L);

        service.markOnline("user-1", "session-1");

        verify(messagingTemplate).convertAndSend(eq("/topic/presence"), any(UserPresenceDto.class));
    }

    @Test
    void markOnline_alreadyOnline_doesNotBroadcast() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(1L);

        service.markOnline("user-1", "session-2");

        verify(setOps).add("presence:sessions:user-1", "session-2");
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    void markOnline_nullUserId_returnsEarly() {
        service.markOnline(null, "session-1");
        verifyNoInteractions(setOps);
    }

    @Test
    void markOnline_blankUserId_returnsEarly() {
        service.markOnline("  ", "session-1");
        verifyNoInteractions(setOps);
    }

    @Test
    void markOnline_nullSessionId_returnsEarly() {
        service.markOnline("user-1", null);
        verifyNoInteractions(setOps);
    }

    @Test
    void markOnline_blankSessionId_returnsEarly() {
        service.markOnline("user-1", "   ");
        verifyNoInteractions(setOps);
    }

    // ----- markOffline -----

    @Test
    void markOffline_lastSession_recordsLastSeenAndBroadcasts() {
        when(setOps.remove("presence:sessions:user-1", new Object[]{"session-1"})).thenReturn(1L);
        when(setOps.remove(eq("presence:sessions:user-1"), any(Object[].class))).thenReturn(1L);
        when(setOps.size("presence:sessions:user-1")).thenReturn(0L);

        service.markOffline("user-1", "session-1");

        verify(redis).delete("presence:sessions:user-1");
        verify(valueOps).set(eq("presence:lastSeen:user-1"), anyString(), eq(Duration.ofDays(30)));
        verify(messagingTemplate).convertAndSend(eq("/topic/presence"), any(UserPresenceDto.class));
    }

    @Test
    void markOffline_stillHasSessions_doesNotBroadcast() {
        when(setOps.remove(eq("presence:sessions:user-1"), any(Object[].class))).thenReturn(1L);
        when(setOps.size("presence:sessions:user-1")).thenReturn(2L);

        service.markOffline("user-1", "session-1");

        verify(redis, never()).delete(anyString());
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    void markOffline_nullSizeReturned_treatedAsZero() {
        when(setOps.remove(eq("presence:sessions:user-1"), any(Object[].class))).thenReturn(1L);
        when(setOps.size("presence:sessions:user-1")).thenReturn(null);

        service.markOffline("user-1", "session-1");

        verify(redis).delete("presence:sessions:user-1");
    }

    @Test
    void markOffline_nullUserId_returnsEarly() {
        service.markOffline(null, "session-1");
        verifyNoInteractions(setOps);
    }

    @Test
    void markOffline_blankUserId_returnsEarly() {
        service.markOffline("", "session-1");
        verifyNoInteractions(setOps);
    }

    @Test
    void markOffline_nullSessionId_returnsEarly() {
        service.markOffline("user-1", null);
        verifyNoInteractions(setOps);
    }

    @Test
    void markOffline_blankSessionId_returnsEarly() {
        service.markOffline("user-1", "");
        verifyNoInteractions(setOps);
    }

    // ----- isOnline -----

    @Test
    void isOnline_userWithSessions_returnsTrue() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(1L);
        assertThat(service.isOnline("user-1")).isTrue();
    }

    @Test
    void isOnline_userWithoutSessions_returnsFalse() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(0L);
        assertThat(service.isOnline("user-1")).isFalse();
    }

    @Test
    void isOnline_nullSize_returnsFalse() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(null);
        assertThat(service.isOnline("user-1")).isFalse();
    }

    @Test
    void isOnline_nullUserId_returnsFalse() {
        assertThat(service.isOnline(null)).isFalse();
        verifyNoInteractions(setOps);
    }

    @Test
    void isOnline_blankUserId_returnsFalse() {
        assertThat(service.isOnline("  ")).isFalse();
    }

    // ----- getPresence -----

    @Test
    void getPresence_online_returnsOnlineWithoutLastSeen() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(1L);

        UserPresenceDto result = service.getPresence("user-1");

        assertThat(result.userId()).isEqualTo("user-1");
        assertThat(result.online()).isTrue();
        assertThat(result.lastSeen()).isNull();
        verify(valueOps, never()).get(anyString());
    }

    @Test
    void getPresence_offlineWithLastSeen_returnsLastSeen() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(0L);
        when(valueOps.get("presence:lastSeen:user-1")).thenReturn("2025-01-01T10:00:00");

        UserPresenceDto result = service.getPresence("user-1");

        assertThat(result.online()).isFalse();
        assertThat(result.lastSeen()).isEqualTo(LocalDateTime.of(2025, 1, 1, 10, 0));
    }

    @Test
    void getPresence_offlineWithoutLastSeen_returnsNullLastSeen() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(0L);
        when(valueOps.get("presence:lastSeen:user-1")).thenReturn(null);

        UserPresenceDto result = service.getPresence("user-1");

        assertThat(result.online()).isFalse();
        assertThat(result.lastSeen()).isNull();
    }

    @Test
    void getPresence_offlineBlankLastSeen_returnsNullLastSeen() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(0L);
        when(valueOps.get("presence:lastSeen:user-1")).thenReturn("   ");

        UserPresenceDto result = service.getPresence("user-1");

        assertThat(result.lastSeen()).isNull();
    }

    @Test
    void getPresence_offlineMalformedLastSeen_returnsNullLastSeen() {
        when(setOps.size("presence:sessions:user-1")).thenReturn(0L);
        when(valueOps.get("presence:lastSeen:user-1")).thenReturn("not-a-date");

        UserPresenceDto result = service.getPresence("user-1");

        assertThat(result.lastSeen()).isNull();
    }

    // ----- getBulkPresence -----

    @Test
    void getBulkPresence_emptyList_returnsEmpty() {
        assertThat(service.getBulkPresence(List.of())).isEmpty();
    }

    @Test
    void getBulkPresence_nullCollection_returnsEmpty() {
        assertThat(service.getBulkPresence(null)).isEmpty();
    }

    @Test
    void getBulkPresence_returnsOneEntryPerUser() {
        when(setOps.size("presence:sessions:user-a")).thenReturn(1L);
        when(setOps.size("presence:sessions:user-b")).thenReturn(0L);
        when(valueOps.get("presence:lastSeen:user-b")).thenReturn(null);

        List<UserPresenceDto> result = service.getBulkPresence(List.of("user-a", "user-b"));

        assertThat(result).hasSize(2);
        assertThat(result.get(0).userId()).isEqualTo("user-a");
        assertThat(result.get(0).online()).isTrue();
        assertThat(result.get(1).userId()).isEqualTo("user-b");
        assertThat(result.get(1).online()).isFalse();
    }

    @Test
    void getBulkPresence_skipsNullAndBlankIds() {
        when(setOps.size("presence:sessions:user-a")).thenReturn(1L);

        List<UserPresenceDto> result = service.getBulkPresence(java.util.Arrays.asList("user-a", null, "  "));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).userId()).isEqualTo("user-a");
    }

    // ----- Broadcast: no messaging template -----

    @Test
    void markOnline_noMessagingTemplate_noBroadcastNoException() {
        PresenceService bareService = serviceWithoutMessaging();
        when(setOps.size("presence:sessions:user-1")).thenReturn(0L);

        bareService.markOnline("user-1", "session-1");

        verifyNoInteractions(messagingTemplate);
    }

    @Test
    void markOffline_messagingTemplateThrows_doesNotPropagate() {
        when(setOps.remove(eq("presence:sessions:user-1"), any(Object[].class))).thenReturn(1L);
        when(setOps.size("presence:sessions:user-1")).thenReturn(0L);
        doThrow(new RuntimeException("topic down"))
            .when(messagingTemplate).convertAndSend(anyString(), any(Object.class));

        // Should not throw
        service.markOffline("user-1", "session-1");
    }
}
