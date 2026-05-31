package com.clenzy.service;

import com.clenzy.exception.TooManyVerificationAttemptsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KeyVerificationThrottleTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private KeyVerificationThrottle throttle;

    private static final String TOKEN = "tok";
    private static final String ATTEMPTS_KEY = "keyverify:attempts:tok";
    private static final String LOCKED_KEY = "keyverify:locked:tok";

    @BeforeEach
    void setUp() {
        throttle = new KeyVerificationThrottle(redisTemplate);
    }

    // ── assertNotLocked ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("assertNotLocked(token)")
    class AssertNotLocked {

        @Test
        @DisplayName("when no lock key - passes without checking TTL")
        void whenNotLocked_thenPasses() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get(LOCKED_KEY)).thenReturn(null);

            assertThatCode(() -> throttle.assertNotLocked(TOKEN)).doesNotThrowAnyException();
            verify(redisTemplate, never()).getExpire(any());
        }

        @Test
        @DisplayName("when locked - throws 429 with remaining TTL as retry-after")
        void whenLocked_thenThrowsWithTtl() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get(LOCKED_KEY)).thenReturn("1");
            when(redisTemplate.getExpire(LOCKED_KEY)).thenReturn(300L);

            assertThatThrownBy(() -> throttle.assertNotLocked(TOKEN))
                    .isInstanceOf(TooManyVerificationAttemptsException.class)
                    .extracting(e -> ((TooManyVerificationAttemptsException) e).getRetryAfterSeconds())
                    .isEqualTo(300L);
        }

        @Test
        @DisplayName("when locked but TTL unknown - falls back to full lockout duration")
        void whenLockedNoTtl_thenFallsBackToLockoutWindow() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get(LOCKED_KEY)).thenReturn("1");
            when(redisTemplate.getExpire(LOCKED_KEY)).thenReturn(-1L);

            assertThatThrownBy(() -> throttle.assertNotLocked(TOKEN))
                    .isInstanceOf(TooManyVerificationAttemptsException.class)
                    .extracting(e -> ((TooManyVerificationAttemptsException) e).getRetryAfterSeconds())
                    .isEqualTo(KeyVerificationThrottle.LOCKOUT_MINUTES * 60);
        }

        @Test
        @DisplayName("when Redis is down - fails open (no exception)")
        void whenRedisDown_thenFailsOpen() {
            when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("redis down"));

            assertThatCode(() -> throttle.assertNotLocked(TOKEN)).doesNotThrowAnyException();
        }
    }

    // ── recordFailure ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("recordFailure(token)")
    class RecordFailure {

        @Test
        @DisplayName("first failed attempt - sets expiry, does not lock")
        void whenFirstAttempt_thenSetsExpiryOnly() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(ATTEMPTS_KEY)).thenReturn(1L);

            throttle.recordFailure(TOKEN);

            verify(redisTemplate).expire(eq(ATTEMPTS_KEY), any(Duration.class));
            verify(valueOps, never()).set(eq(LOCKED_KEY), any(), any(Duration.class));
        }

        @Test
        @DisplayName("attempt below threshold - neither expiry reset nor lock")
        void whenBelowThreshold_thenNoLock() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(ATTEMPTS_KEY)).thenReturn(2L);

            throttle.recordFailure(TOKEN);

            verify(redisTemplate, never()).expire(any(), any(Duration.class));
            verify(valueOps, never()).set(eq(LOCKED_KEY), any(), any(Duration.class));
        }

        @Test
        @DisplayName("attempt reaching threshold - locks the token")
        void whenThresholdReached_thenLocks() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(ATTEMPTS_KEY))
                    .thenReturn((long) KeyVerificationThrottle.MAX_FAILED_ATTEMPTS);

            throttle.recordFailure(TOKEN);

            verify(valueOps).set(eq(LOCKED_KEY), eq("1"), any(Duration.class));
        }

        @Test
        @DisplayName("when increment returns null (Redis hiccup) - does nothing")
        void whenIncrementNull_thenNoop() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(ATTEMPTS_KEY)).thenReturn(null);

            throttle.recordFailure(TOKEN);

            verify(redisTemplate, never()).expire(any(), any(Duration.class));
            verify(valueOps, never()).set(any(), any(), any(Duration.class));
        }

        @Test
        @DisplayName("when Redis is down - fails open")
        void whenRedisDown_thenFailsOpen() {
            when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("redis down"));

            assertThatCode(() -> throttle.recordFailure(TOKEN)).doesNotThrowAnyException();
        }
    }

    // ── reset ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("reset(token)")
    class Reset {

        @Test
        @DisplayName("deletes both the attempts counter and the lock")
        void whenReset_thenDeletesBothKeys() {
            throttle.reset(TOKEN);

            verify(redisTemplate).delete(ATTEMPTS_KEY);
            verify(redisTemplate).delete(LOCKED_KEY);
        }

        @Test
        @DisplayName("when Redis is down - fails open")
        void whenRedisDown_thenFailsOpen() {
            when(redisTemplate.delete(ATTEMPTS_KEY)).thenThrow(new RuntimeException("redis down"));

            assertThatCode(() -> throttle.reset(TOKEN)).doesNotThrowAnyException();
        }
    }
}
