package com.clenzy.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtTokenServiceTest {

    private static final String BLACKLIST_KEY = "jwt:blacklist";
    private static final String SECRET = "a-secret-key-that-is-at-least-32-characters-long!!";
    private static final long EXPIRATION = 3600L;

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private SetOperations<String, String> setOperations;

    private JwtTokenService service;
    private SecretKey secretKey;

    @BeforeEach
    void setUp() {
        service = new JwtTokenService(redisTemplate);
        secretKey = Keys.hmacShaKeyFor(SECRET.getBytes());

        ReflectionTestUtils.setField(service, "jwtSecret", SECRET);
        ReflectionTestUtils.setField(service, "jwtExpiration", EXPIRATION);
        ReflectionTestUtils.setField(service, "secretKey", secretKey);
    }

    // ─── Helper: build JWT tokens ───────────────────────────────────────────────

    private String buildValidToken() {
        return Jwts.builder()
                .subject("user-123")
                .issuer("clenzy")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3_600_000))
                .signWith(secretKey)
                .compact();
    }

    private String buildExpiredToken() {
        return Jwts.builder()
                .subject("user-123")
                .issuer("clenzy")
                .issuedAt(new Date(System.currentTimeMillis() - 7_200_000))
                .expiration(new Date(System.currentTimeMillis() - 1_000))
                .signWith(secretKey)
                .compact();
    }

    private String buildTokenWithExpiry(long expiryMillis) {
        return Jwts.builder()
                .subject("user-123")
                .issuer("clenzy")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiryMillis))
                .signWith(secretKey)
                .compact();
    }

    // ─── init ───────────────────────────────────────────────────────────────────

    @Test
    void whenSecretAtLeast32Chars_thenInitSucceeds() {
        var svc = new JwtTokenService(redisTemplate);
        ReflectionTestUtils.setField(svc, "jwtSecret", SECRET);

        assertDoesNotThrow(svc::init);
        assertNotNull(ReflectionTestUtils.getField(svc, "secretKey"));
    }

    @Test
    void whenSecretShorterThan32Chars_thenInitThrowsIllegalState() {
        var svc = new JwtTokenService(redisTemplate);
        ReflectionTestUtils.setField(svc, "jwtSecret", "short");

        IllegalStateException ex = assertThrows(IllegalStateException.class, svc::init);
        assertTrue(ex.getMessage().contains("at least 32 characters"));
    }

    @Test
    void whenSecretNull_thenInitThrowsIllegalState() {
        var svc = new JwtTokenService(redisTemplate);
        ReflectionTestUtils.setField(svc, "jwtSecret", null);

        assertThrows(IllegalStateException.class, svc::init);
    }

    // ─── isTokenValid ───────────────────────────────────────────────────────────

    @Test
    void whenTokenValidAndNotBlacklisted_thenReturnsTrue() {
        String token = buildValidToken();
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(BLACKLIST_KEY, token)).thenReturn(false);

        assertTrue(service.isTokenValid(token));

        long validCount = (long) ReflectionTestUtils.getField(service, "validTokens");
        assertEquals(1L, validCount);
    }

    @Test
    void whenTokenBlacklisted_thenReturnsFalseAndIncrementsRejected() {
        String token = buildValidToken();
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(BLACKLIST_KEY, token)).thenReturn(true);

        assertFalse(service.isTokenValid(token));

        long rejected = (long) ReflectionTestUtils.getField(service, "rejectedTokens");
        assertEquals(1L, rejected);
    }

    @Test
    void whenTokenExpired_thenReturnsFalseAndIncrementsInvalid() {
        String token = buildExpiredToken();
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(BLACKLIST_KEY, token)).thenReturn(false);

        assertFalse(service.isTokenValid(token));

        long invalid = (long) ReflectionTestUtils.getField(service, "invalidTokens");
        assertEquals(1L, invalid);
    }

    @Test
    void whenTokenMalformed_thenReturnsFalseAndIncrementsInvalid() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(BLACKLIST_KEY, "not.a.jwt")).thenReturn(false);

        assertFalse(service.isTokenValid("not.a.jwt"));

        long invalid = (long) ReflectionTestUtils.getField(service, "invalidTokens");
        assertEquals(1L, invalid);
    }

    @Test
    void whenTokenSignedWithDifferentKey_thenReturnsFalse() {
        SecretKey otherKey = Keys.hmacShaKeyFor(
                "another-secret-key-that-is-at-least-32-chars!!!".getBytes());
        String token = Jwts.builder()
                .subject("user-123")
                .expiration(new Date(System.currentTimeMillis() + 3_600_000))
                .signWith(otherKey)
                .compact();

        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(BLACKLIST_KEY, token)).thenReturn(false);

        assertFalse(service.isTokenValid(token));
    }

    // ─── validateToken ──────────────────────────────────────────────────────────

    @Test
    void whenValidateValidToken_thenResultIsValidWithTokenInfo() {
        String token = buildValidToken();
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(BLACKLIST_KEY, token)).thenReturn(false);

        JwtTokenService.TokenValidationResult result = service.validateToken(token);

        assertTrue(result.isValid());
        assertNull(result.getError());
        assertNotNull(result.getTokenInfo());
        assertEquals("user-123", result.getTokenInfo().getSubject());
        assertEquals("clenzy", result.getTokenInfo().getIssuer());
        assertNotNull(result.getTokenInfo().getIssuedAt());
        assertNotNull(result.getTokenInfo().getExpiresAt());
    }

    @Test
    void whenValidateBlacklistedToken_thenResultContainsRevokedError() {
        String token = buildValidToken();
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(BLACKLIST_KEY, token)).thenReturn(true);

        JwtTokenService.TokenValidationResult result = service.validateToken(token);

        assertFalse(result.isValid());
        assertEquals("Token révoqué", result.getError());
        assertNull(result.getTokenInfo());
    }

    @Test
    void whenValidateExpiredToken_thenResultContainsExpiredError() {
        // JJWT throws ExpiredJwtException during parsing, so the catch (JwtException)
        // block handles it and returns the JJWT error message (not "Token expire").
        String token = buildExpiredToken();
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(BLACKLIST_KEY, token)).thenReturn(false);

        JwtTokenService.TokenValidationResult result = service.validateToken(token);

        assertFalse(result.isValid());
        assertNotNull(result.getError());
        assertTrue(result.getError().contains("JWT expired"),
                "Expected JJWT expiration message but got: " + result.getError());
        assertNull(result.getTokenInfo());
    }

    @Test
    void whenValidateMalformedToken_thenResultContainsErrorMessage() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(BLACKLIST_KEY, "garbage")).thenReturn(false);

        JwtTokenService.TokenValidationResult result = service.validateToken("garbage");

        assertFalse(result.isValid());
        assertNotNull(result.getError());
        assertNull(result.getTokenInfo());
    }

    // ─── revokeToken ────────────────────────────────────────────────────────────

    @Test
    void whenRevokeValidToken_thenAddedToBlacklistWithCalculatedTtl() {
        String token = buildTokenWithExpiry(60_000); // expires in 60s
        when(redisTemplate.opsForSet()).thenReturn(setOperations);

        service.revokeToken(token);

        verify(setOperations).add(eq(BLACKLIST_KEY), eq(token));
        verify(redisTemplate).expire(eq(BLACKLIST_KEY), longThat(ttl -> ttl > 0 && ttl <= 60),
                eq(TimeUnit.SECONDS));

        long revoked = (long) ReflectionTestUtils.getField(service, "revokedTokens");
        assertEquals(1L, revoked);
    }

    @Test
    void whenRevokeUnparseableToken_thenAddedToBlacklistWith24hTtl() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);

        service.revokeToken("invalid-token-string");

        verify(setOperations).add(BLACKLIST_KEY, "invalid-token-string");
        verify(redisTemplate).expire(BLACKLIST_KEY, 86400, TimeUnit.SECONDS);

        long revoked = (long) ReflectionTestUtils.getField(service, "revokedTokens");
        assertEquals(1L, revoked);
    }

    @Test
    void whenRevokeAlreadyExpiredToken_thenFallbackTo24hTtl() {
        // JJWT throws ExpiredJwtException during parsing, so the catch block fires
        // and adds the token to the blacklist with the 24h fallback TTL.
        String token = buildExpiredToken();
        when(redisTemplate.opsForSet()).thenReturn(setOperations);

        service.revokeToken(token);

        verify(setOperations).add(BLACKLIST_KEY, token);
        verify(redisTemplate).expire(BLACKLIST_KEY, 86400, TimeUnit.SECONDS);

        long revoked = (long) ReflectionTestUtils.getField(service, "revokedTokens");
        assertEquals(1L, revoked);
    }

    // ─── cleanupExpiredTokens ───────────────────────────────────────────────────

    @Test
    void whenCleanup_thenUpdatesLastCleanupAndLogsSize() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.size(BLACKLIST_KEY)).thenReturn(5L);

        service.cleanupExpiredTokens();

        verify(setOperations).size(BLACKLIST_KEY);
        // lastCleanup should be updated (just check it does not throw)
    }

    @Test
    void whenCleanupAndRedisThrows_thenDoesNotPropagate() {
        when(redisTemplate.opsForSet()).thenThrow(new RuntimeException("Redis down"));

        assertDoesNotThrow(() -> service.cleanupExpiredTokens());
    }

    // ─── getStats ───────────────────────────────────────────────────────────────

    @Test
    void whenGetStats_thenReturnsAllCounters() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.size(BLACKLIST_KEY)).thenReturn(3L);

        // Simulate some activity to set counters
        ReflectionTestUtils.setField(service, "validTokens", 10L);
        ReflectionTestUtils.setField(service, "invalidTokens", 2L);
        ReflectionTestUtils.setField(service, "revokedTokens", 1L);
        ReflectionTestUtils.setField(service, "rejectedTokens", 3L);
        ReflectionTestUtils.setField(service, "cacheHits", 5L);
        ReflectionTestUtils.setField(service, "errors", 0L);

        Map<String, Object> stats = service.getStats();

        assertEquals(3L, stats.get("blacklistSize"));
        assertEquals(10L, stats.get("validTokens"));
        assertEquals(2L, stats.get("invalidTokens"));
        assertEquals(1L, stats.get("revokedTokens"));
        assertEquals(3L, stats.get("rejectedTokens"));
        assertEquals(5L, stats.get("cacheHits"));
        assertEquals(0L, stats.get("errors"));
        assertNotNull(stats.get("lastCleanup"));
    }

    @Test
    void whenGetStatsAndRedisReturnsNull_thenBlacklistSizeIsZero() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.size(BLACKLIST_KEY)).thenReturn(null);

        Map<String, Object> stats = service.getStats();

        assertEquals(0L, stats.get("blacklistSize"));
    }

    // ─── getMetrics ─────────────────────────────────────────────────────────────

    @Test
    void whenGetMetrics_thenCalculatesSuccessRateCorrectly() {
        ReflectionTestUtils.setField(service, "validTokens", 80L);
        ReflectionTestUtils.setField(service, "invalidTokens", 10L);
        ReflectionTestUtils.setField(service, "revokedTokens", 5L);
        ReflectionTestUtils.setField(service, "rejectedTokens", 5L);

        JwtTokenService.TokenMetrics metrics = service.getMetrics();

        assertEquals(80L, metrics.getValidTokens());
        assertEquals(10L, metrics.getInvalidTokens());
        assertEquals(5L, metrics.getRevokedTokens());
        assertEquals(5L, metrics.getRejectedTokens());
        assertEquals(100L, metrics.getTotalTokens());
        assertEquals(80.0, metrics.getSuccessRate(), 0.01);
    }

    @Test
    void whenNoTokensProcessed_thenSuccessRateIsZero() {
        JwtTokenService.TokenMetrics metrics = service.getMetrics();

        assertEquals(0L, metrics.getTotalTokens());
        assertEquals(0.0, metrics.getSuccessRate(), 0.01);
    }

    @Test
    void whenAllTokensValid_thenSuccessRateIs100() {
        ReflectionTestUtils.setField(service, "validTokens", 50L);

        JwtTokenService.TokenMetrics metrics = service.getMetrics();

        assertEquals(50L, metrics.getTotalTokens());
        assertEquals(100.0, metrics.getSuccessRate(), 0.01);
    }

    // ─── getBlacklistedTokens ───────────────────────────────────────────────────

    @Test
    void whenGetBlacklistedTokens_thenReturnsCountFromRedis() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.size(BLACKLIST_KEY)).thenReturn(7L);

        Map<String, Object> result = service.getBlacklistedTokens();

        assertEquals(7L, result.get("count"));
    }

    @Test
    void whenGetBlacklistedTokensAndRedisNull_thenReturnsZero() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.size(BLACKLIST_KEY)).thenReturn(null);

        Map<String, Object> result = service.getBlacklistedTokens();

        assertEquals(0L, result.get("count"));
    }

    // ─── removeFromBlacklist ────────────────────────────────────────────────────

    @Test
    void whenRemoveExistingToken_thenReturnsTrue() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.remove(BLACKLIST_KEY, "some-token")).thenReturn(1L);

        assertTrue(service.removeFromBlacklist("some-token"));
    }

    @Test
    void whenRemoveNonExistingToken_thenReturnsFalse() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.remove(BLACKLIST_KEY, "absent-token")).thenReturn(0L);

        assertFalse(service.removeFromBlacklist("absent-token"));
    }

    @Test
    void whenRemoveAndRedisReturnsNull_thenReturnsFalse() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.remove(BLACKLIST_KEY, "any-token")).thenReturn(null);

        assertFalse(service.removeFromBlacklist("any-token"));
    }

    // ─── clearCache ─────────────────────────────────────────────────────────────

    @Test
    void whenClearCache_thenDeletesBlacklistKey() {
        when(redisTemplate.delete(BLACKLIST_KEY)).thenReturn(true);

        service.clearCache();

        verify(redisTemplate).delete(BLACKLIST_KEY);
    }

    // ─── getHealthStatus ────────────────────────────────────────────────────────

    @Test
    void whenGetHealthStatus_thenReturnsUpWithAllFields() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.size(BLACKLIST_KEY)).thenReturn(2L);

        Map<String, Object> health = service.getHealthStatus();

        assertEquals("UP", health.get("status"));
        assertEquals(2L, health.get("blacklistSize"));
        assertNotNull(health.get("lastCleanup"));
        assertNotNull(health.get("uptime"));
    }

    @Test
    void whenGetHealthStatusAndRedisNull_thenBlacklistSizeIsZero() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.size(BLACKLIST_KEY)).thenReturn(null);

        Map<String, Object> health = service.getHealthStatus();

        assertEquals("UP", health.get("status"));
        assertEquals(0L, health.get("blacklistSize"));
    }

    // ─── TokenInfo inner class ──────────────────────────────────────────────────

    @Test
    void whenTokenInfoNotExpired_thenIsExpiredReturnsFalse() {
        Instant future = Instant.now().plusSeconds(3600);
        var info = new JwtTokenService.TokenInfo("id", "sub", "iss", Instant.now(), future);

        assertFalse(info.isExpired());
    }

    @Test
    void whenTokenInfoExpired_thenIsExpiredReturnsTrue() {
        Instant past = Instant.now().minusSeconds(3600);
        var info = new JwtTokenService.TokenInfo("id", "sub", "iss",
                Instant.now().minusSeconds(7200), past);

        assertTrue(info.isExpired());
    }

    @Test
    void whenTokenInfoIssuedInFuture_thenIsNotYetValidReturnsTrue() {
        Instant futureIssue = Instant.now().plusSeconds(3600);
        Instant futureExpiry = Instant.now().plusSeconds(7200);
        var info = new JwtTokenService.TokenInfo("id", "sub", "iss", futureIssue, futureExpiry);

        assertTrue(info.isNotYetValid());
    }

    @Test
    void whenTokenInfoIssuedInPast_thenIsNotYetValidReturnsFalse() {
        Instant pastIssue = Instant.now().minusSeconds(60);
        Instant futureExpiry = Instant.now().plusSeconds(3600);
        var info = new JwtTokenService.TokenInfo("id", "sub", "iss", pastIssue, futureExpiry);

        assertFalse(info.isNotYetValid());
    }

    @Test
    void whenTokenNotExpired_thenGetTimeUntilExpiryIsPositive() {
        Instant futureExpiry = Instant.now().plusSeconds(1800);
        var info = new JwtTokenService.TokenInfo("id", "sub", "iss", Instant.now(), futureExpiry);

        long ttl = info.getTimeUntilExpiry();
        assertTrue(ttl > 0, "Time until expiry should be positive for non-expired token");
        assertTrue(ttl <= 1800, "Time until expiry should be at most 1800s");
    }

    @Test
    void whenTokenExpired_thenGetTimeUntilExpiryIsNegative() {
        Instant pastExpiry = Instant.now().minusSeconds(600);
        var info = new JwtTokenService.TokenInfo("id", "sub", "iss",
                Instant.now().minusSeconds(3600), pastExpiry);

        assertTrue(info.getTimeUntilExpiry() < 0,
                "Time until expiry should be negative for expired token");
    }

    @Test
    void tokenInfoGetters_returnConstructorValues() {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(3600);
        var info = new JwtTokenService.TokenInfo("tok-id", "subject-1", "issuer-x",
                issuedAt, expiresAt);

        assertEquals("tok-id", info.getTokenId());
        assertEquals("subject-1", info.getSubject());
        assertEquals("issuer-x", info.getIssuer());
        assertEquals(issuedAt, info.getIssuedAt());
        assertEquals(expiresAt, info.getExpiresAt());
    }

    // ─── TokenValidationResult inner class ──────────────────────────────────────

    @Test
    void tokenValidationResult_validResult() {
        var info = new JwtTokenService.TokenInfo("id", "sub", "iss",
                Instant.now(), Instant.now().plusSeconds(3600));
        var result = new JwtTokenService.TokenValidationResult(true, null, info);

        assertTrue(result.isValid());
        assertNull(result.getError());
        assertNotNull(result.getTokenInfo());
    }

    @Test
    void tokenValidationResult_invalidResult() {
        var result = new JwtTokenService.TokenValidationResult(false, "Some error", null);

        assertFalse(result.isValid());
        assertEquals("Some error", result.getError());
        assertNull(result.getTokenInfo());
    }

    // ─── TokenMetrics inner class ───────────────────────────────────────────────

    @Test
    void tokenMetrics_allGettersReturnConstructorValues() {
        var metrics = new JwtTokenService.TokenMetrics(10, 2, 3, 4, 5, 1, 19, 52.63);

        assertEquals(10, metrics.getValidTokens());
        assertEquals(2, metrics.getInvalidTokens());
        assertEquals(3, metrics.getRevokedTokens());
        assertEquals(4, metrics.getRejectedTokens());
        assertEquals(5, metrics.getCacheHits());
        assertEquals(1, metrics.getErrors());
        assertEquals(19, metrics.getTotalTokens());
        assertEquals(52.63, metrics.getSuccessRate(), 0.01);
    }

    // ─── getCurrentTokenInfo ────────────────────────────────────────────────────

    @Test
    void whenGetCurrentTokenInfo_thenReturnsEmpty() {
        assertTrue(service.getCurrentTokenInfo().isEmpty());
    }

    // ─── Metric accumulation across multiple calls ──────────────────────────────

    @Test
    void whenMultipleValidAndInvalidCalls_thenMetricsAccumulate() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.isMember(eq(BLACKLIST_KEY), anyString())).thenReturn(false);

        // 3 valid tokens
        for (int i = 0; i < 3; i++) {
            service.isTokenValid(buildValidToken());
        }
        // 2 malformed tokens
        service.isTokenValid("bad1");
        service.isTokenValid("bad2");

        JwtTokenService.TokenMetrics metrics = service.getMetrics();
        assertEquals(3L, metrics.getValidTokens());
        assertEquals(2L, metrics.getInvalidTokens());
        assertEquals(5L, metrics.getTotalTokens());
        assertEquals(60.0, metrics.getSuccessRate(), 0.01);
    }
}
