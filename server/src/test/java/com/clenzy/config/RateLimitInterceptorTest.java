package com.clenzy.config;

import com.clenzy.service.SecurityAuditService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link RateLimitInterceptor}.
 * Validates auth/API rate limiting, Redis/local fallback, IP extraction, and response headers.
 */
@ExtendWith(MockitoExtension.class)
class RateLimitInterceptorTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private SecurityAuditService securityAuditService;

    private RateLimitInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new RateLimitInterceptor(redisTemplate, securityAuditService);
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("Auth endpoint rate limiting")
    class AuthEndpoint {

        @Test
        void whenFirstAuthRequest_thenAllowed() throws Exception {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment("ratelimit:auth:192.168.1.1")).thenReturn(1L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("192.168.1.1");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isTrue();
            assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("10");
            assertThat(response.getHeader("X-RateLimit-Remaining")).isEqualTo("9");
        }

        @Test
        void whenAuthLimitExceeded_thenBlocked429() throws Exception {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment("ratelimit:auth:10.0.0.1")).thenReturn(11L);
            when(redisTemplate.getExpire("ratelimit:auth:10.0.0.1")).thenReturn(45L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("10.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isFalse();
            assertThat(response.getStatus()).isEqualTo(429);
            assertThat(response.getHeader("Retry-After")).isEqualTo("45");
            assertThat(response.getHeader("X-RateLimit-Remaining")).isEqualTo("0");
            assertThat(response.getContentAsString()).contains("too_many_requests");
            verify(securityAuditService).logSuspiciousActivity(isNull(), eq("Rate limit exceeded"), anyMap());
        }
    }

    @Nested
    @DisplayName("API endpoint rate limiting")
    class ApiEndpoint {

        @Test
        void whenAuthenticatedApiRequest_thenUsesUserKey() throws Exception {
            // Set up authenticated user
            Jwt jwt = Jwt.withTokenValue("token")
                    .header("alg", "RS256")
                    .claim("sub", "user-123")
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plusSeconds(3600))
                    .build();
            Authentication auth = mock(Authentication.class);
            when(auth.getPrincipal()).thenReturn(jwt);
            SecurityContextHolder.getContext().setAuthentication(auth);

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment("ratelimit:user:user-123")).thenReturn(1L);

            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/properties");
            request.setRemoteAddr("10.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isTrue();
            assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("300");
        }

        @Test
        void whenUnauthenticatedApiRequest_thenUsesIpKey() throws Exception {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment("ratelimit:ip:8.8.8.8")).thenReturn(1L);

            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/public/data");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isTrue();
            assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("300");
        }
    }

    @Nested
    @DisplayName("Redis fallback to local")
    class RedisFallback {

        @Test
        void whenRedisUnavailable_thenFallsBackToLocal() throws Exception {
            when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis down"));

            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/properties");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            // Should still succeed using local bucket
            assertThat(result).isTrue();
        }

        @Test
        void whenRedisNull_thenUsesLocalBucket() throws Exception {
            interceptor = new RateLimitInterceptor(null, securityAuditService);

            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/properties");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isTrue();
        }
    }

    @Nested
    @DisplayName("IP extraction with X-Forwarded-For")
    class IpExtraction {

        @Test
        void whenTrustedProxyWithXForwardedFor_thenUsesFirstIp() throws Exception {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment("ratelimit:auth:203.0.113.50")).thenReturn(1L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("127.0.0.1"); // Trusted proxy
            request.addHeader("X-Forwarded-For", "203.0.113.50, 70.41.3.18");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            verify(valueOperations).increment("ratelimit:auth:203.0.113.50");
        }

        @Test
        void whenTrustedProxyWithXRealIp_thenUsesRealIp() throws Exception {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment("ratelimit:auth:203.0.113.60")).thenReturn(1L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("172.16.0.1"); // Trusted proxy (172.x)
            request.addHeader("X-Real-IP", "203.0.113.60");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            verify(valueOperations).increment("ratelimit:auth:203.0.113.60");
        }

        @Test
        void whenNotTrustedProxy_thenUsesRemoteAddr() throws Exception {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment("ratelimit:auth:8.8.8.8")).thenReturn(1L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("8.8.8.8"); // Not a trusted proxy
            request.addHeader("X-Forwarded-For", "spoofed-ip");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            verify(valueOperations).increment("ratelimit:auth:8.8.8.8");
        }
    }

    @Nested
    @DisplayName("Redis TTL behavior")
    class RedisTtl {

        @Test
        void whenFirstRequest_thenSetsExpiry() throws Exception {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment(anyString())).thenReturn(1L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            verify(redisTemplate).expire(eq("ratelimit:auth:8.8.8.8"), eq(Duration.ofMillis(60_000)));
        }

        @Test
        void whenNotFirstRequest_thenDoesNotSetExpiry() throws Exception {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment(anyString())).thenReturn(5L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            verify(redisTemplate, never()).expire(anyString(), any(Duration.class));
        }

        @Test
        void whenLimitExceededAndNullTtl_thenDefaultsRetryTo60() throws Exception {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.increment(anyString())).thenReturn(11L);
            when(redisTemplate.getExpire(anyString())).thenReturn(null);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            assertThat(response.getHeader("Retry-After")).isEqualTo("60");
        }
    }

    @Nested
    @DisplayName("RateLimitBucket (local)")
    class RateLimitBucketTest {

        @Test
        void whenBucketNotExhausted_thenTryConsumeReturnsTrue() {
            RateLimitInterceptor.RateLimitBucket bucket = new RateLimitInterceptor.RateLimitBucket(3);

            assertThat(bucket.tryConsume()).isTrue();
            assertThat(bucket.tryConsume()).isTrue();
            assertThat(bucket.tryConsume()).isTrue();
        }

        @Test
        void whenBucketExhausted_thenTryConsumeReturnsFalse() {
            RateLimitInterceptor.RateLimitBucket bucket = new RateLimitInterceptor.RateLimitBucket(2);

            assertThat(bucket.tryConsume()).isTrue();
            assertThat(bucket.tryConsume()).isTrue();
            assertThat(bucket.tryConsume()).isFalse();
        }

        @Test
        void whenBucketNotStarted_thenRemainingEqualsLimit() {
            RateLimitInterceptor.RateLimitBucket bucket = new RateLimitInterceptor.RateLimitBucket(10);

            assertThat(bucket.getRemaining()).isEqualTo(10);
        }

        @Test
        void whenBucketConsumed_thenRemainingDecreases() {
            RateLimitInterceptor.RateLimitBucket bucket = new RateLimitInterceptor.RateLimitBucket(10);
            bucket.tryConsume();
            bucket.tryConsume();

            assertThat(bucket.getRemaining()).isEqualTo(8);
        }

        @Test
        void whenRecentlyCreated_thenNotExpired() {
            RateLimitInterceptor.RateLimitBucket bucket = new RateLimitInterceptor.RateLimitBucket(10);

            assertThat(bucket.isExpired()).isFalse();
        }

        @Test
        void whenSecondsUntilReset_thenReturnsPositiveValue() {
            RateLimitInterceptor.RateLimitBucket bucket = new RateLimitInterceptor.RateLimitBucket(10);

            assertThat(bucket.getSecondsUntilReset()).isPositive();
        }
    }
}
