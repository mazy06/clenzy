package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

/**
 * Service centralise de protection des tentatives de connexion.
 *
 * Fonctionnalites :
 * - Lockout par compte : apres MAX_FAILED_ATTEMPTS tentatives echouees, le compte
 *   est verrouille pendant LOCKOUT_DURATION_MINUTES minutes.
 * - CAPTCHA Cloudflare Turnstile : apres CAPTCHA_THRESHOLD tentatives echouees,
 *   le flag captchaRequired est leve. Le frontend affiche le widget Turnstile
 *   et envoie le token verifie dans le body du login.
 * - Persistance Redis uniquement.
 *
 * Cles Redis :
 * - login:attempts:{username} = nombre de tentatives echouees (TTL = lockout duration)
 * - login:locked:{username}  = timestamp de verrouillage (TTL = lockout duration)
 */
@Service
public class LoginProtectionService {

    private static final Logger log = LoggerFactory.getLogger(LoginProtectionService.class);

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int CAPTCHA_THRESHOLD = 3;
    private static final long LOCKOUT_DURATION_MINUTES = 15;

    private static final String REDIS_ATTEMPTS_PREFIX = "login:attempts:";
    private static final String REDIS_LOCKED_PREFIX = "login:locked:";
    private static final String TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    private final StringRedisTemplate redisTemplate;
    private final RestTemplate restTemplate;

    @Value("${captcha.enabled:true}")
    private boolean captchaEnabled;

    @Value("${turnstile.secret-key:}")
    private String turnstileSecretKey;

    public LoginProtectionService(StringRedisTemplate redisTemplate, RestTemplate restTemplate) {
        this.redisTemplate = redisTemplate;
        this.restTemplate = restTemplate;
    }

    // ─── Public API ────────────────────────────────────────────

    /**
     * Verifie si un compte est verrouille.
     *
     * @return LoginStatus avec isLocked, remainingSeconds, captchaRequired
     */
    public LoginStatus checkLoginAllowed(String username) {
        final String normalized = normalizeUsername(username);

        String lockedKey = REDIS_LOCKED_PREFIX + normalized;
        String attemptsKey = REDIS_ATTEMPTS_PREFIX + normalized;

        // Verifier si verrouille
        String lockedValue = redisTemplate.opsForValue().get(lockedKey);
        if (lockedValue != null) {
            Long ttl = redisTemplate.getExpire(lockedKey);
            long remainingSeconds = (ttl != null && ttl > 0) ? ttl : 0;

            if (remainingSeconds > 0) {
                return new LoginStatus(true, remainingSeconds, true);
            }
            // TTL expire, nettoyer
            redisTemplate.delete(lockedKey);
            redisTemplate.delete(attemptsKey);
        }

        // Verifier le nombre de tentatives pour le flag CAPTCHA
        String attemptsStr = redisTemplate.opsForValue().get(attemptsKey);
        int attempts = parseAttempts(attemptsStr);

        boolean captchaRequired = captchaEnabled && attempts >= CAPTCHA_THRESHOLD;
        return new LoginStatus(false, 0, captchaRequired);
    }

    /**
     * Enregistre une tentative de connexion echouee.
     * Incremente le compteur et verrouille si necessaire.
     */
    public void recordFailedAttempt(String username) {
        final String normalized = normalizeUsername(username);
        String attemptsKey = REDIS_ATTEMPTS_PREFIX + normalized;
        Duration lockoutDuration = Duration.ofMinutes(LOCKOUT_DURATION_MINUTES);

        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        if (attempts == null) attempts = 1L;

        // Mettre un TTL sur le compteur (auto-cleanup)
        if (attempts == 1) {
            redisTemplate.expire(attemptsKey, lockoutDuration);
        }

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            String lockedKey = REDIS_LOCKED_PREFIX + normalized;
            redisTemplate.opsForValue().set(lockedKey, String.valueOf(System.currentTimeMillis()), lockoutDuration);

            log.warn("Compte '{}' verrouille apres {} tentatives echouees (TTL={}min)",
                    normalized, attempts, LOCKOUT_DURATION_MINUTES);
        } else {
            int remaining = MAX_FAILED_ATTEMPTS - attempts.intValue();
            log.warn("Tentative echouee pour '{}' ({}/{}) - {} restante(s)",
                    normalized, attempts, MAX_FAILED_ATTEMPTS, remaining);
        }
    }

    /**
     * Reinitialise le compteur apres une connexion reussie.
     */
    public void recordSuccessfulLogin(String username) {
        final String normalized = normalizeUsername(username);
        redisTemplate.delete(REDIS_ATTEMPTS_PREFIX + normalized);
        redisTemplate.delete(REDIS_LOCKED_PREFIX + normalized);
    }

    /**
     * Verifie si le CAPTCHA est requis pour un compte donne.
     */
    public boolean isCaptchaRequired(String username) {
        if (!captchaEnabled) return false;
        return checkLoginAllowed(username).captchaRequired();
    }

    /**
     * Valide un token Cloudflare Turnstile via l'API siteverify.
     *
     * Flow :
     * 1. Frontend affiche le widget Turnstile quand captchaRequired = true
     * 2. L'utilisateur complete le challenge (souvent invisible)
     * 3. Turnstile retourne un token cote client
     * 4. Frontend envoie le token dans le body du login (captchaToken)
     * 5. Cette methode valide le token aupres de Cloudflare
     */
    @SuppressWarnings("unchecked")
    public boolean validateCaptchaToken(String captchaToken) {
        if (!captchaEnabled) return true;
        if (captchaToken == null || captchaToken.isBlank()) return false;

        if (turnstileSecretKey == null || turnstileSecretKey.isBlank()) {
            log.warn("Turnstile secret key non configuree, validation CAPTCHA ignoree");
            return true;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("secret", turnstileSecretKey);
            params.add("response", captchaToken);

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

            Map<String, Object> response = restTemplate.postForObject(
                    TURNSTILE_VERIFY_URL, request, Map.class);

            if (response != null && Boolean.TRUE.equals(response.get("success"))) {
                return true;
            }

            log.warn("Turnstile validation echouee: {}", response);
            return false;

        } catch (Exception e) {
            log.error("Erreur lors de la validation Turnstile: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Deverrouille manuellement un compte (appele par un admin).
     */
    public void forceUnlock(String username) {
        final String normalized = normalizeUsername(username);
        redisTemplate.delete(REDIS_ATTEMPTS_PREFIX + normalized);
        redisTemplate.delete(REDIS_LOCKED_PREFIX + normalized);
        log.info("Compte '{}' deverrouille manuellement par un administrateur", normalized);
    }

    /**
     * Retourne le nombre de tentatives echouees pour un compte.
     */
    public int getFailedAttempts(String username) {
        final String normalized = normalizeUsername(username);
        String attemptsStr = redisTemplate.opsForValue().get(REDIS_ATTEMPTS_PREFIX + normalized);
        return parseAttempts(attemptsStr);
    }

    // ─── Helpers ───────────────────────────────────────────────

    private String normalizeUsername(String username) {
        if (username == null) return "";
        return username.toLowerCase().trim();
    }

    private int parseAttempts(String attemptsStr) {
        if (attemptsStr == null) return 0;
        try {
            return Integer.parseInt(attemptsStr);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // ─── Records ──────────────────────────────────────────────

    /**
     * Resultat de la verification de protection login.
     */
    public record LoginStatus(boolean isLocked, long remainingSeconds, boolean captchaRequired) {}
}
