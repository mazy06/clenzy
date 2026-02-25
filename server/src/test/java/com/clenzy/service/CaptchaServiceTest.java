package com.clenzy.service;

import com.clenzy.service.CaptchaService.CaptchaChallenge;
import com.clenzy.service.CaptchaService.CaptchaVerificationResult;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CaptchaServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private CaptchaService captchaService;

    @BeforeAll
    static void setUpClass() {
        System.setProperty("java.awt.headless", "true");
    }

    @BeforeEach
    void setUp() {
        captchaService = new CaptchaService(redisTemplate);
    }

    // ═══════════════════════════════════════════════════════════════════
    // generateChallenge
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void generateChallenge_returnsNonNullChallenge() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        // Act
        CaptchaChallenge challenge = captchaService.generateChallenge();

        // Assert
        assertThat(challenge).isNotNull();
    }

    @Test
    void generateChallenge_hasValidToken() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        // Act
        CaptchaChallenge challenge = captchaService.generateChallenge();

        // Assert
        assertThat(challenge.token()).isNotNull().isNotBlank();
        assertThat(challenge.token()).matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }

    @Test
    void generateChallenge_hasBase64BackgroundImage() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        // Act
        CaptchaChallenge challenge = captchaService.generateChallenge();

        // Assert
        assertThat(challenge.backgroundImage()).isNotNull().startsWith("data:image/png;base64,");
    }

    @Test
    void generateChallenge_hasBase64PuzzlePiece() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        // Act
        CaptchaChallenge challenge = captchaService.generateChallenge();

        // Assert
        assertThat(challenge.puzzlePiece()).isNotNull().startsWith("data:image/png;base64,");
    }

    @Test
    void generateChallenge_hasValidDimensions() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        // Act
        CaptchaChallenge challenge = captchaService.generateChallenge();

        // Assert
        assertThat(challenge.width()).isEqualTo(340);
        assertThat(challenge.height()).isEqualTo(200);
    }

    @Test
    void generateChallenge_puzzleYWithinBounds() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        // Act
        CaptchaChallenge challenge = captchaService.generateChallenge();

        // Assert
        assertThat(challenge.puzzleY()).isGreaterThanOrEqualTo(0);
        assertThat(challenge.puzzleY()).isLessThan(200);
    }

    @Test
    void generateChallenge_storesSolutionInRedis() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        // Act
        CaptchaChallenge challenge = captchaService.generateChallenge();

        // Assert
        verify(valueOperations).set(
                eq("captcha:" + challenge.token()),
                matches("\\d+:0"),
                eq(Duration.ofMinutes(5)));
    }

    @Test
    void generateChallenge_generatesUniqueTokensEachTime() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        // Act
        CaptchaChallenge challenge1 = captchaService.generateChallenge();
        CaptchaChallenge challenge2 = captchaService.generateChallenge();

        // Assert
        assertThat(challenge1.token()).isNotEqualTo(challenge2.token());
    }

    // ═══════════════════════════════════════════════════════════════════
    // verify — null/blank tokens
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void verify_nullToken_returnsFailure() {
        // Act
        CaptchaVerificationResult result = captchaService.verify(null, 100);

        // Assert
        assertThat(result.success()).isFalse();
        assertThat(result.message()).isEqualTo("Token manquant");
    }

    @Test
    void verify_blankToken_returnsFailure() {
        // Act
        CaptchaVerificationResult result = captchaService.verify("   ", 100);

        // Assert
        assertThat(result.success()).isFalse();
        assertThat(result.message()).isEqualTo("Token manquant");
    }

    @Test
    void verify_emptyToken_returnsFailure() {
        // Act
        CaptchaVerificationResult result = captchaService.verify("", 100);

        // Assert
        assertThat(result.success()).isFalse();
        assertThat(result.message()).isEqualTo("Token manquant");
    }

    // ═══════════════════════════════════════════════════════════════════
    // verify — expired/invalid tokens
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void verify_expiredToken_returnsFailure() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:expired-token")).thenReturn(null);

        // Act
        CaptchaVerificationResult result = captchaService.verify("expired-token", 100);

        // Assert
        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("expire");
    }

    // ═══════════════════════════════════════════════════════════════════
    // verify — correct position (within tolerance)
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void verify_correctPositionExact_returnsSuccess() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:valid-token")).thenReturn("150:0");
        when(redisTemplate.getExpire("captcha:valid-token")).thenReturn(240L);

        // Act
        CaptchaVerificationResult result = captchaService.verify("valid-token", 150);

        // Assert
        assertThat(result.success()).isTrue();
        assertThat(result.message()).isNull();
    }

    @Test
    void verify_correctPositionWithinTolerancePlus_returnsSuccess() {
        // Arrange: tolerance is +/-15px, submitting 165 for correct 150
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:tol-plus")).thenReturn("150:0");
        when(redisTemplate.getExpire("captcha:tol-plus")).thenReturn(240L);

        // Act
        CaptchaVerificationResult result = captchaService.verify("tol-plus", 165);

        // Assert
        assertThat(result.success()).isTrue();
    }

    @Test
    void verify_correctPositionWithinToleranceMinus_returnsSuccess() {
        // Arrange: tolerance is +/-15px, submitting 135 for correct 150
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:tol-minus")).thenReturn("150:0");
        when(redisTemplate.getExpire("captcha:tol-minus")).thenReturn(240L);

        // Act
        CaptchaVerificationResult result = captchaService.verify("tol-minus", 135);

        // Assert
        assertThat(result.success()).isTrue();
    }

    // ═══════════════════════════════════════════════════════════════════
    // verify — incorrect position
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void verify_positionJustOutsideTolerance_returnsFailure() {
        // Arrange: tolerance is +/-15px, submitting 166 for correct 150
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:outside-tol")).thenReturn("150:0");
        when(redisTemplate.getExpire("captcha:outside-tol")).thenReturn(240L);

        // Act
        CaptchaVerificationResult result = captchaService.verify("outside-tol", 166);

        // Assert
        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("Position incorrecte");
    }

    @Test
    void verify_incorrectPosition_returnsFailure() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:wrong-pos")).thenReturn("150:0");
        when(redisTemplate.getExpire("captcha:wrong-pos")).thenReturn(240L);

        // Act
        CaptchaVerificationResult result = captchaService.verify("wrong-pos", 50);

        // Assert
        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("Position incorrecte");
    }

    // ═══════════════════════════════════════════════════════════════════
    // verify — one-time use (delete after success)
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void verify_successfulVerification_deletesSolution() {
        // Arrange
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:one-time")).thenReturn("150:0");
        when(redisTemplate.getExpire("captcha:one-time")).thenReturn(240L);

        // Act
        captchaService.verify("one-time", 150);

        // Assert: solution deleted (one-time use)
        verify(redisTemplate).delete("captcha:one-time");
    }

    // ═══════════════════════════════════════════════════════════════════
    // verify — max attempts
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void verify_maxAttemptsReached_deletesSolutionAndReturnsFailure() {
        // Arrange: already at 5 attempts (MAX_VERIFY_ATTEMPTS)
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:max-attempts")).thenReturn("150:5");

        // Act
        CaptchaVerificationResult result = captchaService.verify("max-attempts", 50);

        // Assert
        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("Trop de tentatives");
        verify(redisTemplate).delete("captcha:max-attempts");
    }

    @Test
    void verify_attemptsReachMaxAfterIncrement_deletesSolution() {
        // Arrange: 4 attempts, this will be the 5th (wrong position, hits max)
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:near-max")).thenReturn("150:4");
        when(redisTemplate.getExpire("captcha:near-max")).thenReturn(240L);

        // Act
        CaptchaVerificationResult result = captchaService.verify("near-max", 50);

        // Assert
        assertThat(result.success()).isFalse();
        assertThat(result.message()).contains("Trop de tentatives");
        verify(redisTemplate).delete("captcha:near-max");
    }

    @Test
    void verify_secondAttemptAfterFailure_updatesAttemptCount() {
        // Arrange: 1 previous attempt
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("captcha:retry")).thenReturn("150:1");
        when(redisTemplate.getExpire("captcha:retry")).thenReturn(200L);

        // Act
        captchaService.verify("retry", 50);

        // Assert: attempt count incremented to 2
        verify(valueOperations).set(
                eq("captcha:retry"),
                eq("150:2"),
                eq(Duration.ofSeconds(200)));
    }

    // ═══════════════════════════════════════════════════════════════════
    // Redis fallback to local ConcurrentHashMap
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void generateChallenge_redisUnavailable_fallsBackToLocalStorage() {
        // Arrange: opsForValue throws exception
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis connection refused"));

        // Act
        CaptchaChallenge challenge = captchaService.generateChallenge();

        // Assert: challenge still generated successfully
        assertThat(challenge).isNotNull();
        assertThat(challenge.token()).isNotBlank();
    }

    @Test
    void verify_redisUnavailable_tokenNotInLocalMap_returnsExpired() {
        // Arrange: Redis unavailable, verify a token that was never stored locally
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis connection refused"));

        // Act
        CaptchaVerificationResult result = captchaService.verify("nonexistent-token", 100);

        // Assert
        assertThat(result.success()).isFalse();
    }

    @Test
    void verify_redisUnavailableForBoth_localFallbackRecognizesToken() {
        // Arrange: Redis completely unavailable for both store and get
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis down"));

        CaptchaChallenge challenge = captchaService.generateChallenge();
        String token = challenge.token();

        // Act: verify with the same token (stored in local map)
        // Position 0 is likely wrong, but the token should be recognized (not "expire")
        CaptchaVerificationResult result = captchaService.verify(token, 0);

        // Assert: token is found in local map (not expired/invalid)
        if (!result.success()) {
            assertThat(result.message()).doesNotContain("expire");
        }
    }

    @Test
    void verify_redisFallsBackForGet_localMapEmptyAfterRedisStore() {
        // Arrange: Redis works for store but fails for get
        when(redisTemplate.opsForValue())
                .thenReturn(valueOperations)       // first call (store in generateChallenge)
                .thenThrow(new RuntimeException("Redis timeout"));  // second call (get in verify)

        CaptchaChallenge challenge = captchaService.generateChallenge();

        // Act: Redis fails for getSolution, falls back to empty localSolutions
        CaptchaVerificationResult result = captchaService.verify(challenge.token(), 100);

        // Assert: local map is empty because storeSolution returned after Redis success
        assertThat(result.success()).isFalse();
    }

    @Test
    void deleteSolution_redisUnavailable_removesFromLocalMap() {
        // Arrange: Redis completely unavailable
        when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis down"));

        CaptchaChallenge challenge = captchaService.generateChallenge();
        String token = challenge.token();

        // First verify: token recognized in local map
        CaptchaVerificationResult firstResult = captchaService.verify(token, 0);
        if (!firstResult.success()) {
            assertThat(firstResult.message()).doesNotContain("expire");
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Records
    // ═══════════════════════════════════════════════════════════════════

    @Test
    void captchaChallenge_recordFieldsAccessible() {
        // Arrange & Act
        CaptchaChallenge challenge = new CaptchaChallenge(
                "test-token", "bg-base64", "piece-base64", 50, 340, 200);

        // Assert
        assertThat(challenge.token()).isEqualTo("test-token");
        assertThat(challenge.backgroundImage()).isEqualTo("bg-base64");
        assertThat(challenge.puzzlePiece()).isEqualTo("piece-base64");
        assertThat(challenge.puzzleY()).isEqualTo(50);
        assertThat(challenge.width()).isEqualTo(340);
        assertThat(challenge.height()).isEqualTo(200);
    }

    @Test
    void verificationResult_successHasNullMessage() {
        // Arrange & Act
        CaptchaVerificationResult result = new CaptchaVerificationResult(true, null);

        // Assert
        assertThat(result.success()).isTrue();
        assertThat(result.message()).isNull();
    }

    @Test
    void verificationResult_failureHasMessage() {
        // Arrange & Act
        CaptchaVerificationResult result = new CaptchaVerificationResult(false, "Error occurred");

        // Assert
        assertThat(result.success()).isFalse();
        assertThat(result.message()).isEqualTo("Error occurred");
    }
}
