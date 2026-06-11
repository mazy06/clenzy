package com.clenzy.booking.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingPublicRateLimiterTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private BookingPublicRateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new BookingPublicRateLimiter(redisTemplate);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    @Test
    @DisplayName("first acquisition sets the TTL and is allowed")
    void whenFirstAcquisition_thenAllowedAndTtlSet() {
        when(valueOps.increment("booking-rl:hold:1.2.3.4:42")).thenReturn(1L);

        boolean allowed = limiter.tryAcquire("hold:1.2.3.4:42", 5, Duration.ofMinutes(10));

        assertThat(allowed).isTrue();
        verify(redisTemplate).expire(eq("booking-rl:hold:1.2.3.4:42"), eq(Duration.ofMinutes(10)));
    }

    @Test
    @DisplayName("acquisition above the limit is denied")
    void whenAboveLimit_thenDenied() {
        when(valueOps.increment(anyString())).thenReturn(6L);

        boolean allowed = limiter.tryAcquire("hold:1.2.3.4:42", 5, Duration.ofMinutes(10));

        assertThat(allowed).isFalse();
    }

    @Test
    @DisplayName("fail-open when Redis is unavailable")
    void whenRedisDown_thenFailOpen() {
        when(valueOps.increment(anyString())).thenThrow(new RuntimeException("redis down"));

        boolean allowed = limiter.tryAcquire("hold:1.2.3.4:42", 5, Duration.ofMinutes(10));

        assertThat(allowed).isTrue();
    }

    @Test
    @DisplayName("clientIp returns remoteAddr for a direct public client")
    void whenDirectPublicClient_thenRemoteAddr() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.9");
        request.addHeader("X-Forwarded-For", "9.9.9.9"); // spoof tente — ignore

        assertThat(limiter.clientIp(request)).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("clientIp resolves the rightmost non-private XFF entry behind a trusted proxy")
    void whenBehindTrustedProxy_thenXffResolved() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.18.0.2"); // nginx Docker
        request.addHeader("X-Forwarded-For", "6.6.6.6, 203.0.113.9, 10.0.0.1");

        assertThat(limiter.clientIp(request)).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("tryAcquireHold keys by IP + property")
    void whenHoldAcquired_thenKeyedByIpAndProperty() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.9");
        when(valueOps.increment("booking-rl:hold:203.0.113.9:42")).thenReturn(1L);

        boolean allowed = limiter.tryAcquireHold(request, 42L);

        assertThat(allowed).isTrue();
        verify(valueOps).increment("booking-rl:hold:203.0.113.9:42");
    }

    @Test
    @DisplayName("null increment result (Redis pipeline) fails open")
    void whenNullIncrement_thenAllowed() {
        when(valueOps.increment(anyString())).thenReturn(null);

        assertThat(limiter.tryAcquire("k", 5, Duration.ofMinutes(1))).isTrue();
    }
}
