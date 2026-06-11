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
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests for {@link RateLimitInterceptor}.
 * Validates auth/API rate limiting, Redis/local fallback, IP extraction, and response headers.
 *
 * <p>Le chemin Redis est desormais un script Lua atomique (Z1-BUGS-03) qui
 * retourne {count, ttlMillis} : les stubs mockent {@code execute(script, keys, args)}.</p>
 */
@ExtendWith(MockitoExtension.class)
class RateLimitInterceptorTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private SecurityAuditService securityAuditService;

    private RateLimitInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new RateLimitInterceptor(redisTemplate, securityAuditService);
        SecurityContextHolder.clearContext();
    }

    /** Stub du script Lua atomique : retourne {count, ttlMillis} pour la cle donnee. */
    @SuppressWarnings({"unchecked", "rawtypes"})
    private void stubRateLimitScript(String redisKey, long count, long ttlMs) {
        when(redisTemplate.execute(any(RedisScript.class), eq(List.of(redisKey)), any()))
                .thenReturn(List.of(count, ttlMs));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void verifyRateLimitScript(String redisKey) {
        verify(redisTemplate).execute(any(RedisScript.class), eq(List.of(redisKey)), any());
    }

    @Nested
    @DisplayName("Auth endpoint rate limiting")
    class AuthEndpoint {

        @Test
        void whenFirstAuthRequest_thenAllowed() throws Exception {
            stubRateLimitScript("ratelimit:auth:192.168.1.1", 1L, 60_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("192.168.1.1");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isTrue();
            assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("30");
            assertThat(response.getHeader("X-RateLimit-Remaining")).isEqualTo("29");
        }

        @Test
        void whenAuthLimitExceeded_thenBlocked429() throws Exception {
            stubRateLimitScript("ratelimit:auth:10.0.0.1", 31L, 45_000L);

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

            stubRateLimitScript("ratelimit:user:user-123", 1L, 60_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/properties");
            request.setRemoteAddr("10.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isTrue();
            assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("300");
        }

        @Test
        void whenUnauthenticatedApiRequest_thenUsesIpKey() throws Exception {
            stubRateLimitScript("ratelimit:ip:8.8.8.8", 1L, 60_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/public/data");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isTrue();
            assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("300");
        }
    }

    @Nested
    @DisplayName("Public guestbook POST — limite stricte par IP (Z4B-SECBUGS-05)")
    class GuestbookPostEndpoint {

        private static final String GUESTBOOK_PATH =
                "/api/public/guide/7e6a1f7c-1111-2222-3333-444444444444/guestbook";

        @Test
        void whenGuestbookPost_thenUsesDedicatedKeyAndStrictLimit() throws Exception {
            stubRateLimitScript("ratelimit:guide-guestbook:8.8.8.8", 1L, 60_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", GUESTBOOK_PATH);
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isTrue();
            assertThat(response.getHeader("X-RateLimit-Limit")).isEqualTo("5");
            verifyRateLimitScript("ratelimit:guide-guestbook:8.8.8.8");
        }

        @Test
        void whenGuestbookPostLimitExceeded_thenBlocked429() throws Exception {
            stubRateLimitScript("ratelimit:guide-guestbook:8.8.8.8", 6L, 30_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", GUESTBOOK_PATH);
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isFalse();
            assertThat(response.getStatus()).isEqualTo(429);
        }

        @Test
        void whenGuestbookGet_thenGeneralLimitApplies() throws Exception {
            stubRateLimitScript("ratelimit:ip:8.8.8.8", 1L, 60_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("GET", GUESTBOOK_PATH);
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
        @SuppressWarnings({"unchecked", "rawtypes"})
        void whenRedisUnavailable_thenFallsBackToLocal() throws Exception {
            when(redisTemplate.execute(any(RedisScript.class), anyList(), any()))
                    .thenThrow(new RuntimeException("Redis down"));

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
        void whenTrustedProxyWithXForwardedFor_thenUsesRightmostUntrustedIp() throws Exception {
            stubRateLimitScript("ratelimit:auth:70.41.3.18", 1L, 60_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("127.0.0.1"); // Trusted proxy
            // nginx APPEND l'IP reelle en fin de chaine : l'entree de gauche est
            // fournie par le client (spoofable), celle de droite par nginx.
            request.addHeader("X-Forwarded-For", "203.0.113.50, 70.41.3.18");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            verifyRateLimitScript("ratelimit:auth:70.41.3.18");
        }

        @Test
        void whenTrustedProxyWithXRealIp_thenUsesRealIp() throws Exception {
            stubRateLimitScript("ratelimit:auth:203.0.113.60", 1L, 60_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("172.16.0.1"); // Trusted proxy (172.x)
            request.addHeader("X-Real-IP", "203.0.113.60");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            verifyRateLimitScript("ratelimit:auth:203.0.113.60");
        }

        @Test
        void whenNotTrustedProxy_thenUsesRemoteAddr() throws Exception {
            stubRateLimitScript("ratelimit:auth:8.8.8.8", 1L, 60_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("8.8.8.8"); // Not a trusted proxy
            request.addHeader("X-Forwarded-For", "spoofed-ip");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            verifyRateLimitScript("ratelimit:auth:8.8.8.8");
        }
    }

    @Nested
    @DisplayName("getClientIp — anti-spoofing X-Forwarded-For (Z1-SEC-04 / Z1-BUGS-02)")
    class ClientIpResolution {

        private MockHttpServletRequest request(String remoteAddr) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr(remoteAddr);
            return request;
        }

        @Test
        void whenClientForgesXffBehindSingleNginxProxy_thenRealClientIpIsKept() {
            // Arrange : le client envoie un XFF forge, nginx (172.18.x, trusted)
            // AJOUTE l'IP reelle en fin de chaine -> "forge, reelle"
            MockHttpServletRequest request = request("172.18.0.5");
            request.addHeader("X-Forwarded-For", "1.2.3.4, 203.0.113.7");

            // Act + Assert
            assertThat(interceptor.getClientIp(request)).isEqualTo("203.0.113.7");
        }

        @Test
        void whenForgedXffVariesOnEachRequest_thenResolvedIpStaysStable() {
            // Un attaquant qui fait tourner le XFF ne doit pas faire tourner la cle de rate-limit
            MockHttpServletRequest first = request("172.18.0.5");
            first.addHeader("X-Forwarded-For", "9.9.9.1, 203.0.113.7");
            MockHttpServletRequest second = request("172.18.0.5");
            second.addHeader("X-Forwarded-For", "9.9.9.2, 203.0.113.7");

            assertThat(interceptor.getClientIp(first))
                .isEqualTo(interceptor.getClientIp(second))
                .isEqualTo("203.0.113.7");
        }

        @Test
        void whenMultipleTrustedProxiesInChain_thenFirstUntrustedFromRightIsUsed() {
            MockHttpServletRequest request = request("172.18.0.5");
            request.addHeader("X-Forwarded-For", "9.9.9.9, 198.51.100.4, 10.0.0.3");

            assertThat(interceptor.getClientIp(request)).isEqualTo("198.51.100.4");
        }

        @Test
        void whenRemoteAddrIsPublic_thenXffIsIgnored() {
            MockHttpServletRequest request = request("203.0.113.9");
            request.addHeader("X-Forwarded-For", "1.2.3.4");

            assertThat(interceptor.getClientIp(request)).isEqualTo("203.0.113.9");
        }

        @Test
        void when172Dot32RemoteAddr_thenNotTrustedAndXffIgnored() {
            // 172.32.0.1 est PUBLIC (hors 172.16.0.0/12) : l'ancien startsWith("172.")
            // le considerait a tort comme proxy de confiance
            MockHttpServletRequest request = request("172.32.0.1");
            request.addHeader("X-Forwarded-For", "1.2.3.4");

            assertThat(interceptor.getClientIp(request)).isEqualTo("172.32.0.1");
        }

        @Test
        void whenWholeForwardedChainIsTrusted_thenFallsBackToXRealIp() {
            // Client interne : toutes les entrees XFF sont privees -> repli X-Real-IP
            MockHttpServletRequest request = request("172.18.0.5");
            request.addHeader("X-Forwarded-For", "10.0.0.2, 172.18.0.9");
            request.addHeader("X-Real-IP", "10.0.0.2");

            assertThat(interceptor.getClientIp(request)).isEqualTo("10.0.0.2");
        }

        @Test
        void whenNoForwardingHeaders_thenRemoteAddrIsUsed() {
            assertThat(interceptor.getClientIp(request("172.18.0.5"))).isEqualTo("172.18.0.5");
        }
    }

    @Nested
    @DisplayName("isTrustedProxy — CIDR exacts")
    class TrustedProxyCidr {

        @Test
        void whenAddressInExactPrivateRanges_thenTrusted() {
            assertThat(interceptor.isTrustedProxy("127.0.0.1")).isTrue();
            assertThat(interceptor.isTrustedProxy("10.0.0.1")).isTrue();
            assertThat(interceptor.isTrustedProxy("10.255.255.255")).isTrue();
            assertThat(interceptor.isTrustedProxy("172.16.0.0")).isTrue();
            assertThat(interceptor.isTrustedProxy("172.31.255.255")).isTrue();
            assertThat(interceptor.isTrustedProxy("192.168.0.1")).isTrue();
            assertThat(interceptor.isTrustedProxy("0:0:0:0:0:0:0:1")).isTrue();
            assertThat(interceptor.isTrustedProxy("::1")).isTrue();
        }

        @Test
        void whenAddressOutsideExactCidrs_thenNotTrusted() {
            assertThat(interceptor.isTrustedProxy("172.32.0.1")).isFalse();   // hors 172.16.0.0/12
            assertThat(interceptor.isTrustedProxy("172.15.255.255")).isFalse();
            assertThat(interceptor.isTrustedProxy("172.0.0.1")).isFalse();
            assertThat(interceptor.isTrustedProxy("192.169.0.1")).isFalse();
            assertThat(interceptor.isTrustedProxy("11.0.0.1")).isFalse();
            assertThat(interceptor.isTrustedProxy("8.8.8.8")).isFalse();
        }

        @Test
        void whenAddressMalformed_thenNotTrusted() {
            assertThat(interceptor.isTrustedProxy(null)).isFalse();
            assertThat(interceptor.isTrustedProxy("")).isFalse();
            assertThat(interceptor.isTrustedProxy("not-an-ip")).isFalse();
            assertThat(interceptor.isTrustedProxy("10.0.0")).isFalse();
            assertThat(interceptor.isTrustedProxy("10.0.0.256")).isFalse();
        }
    }

    @Nested
    @DisplayName("Redis atomic script behavior (Z1-BUGS-03)")
    class RedisAtomicScript {

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void whenRedisMode_thenSingleAtomicScriptCallWithWindowArg() throws Exception {
            stubRateLimitScript("ratelimit:auth:8.8.8.8", 1L, 60_000L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            // Un seul aller-retour : INCR + PEXPIRE + PTTL dans le script Lua,
            // avec la fenetre (60000 ms) en argument.
            verify(redisTemplate).execute(any(RedisScript.class),
                    eq(List.of("ratelimit:auth:8.8.8.8")), eq("60000"));
            verifyNoMoreInteractions(redisTemplate);
        }

        @Test
        void whenLimitExceededAndTtlNonPositive_thenDefaultsRetryTo60() throws Exception {
            // Branche defensive : le script repare normalement le TTL, mais une
            // valeur non exploitable doit retomber sur la fenetre complete.
            stubRateLimitScript("ratelimit:auth:8.8.8.8", 31L, -1L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            assertThat(response.getHeader("Retry-After")).isEqualTo("60");
        }

        @Test
        void whenLimitExceeded_thenRetryAfterIsCeiledFromTtlMillis() throws Exception {
            stubRateLimitScript("ratelimit:auth:8.8.8.8", 31L, 1_500L);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            interceptor.preHandle(request, response, new Object());

            assertThat(response.getStatus()).isEqualTo(429);
            assertThat(response.getHeader("Retry-After")).isEqualTo("2");
        }

        @Test
        @SuppressWarnings({"unchecked", "rawtypes"})
        void whenScriptReturnsNull_thenFailsOpen() throws Exception {
            when(redisTemplate.execute(any(RedisScript.class), anyList(), any()))
                    .thenReturn(null);

            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
            request.setRemoteAddr("8.8.8.8");
            MockHttpServletResponse response = new MockHttpServletResponse();

            boolean result = interceptor.preHandle(request, response, new Object());

            assertThat(result).isTrue();
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
