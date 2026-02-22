package com.clenzy.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Coverage tests for config classes — exercises inner classes, records,
 * and testable logic without needing full Spring context.
 */
class ConfigCoverageTest {

    // ─── RateLimitInterceptor.RateLimitResult ──────────────────────────────────
    @Nested
    @DisplayName("RateLimitResult record")
    class RateLimitResultTest {
        @Test void allowedResult() {
            RateLimitInterceptor.RateLimitResult result =
                    new RateLimitInterceptor.RateLimitResult(true, 299, 60);
            assertThat(result.allowed()).isTrue();
            assertThat(result.remaining()).isEqualTo(299);
            assertThat(result.retryAfterSeconds()).isEqualTo(60);
        }
        @Test void deniedResult() {
            RateLimitInterceptor.RateLimitResult result =
                    new RateLimitInterceptor.RateLimitResult(false, 0, 45);
            assertThat(result.allowed()).isFalse();
            assertThat(result.remaining()).isEqualTo(0);
            assertThat(result.retryAfterSeconds()).isEqualTo(45);
        }
    }

    // ─── RateLimitInterceptor.RateLimitBucket ──────────────────────────────────
    @Nested
    @DisplayName("RateLimitBucket")
    class RateLimitBucketTest {
        @Test void tryConsumeWithinLimit() {
            RateLimitInterceptor.RateLimitBucket bucket =
                    new RateLimitInterceptor.RateLimitBucket(3);
            assertThat(bucket.tryConsume()).isTrue();
            assertThat(bucket.tryConsume()).isTrue();
            assertThat(bucket.tryConsume()).isTrue();
            assertThat(bucket.tryConsume()).isFalse();
        }
        @Test void getRemaining() {
            RateLimitInterceptor.RateLimitBucket bucket =
                    new RateLimitInterceptor.RateLimitBucket(5);
            assertThat(bucket.getRemaining()).isEqualTo(5);
            bucket.tryConsume();
            assertThat(bucket.getRemaining()).isEqualTo(4);
            bucket.tryConsume();
            bucket.tryConsume();
            assertThat(bucket.getRemaining()).isEqualTo(2);
        }
        @Test void getSecondsUntilReset() {
            RateLimitInterceptor.RateLimitBucket bucket =
                    new RateLimitInterceptor.RateLimitBucket(10);
            long seconds = bucket.getSecondsUntilReset();
            assertThat(seconds).isGreaterThan(0);
            assertThat(seconds).isLessThanOrEqualTo(60);
        }
        @Test void isExpiredFalseWhenFresh() {
            RateLimitInterceptor.RateLimitBucket bucket =
                    new RateLimitInterceptor.RateLimitBucket(10);
            assertThat(bucket.isExpired()).isFalse();
        }
    }
}
