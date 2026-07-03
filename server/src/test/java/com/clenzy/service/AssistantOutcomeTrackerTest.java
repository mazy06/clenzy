package com.clenzy.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

@ExtendWith(MockitoExtension.class)
class AssistantOutcomeTrackerTest {

    private static final String MARKER_KEY = "assistant:outcome:autoreply:1:42";

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private SimpleMeterRegistry meterRegistry;
    private AssistantOutcomeTracker tracker;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        tracker = new AssistantOutcomeTracker(redisTemplate, meterRegistry);
    }

    @Test
    void whenAutoReplyRecorded_thenMarkerSetWith24hTtl() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        tracker.recordAutoReply(1L, 42L);

        verify(valueOps).set(MARKER_KEY, "1", Duration.ofHours(24));
    }

    @Test
    void whenManualMessageAfterAutoReply_thenTakeoverCountedAndMarkerConsumed() {
        when(redisTemplate.delete(MARKER_KEY)).thenReturn(true);

        tracker.recordManualMessage(1L, 42L);

        verify(redisTemplate).delete(MARKER_KEY);
        Counter counter = meterRegistry.find("assistant.outcome.manual_takeover")
            .tags("org", "1").counter();
        assertThat(counter).isNotNull();
        assertThat(counter.count()).isEqualTo(1.0);
    }

    @Test
    void whenManualMessageWithoutMarker_thenNoTakeoverCounted() {
        when(redisTemplate.delete(MARKER_KEY)).thenReturn(false);

        tracker.recordManualMessage(1L, 42L);

        assertThat(meterRegistry.find("assistant.outcome.manual_takeover").counter()).isNull();
    }

    @Test
    void whenReservationUnknown_thenNoRedisInteraction() {
        tracker.recordAutoReply(1L, null);
        tracker.recordManualMessage(1L, null);
        tracker.recordAutoReply(null, 42L);
        tracker.recordManualMessage(null, 42L);

        verifyNoInteractions(redisTemplate);
        assertThat(meterRegistry.find("assistant.outcome.manual_takeover").counter()).isNull();
    }

    @Test
    void whenRedisDownOnAutoReply_thenNoExceptionPropagated() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        doThrow(new RedisConnectionFailureException("down"))
            .when(valueOps).set(anyString(), anyString(), org.mockito.ArgumentMatchers.any(Duration.class));

        assertThatCode(() -> tracker.recordAutoReply(1L, 42L)).doesNotThrowAnyException();
    }

    @Test
    void whenRedisDownOnManualMessage_thenNoExceptionAndNoCounter() {
        when(redisTemplate.delete(anyString()))
            .thenThrow(new RedisConnectionFailureException("down"));

        assertThatCode(() -> tracker.recordManualMessage(1L, 42L)).doesNotThrowAnyException();
        assertThat(meterRegistry.find("assistant.outcome.manual_takeover").counter()).isNull();
    }
}
