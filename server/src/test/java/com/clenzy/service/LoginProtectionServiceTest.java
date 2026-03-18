package com.clenzy.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoginProtectionServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private RestTemplate restTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private LoginProtectionService service;

    private static final String USERNAME = "testuser@example.com";
    private static final String NORMALIZED = "testuser@example.com";
    private static final String ATTEMPTS_KEY = "login:attempts:" + NORMALIZED;
    private static final String LOCKED_KEY = "login:locked:" + NORMALIZED;

    @BeforeEach
    void setUp() {
        service = new LoginProtectionService(redisTemplate, restTemplate);
        ReflectionTestUtils.setField(service, "captchaEnabled", true);
        ReflectionTestUtils.setField(service, "turnstileSecretKey", "test-secret");
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
    void recordSuccessfulLogin_clearsRedisKeys() {
        service.recordSuccessfulLogin(USERNAME);

        verify(redisTemplate).delete(ATTEMPTS_KEY);
        verify(redisTemplate).delete(LOCKED_KEY);
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
    void isCaptchaRequired_fourAttempts_returnsTrue() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(LOCKED_KEY)).thenReturn(null);
        when(valueOperations.get(ATTEMPTS_KEY)).thenReturn("4");

        boolean result = service.isCaptchaRequired(USERNAME);

        assertTrue(result);
    }

    // ─── validateCaptchaToken (Turnstile) ────────────────────────────────────

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
    void validateCaptchaToken_noSecretKey_returnsTrue() {
        ReflectionTestUtils.setField(service, "turnstileSecretKey", "");

        assertTrue(service.validateCaptchaToken("some-token"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void validateCaptchaToken_turnstileSuccess_returnsTrue() {
        Map<String, Object> response = Map.of("success", true);
        when(restTemplate.postForObject(anyString(), any(), eq(Map.class))).thenReturn(response);

        assertTrue(service.validateCaptchaToken("valid-turnstile-token"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void validateCaptchaToken_turnstileFailure_returnsFalse() {
        Map<String, Object> response = Map.of("success", false);
        when(restTemplate.postForObject(anyString(), any(), eq(Map.class))).thenReturn(response);

        assertFalse(service.validateCaptchaToken("invalid-token"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void validateCaptchaToken_turnstileException_returnsFalse() {
        when(restTemplate.postForObject(anyString(), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("Network error"));

        assertFalse(service.validateCaptchaToken("some-token"));
    }

    // ─── forceUnlock ────────────────────────────────────────────────────────

    @Test
    void forceUnlock_clearsRedisKeys() {
        service.forceUnlock(USERNAME);

        verify(redisTemplate).delete(ATTEMPTS_KEY);
        verify(redisTemplate).delete(LOCKED_KEY);
    }

    // ─── getFailedAttempts ──────────────────────────────────────────────────

    @Test
    void getFailedAttempts_fromRedis() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(ATTEMPTS_KEY)).thenReturn("3");

        assertEquals(3, service.getFailedAttempts(USERNAME));
    }

    @Test
    void getFailedAttempts_redisReturnsNull_returnsZero() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(ATTEMPTS_KEY)).thenReturn(null);

        assertEquals(0, service.getFailedAttempts(USERNAME));
    }

    // ─── normalizeUsername ───────────────────────────────────────────────────

    @Test
    void normalizeUsername_null_returnsEmpty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("login:locked:")).thenReturn(null);
        when(valueOperations.get("login:attempts:")).thenReturn(null);

        LoginProtectionService.LoginStatus status = service.checkLoginAllowed(null);

        assertFalse(status.isLocked());
    }

    @Test
    void normalizeUsername_upperCaseWithSpaces_normalized() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("login:locked:upper")).thenReturn(null);
        when(valueOperations.get("login:attempts:upper")).thenReturn("2");

        LoginProtectionService.LoginStatus status = service.checkLoginAllowed(" UPPER ");

        assertFalse(status.isLocked());
        assertFalse(status.captchaRequired());
    }
}
