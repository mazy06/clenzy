package com.clenzy.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoginProtectionServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private CaptchaService captchaService;
    @Mock private ValueOperations<String, String> valueOperations;

    private LoginProtectionService service;

    private static final String USERNAME = "testuser@example.com";
    private static final String NORMALIZED = "testuser@example.com";
    private static final String ATTEMPTS_KEY = "login:attempts:" + NORMALIZED;
    private static final String LOCKED_KEY = "login:locked:" + NORMALIZED;

    @BeforeEach
    void setUp() {
        service = new LoginProtectionService(redisTemplate, captchaService);
        ReflectionTestUtils.setField(service, "captchaEnabled", true);
    }

    // ─── checkLoginAllowed ──────────────────────────────────────────────────

    @Test
    void checkLoginAllowed_noAttemptsNoLock_allowedNoCaptcha() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(LOCKED_KEY)).thenReturn(null);
        when(valueOperations.get(ATTEMPTS_KEY)).thenReturn(null);

        LoginProtectionService.LoginStatus status = service.checkLoginAllowed(USERNAME);

        assertFalse(status.isLocked());
        assertEquals(0, status.remainingSeconds());
        assertFalse(status.captchaRequired());
    }

    @Test
    void checkLoginAllowed_threeAttempts_captchaRequired() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(LOCKED_KEY)).thenReturn(null);
        when(valueOperations.get(ATTEMPTS_KEY)).thenReturn("3");

        LoginProtectionService.LoginStatus status = service.checkLoginAllowed(USERNAME);

        assertFalse(status.isLocked());
        assertEquals(0, status.remainingSeconds());
        assertTrue(status.captchaRequired());
    }

    @Test
    void checkLoginAllowed_lockedAccount_returnsLockedWithRemainingSeconds() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(LOCKED_KEY)).thenReturn(String.valueOf(System.currentTimeMillis()));
        when(redisTemplate.getExpire(LOCKED_KEY)).thenReturn(600L);

        LoginProtectionService.LoginStatus status = service.checkLoginAllowed(USERNAME);

        assertTrue(status.isLocked());
        assertEquals(600, status.remainingSeconds());
        assertTrue(status.captchaRequired());
    }

    @Test
    void checkLoginAllowed_lockedButTtlExpired_cleanedUpAndNotLocked() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(LOCKED_KEY)).thenReturn(String.valueOf(System.currentTimeMillis()));
        when(redisTemplate.getExpire(LOCKED_KEY)).thenReturn(0L);
        // After cleanup, read attempts
        when(valueOperations.get(ATTEMPTS_KEY)).thenReturn(null);

        LoginProtectionService.LoginStatus status = service.checkLoginAllowed(USERNAME);

        assertFalse(status.isLocked());
        assertEquals(0, status.remainingSeconds());
        verify(redisTemplate).delete(LOCKED_KEY);
        verify(redisTemplate).delete(ATTEMPTS_KEY);
    }

    // ─── recordFailedAttempt ────────────────────────────────────────────────

    @Test
    void recordFailedAttempt_firstAttempt_setsTtl() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(ATTEMPTS_KEY)).thenReturn(1L);

        service.recordFailedAttempt(USERNAME);

        verify(redisTemplate).expire(ATTEMPTS_KEY, Duration.ofMinutes(15));
        verify(valueOperations, never()).set(eq(LOCKED_KEY), anyString(), any(Duration.class));
    }

    @Test
    void recordFailedAttempt_fifthAttempt_locksAccount() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.increment(ATTEMPTS_KEY)).thenReturn(5L);

        service.recordFailedAttempt(USERNAME);

        verify(valueOperations).set(eq(LOCKED_KEY), anyString(), eq(Duration.ofMinutes(15)));
    }

    // ─── recordSuccessfulLogin ──────────────────────────────────────────────

    @Test
    void recordSuccessfulLogin_clearsRedisKeysAndLocal() {
        // Pre-populate local fallback to verify it gets cleared
        Map<String, LoginProtectionService.LocalLockout> localLockouts = getLocalLockouts();
        localLockouts.put(NORMALIZED, new LoginProtectionService.LocalLockout());

        service.recordSuccessfulLogin(USERNAME);

        verify(redisTemplate).delete(ATTEMPTS_KEY);
        verify(redisTemplate).delete(LOCKED_KEY);
        assertFalse(localLockouts.containsKey(NORMALIZED));
    }

    // ─── isCaptchaRequired ──────────────────────────────────────────────────

    @Test
    void isCaptchaRequired_captchaDisabled_alwaysFalse() {
        ReflectionTestUtils.setField(service, "captchaEnabled", false);

        boolean result = service.isCaptchaRequired(USERNAME);

        assertFalse(result);
        verifyNoInteractions(redisTemplate);
    }

    @Test
    void isCaptchaRequired_usesCheckLoginAllowedUnderTheHood() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(LOCKED_KEY)).thenReturn(null);
        when(valueOperations.get(ATTEMPTS_KEY)).thenReturn("4");

        boolean result = service.isCaptchaRequired(USERNAME);

        assertTrue(result);
    }

    // ─── validateCaptchaToken ───────────────────────────────────────────────

    @Test
    void validateCaptchaToken_captchaDisabled_returnsTrue() {
        ReflectionTestUtils.setField(service, "captchaEnabled", false);

        assertTrue(service.validateCaptchaToken("any-token"));
    }

    @Test
    void validateCaptchaToken_nullToken_returnsFalse() {
        assertFalse(service.validateCaptchaToken(null));
    }

    @Test
    void validateCaptchaToken_blankToken_returnsFalse() {
        assertFalse(service.validateCaptchaToken("   "));
    }

    @Test
    void validateCaptchaToken_validTokenInRedis_returnsTrueAndConsumed() {
        String token = "abc12345-1234-1234-1234-123456789012";
        String verifiedKey = "captcha:verified:" + token;

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(verifiedKey)).thenReturn("true");

        assertTrue(service.validateCaptchaToken(token));
        verify(redisTemplate).delete(verifiedKey);
    }

    @Test
    void validateCaptchaToken_tokenNotInRedis_returnsFalse() {
        String token = "abc12345-1234-1234-1234-123456789012";
        String verifiedKey = "captcha:verified:" + token;

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(verifiedKey)).thenReturn(null);

        assertFalse(service.validateCaptchaToken(token));
    }

    @Test
    void validateCaptchaToken_redisUnavailable_fallbackUuidFormatCheck() {
        String validUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
        when(redisTemplate.opsForValue()).thenThrow(new RedisConnectionFailureException("Connection refused"));

        assertTrue(service.validateCaptchaToken(validUuid));
    }

    @Test
    void validateCaptchaToken_redisUnavailable_invalidFormatRejected() {
        String invalidToken = "not-a-uuid";
        when(redisTemplate.opsForValue()).thenThrow(new RedisConnectionFailureException("Connection refused"));

        assertFalse(service.validateCaptchaToken(invalidToken));
    }

    // ─── markCaptchaVerified ────────────────────────────────────────────────

    @Test
    void markCaptchaVerified_storesInRedisWithTtl() {
        String token = "test-token-123";
        String verifiedKey = "captcha:verified:" + token;

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        service.markCaptchaVerified(token);

        verify(valueOperations).set(verifiedKey, "true", Duration.ofMinutes(5));
    }

    @Test
    void markCaptchaVerified_nullToken_noOp() {
        service.markCaptchaVerified(null);

        verifyNoInteractions(redisTemplate);
    }

    @Test
    void markCaptchaVerified_blankToken_noOp() {
        service.markCaptchaVerified("   ");

        verifyNoInteractions(redisTemplate);
    }

    // ─── forceUnlock ────────────────────────────────────────────────────────

    @Test
    void forceUnlock_clearsRedisAndLocal() {
        Map<String, LoginProtectionService.LocalLockout> localLockouts = getLocalLockouts();
        localLockouts.put(NORMALIZED, new LoginProtectionService.LocalLockout());

        service.forceUnlock(USERNAME);

        verify(redisTemplate).delete(ATTEMPTS_KEY);
        verify(redisTemplate).delete(LOCKED_KEY);
        assertFalse(localLockouts.containsKey(NORMALIZED));
    }

    // ─── getFailedAttempts ──────────────────────────────────────────────────

    @Test
    void getFailedAttempts_fromRedis() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(ATTEMPTS_KEY)).thenReturn("3");

        int attempts = service.getFailedAttempts(USERNAME);

        assertEquals(3, attempts);
    }

    @Test
    void getFailedAttempts_redisReturnsNull_returnsZero() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(ATTEMPTS_KEY)).thenReturn(null);

        int attempts = service.getFailedAttempts(USERNAME);

        assertEquals(0, attempts);
    }

    @Test
    void getFailedAttempts_redisUnavailable_fallbackToLocal() {
        when(redisTemplate.opsForValue()).thenThrow(new RedisConnectionFailureException("Connection refused"));

        // Populate local lockout
        Map<String, LoginProtectionService.LocalLockout> localLockouts = getLocalLockouts();
        LoginProtectionService.LocalLockout lockout = new LoginProtectionService.LocalLockout();
        lockout.recordFailure();
        lockout.recordFailure();
        localLockouts.put(NORMALIZED, lockout);

        int attempts = service.getFailedAttempts(USERNAME);

        assertEquals(2, attempts);
    }

    // ─── Local fallback ─────────────────────────────────────────────────────

    @Test
    void checkLoginAllowed_redisThrows_fallbackToLocal() {
        when(redisTemplate.opsForValue()).thenThrow(new RedisConnectionFailureException("Connection refused"));

        LoginProtectionService.LoginStatus status = service.checkLoginAllowed(USERNAME);

        // No local lockout entry = allowed, no captcha
        assertFalse(status.isLocked());
        assertEquals(0, status.remainingSeconds());
        assertFalse(status.captchaRequired());
    }

    @Test
    void recordFailedAttempt_redisNull_fallbackToLocal() {
        // Create service with null redisTemplate
        LoginProtectionService nullRedisService = new LoginProtectionService(null, captchaService);
        ReflectionTestUtils.setField(nullRedisService, "captchaEnabled", true);

        nullRedisService.recordFailedAttempt(USERNAME);
        nullRedisService.recordFailedAttempt(USERNAME);
        nullRedisService.recordFailedAttempt(USERNAME);

        @SuppressWarnings("unchecked")
        Map<String, LoginProtectionService.LocalLockout> localLockouts =
                (Map<String, LoginProtectionService.LocalLockout>)
                        ReflectionTestUtils.getField(nullRedisService, "localLockouts");

        assertNotNull(localLockouts);
        LoginProtectionService.LocalLockout lockout = localLockouts.get(NORMALIZED);
        assertNotNull(lockout);
        assertEquals(3, lockout.failedAttempts);
    }

    @Test
    void localFallback_fiveAttempts_accountLocked() {
        LoginProtectionService nullRedisService = new LoginProtectionService(null, captchaService);
        ReflectionTestUtils.setField(nullRedisService, "captchaEnabled", true);

        for (int i = 0; i < 5; i++) {
            nullRedisService.recordFailedAttempt(USERNAME);
        }

        LoginProtectionService.LoginStatus status = nullRedisService.checkLoginAllowed(USERNAME);

        assertTrue(status.isLocked());
        assertTrue(status.remainingSeconds() > 0);
        assertTrue(status.captchaRequired());
    }

    @Test
    void localFallback_threeAttempts_captchaRequired() {
        LoginProtectionService nullRedisService = new LoginProtectionService(null, captchaService);
        ReflectionTestUtils.setField(nullRedisService, "captchaEnabled", true);

        for (int i = 0; i < 3; i++) {
            nullRedisService.recordFailedAttempt(USERNAME);
        }

        LoginProtectionService.LoginStatus status = nullRedisService.checkLoginAllowed(USERNAME);

        assertFalse(status.isLocked());
        assertTrue(status.captchaRequired());
    }

    // ─── normalizeUsername ───────────────────────────────────────────────────

    @Test
    void normalizeUsername_null_returnsEmpty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("login:locked:")).thenReturn(null);
        when(valueOperations.get("login:attempts:")).thenReturn(null);

        // null username should be normalized to "" and not throw
        LoginProtectionService.LoginStatus status = service.checkLoginAllowed(null);

        assertFalse(status.isLocked());
    }

    @Test
    void normalizeUsername_upperCaseWithSpaces_normalized() {
        String attemptsKey = "login:attempts:upper";
        String lockedKey = "login:locked:upper";

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(lockedKey)).thenReturn(null);
        when(valueOperations.get(attemptsKey)).thenReturn("2");

        LoginProtectionService.LoginStatus status = service.checkLoginAllowed(" UPPER ");

        assertFalse(status.isLocked());
        assertFalse(status.captchaRequired());
    }

    // ─── Helper methods ─────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, LoginProtectionService.LocalLockout> getLocalLockouts() {
        return (Map<String, LoginProtectionService.LocalLockout>)
                ReflectionTestUtils.getField(service, "localLockouts");
    }
}
