package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service centralise de protection des tentatives de connexion.
 *
 * Fonctionnalites :
 * - Lockout par compte : apres MAX_FAILED_ATTEMPTS tentatives echouees, le compte
 *   est verrouille pendant LOCKOUT_DURATION_MINUTES minutes.
 * - CAPTCHA puzzle slider obligatoire : apres CAPTCHA_THRESHOLD tentatives echouees,
 *   le flag captchaRequired est leve. Le frontend doit afficher le puzzle slider
 *   et envoyer le token verifie dans le body du login.
 * - Validation CAPTCHA : verifie le token aupres du CaptchaService interne
 *   (puzzle slider self-hosted, pas de dependance externe Google/Cloudflare).
 * - Persistance Redis : les donnees survivent aux redemarrages du serveur.
 *   Fallback in-memory si Redis est indisponible.
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

    private final StringRedisTemplate redisTemplate;
    private final CaptchaService captchaService;

    @Value("${captcha.enabled:true}")
    private boolean captchaEnabled;

    // Fallback in-memory si Redis indisponible
    private final Map<String, LocalLockout> localLockouts = new ConcurrentHashMap<>();

    public LoginProtectionService(StringRedisTemplate redisTemplate, CaptchaService captchaService) {
        this.redisTemplate = redisTemplate;
        this.captchaService = captchaService;
    }

    // ─── Public API ────────────────────────────────────────────

    /**
     * Verifie si un compte est verrouille.
     *
     * @return LoginStatus avec isLocked, remainingSeconds, captchaRequired
     */
    public LoginStatus checkLoginAllowed(String username) {
        String normalizedUsername = normalizeUsername(username);

        try {
            if (redisTemplate != null) {
                return checkRedis(normalizedUsername);
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour login protection, fallback local: {}", e.getMessage());
        }

        return checkLocal(normalizedUsername);
    }

    /**
     * Enregistre une tentative de connexion echouee.
     * Incremente le compteur et verrouille si necessaire.
     */
    public void recordFailedAttempt(String username) {
        String normalizedUsername = normalizeUsername(username);

        try {
            if (redisTemplate != null) {
                recordFailedRedis(normalizedUsername);
                return;
            }
        } catch (Exception e) {
            log.debug("Redis indisponible, fallback local: {}", e.getMessage());
        }

        recordFailedLocal(normalizedUsername);
    }

    /**
     * Reinitialise le compteur apres une connexion reussie.
     */
    public void recordSuccessfulLogin(String username) {
        String normalizedUsername = normalizeUsername(username);

        try {
            if (redisTemplate != null) {
                redisTemplate.delete(REDIS_ATTEMPTS_PREFIX + normalizedUsername);
                redisTemplate.delete(REDIS_LOCKED_PREFIX + normalizedUsername);
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour reset login: {}", e.getMessage());
        }

        localLockouts.remove(normalizedUsername);
    }

    /**
     * Verifie si le CAPTCHA est requis pour un compte donne.
     */
    public boolean isCaptchaRequired(String username) {
        if (!captchaEnabled) return false;
        LoginStatus status = checkLoginAllowed(normalizeUsername(username));
        return status.captchaRequired();
    }

    /**
     * Valide un token de CAPTCHA puzzle slider via le CaptchaService interne.
     *
     * Le token est le meme que celui retourne par /api/auth/captcha/verify.
     * Le frontend doit d'abord appeler /generate, resoudre le puzzle,
     * appeler /verify, puis envoyer le token dans le body du login.
     *
     * Le CaptchaService verifie que le token a ete resolu avec succes
     * (le token est supprime apres verification reussie dans /verify,
     * mais on accepte le token s'il a ete verifie avec succes).
     *
     * Flow :
     * 1. Frontend appelle POST /api/auth/captcha/generate → recoit token + images
     * 2. L'utilisateur resout le puzzle
     * 3. Frontend appelle POST /api/auth/captcha/verify { token, x } → recoit { success: true, captchaToken }
     * 4. Frontend envoie le captchaToken dans le body du login
     * 5. Ce method valide que le captchaToken a ete verifie
     *
     * IMPORTANT : Le token est valide dans Redis/memory par le CaptchaService lors du /verify.
     * Ici on re-valide simplement que le token est un format UUID valide
     * et qu'il a ete consomme par le CaptchaService (usage unique).
     * La vraie validation (position X) a deja eu lieu dans /verify.
     *
     * On utilise Redis pour marquer les tokens verifies avec succes.
     */
    public boolean validateCaptchaToken(String captchaToken) {
        if (!captchaEnabled) {
            return true; // CAPTCHA desactive
        }

        if (captchaToken == null || captchaToken.isBlank()) {
            return false;
        }

        // Verifier que le token a ete marque comme verifie
        try {
            if (redisTemplate != null) {
                String verifiedKey = "captcha:verified:" + captchaToken;
                String value = redisTemplate.opsForValue().get(verifiedKey);
                if ("true".equals(value)) {
                    // Consommer le token (usage unique pour le login)
                    redisTemplate.delete(verifiedKey);
                    return true;
                }
                return false;
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour CAPTCHA validation: {}", e.getMessage());
        }

        // Fail closed : si Redis est indisponible, refuser le CAPTCHA pour des raisons de securite
        log.warn("CAPTCHA validation echouee: Redis indisponible, fail closed par securite");
        return false;
    }

    /**
     * Marque un token CAPTCHA comme verifie avec succes.
     * Appele par le CaptchaController apres une verification de puzzle reussie.
     */
    public void markCaptchaVerified(String captchaToken) {
        if (captchaToken == null || captchaToken.isBlank()) return;

        try {
            if (redisTemplate != null) {
                String verifiedKey = "captcha:verified:" + captchaToken;
                redisTemplate.opsForValue().set(verifiedKey, "true", Duration.ofMinutes(5));
                return;
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour marquer CAPTCHA verifie: {}", e.getMessage());
        }
    }

    // ─── Redis Implementation ──────────────────────────────────

    private LoginStatus checkRedis(String username) {
        String lockedKey = REDIS_LOCKED_PREFIX + username;
        String attemptsKey = REDIS_ATTEMPTS_PREFIX + username;

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
        int attempts = 0;
        if (attemptsStr != null) {
            try {
                attempts = Integer.parseInt(attemptsStr);
            } catch (NumberFormatException ignored) {}
        }

        boolean captchaRequired = captchaEnabled && attempts >= CAPTCHA_THRESHOLD;
        return new LoginStatus(false, 0, captchaRequired);
    }

    private void recordFailedRedis(String username) {
        String attemptsKey = REDIS_ATTEMPTS_PREFIX + username;
        Duration lockoutDuration = Duration.ofMinutes(LOCKOUT_DURATION_MINUTES);

        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        if (attempts == null) attempts = 1L;

        // Mettre un TTL sur le compteur (auto-cleanup)
        if (attempts == 1) {
            redisTemplate.expire(attemptsKey, lockoutDuration);
        }

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            // Verrouiller le compte
            String lockedKey = REDIS_LOCKED_PREFIX + username;
            redisTemplate.opsForValue().set(lockedKey, String.valueOf(System.currentTimeMillis()), lockoutDuration);

            log.warn("Compte '{}' verrouille apres {} tentatives echouees (Redis, TTL={}min)",
                    username, attempts, LOCKOUT_DURATION_MINUTES);
        } else {
            int remaining = MAX_FAILED_ATTEMPTS - attempts.intValue();
            log.warn("Tentative echouee pour '{}' ({}/{}) - {} restante(s)",
                    username, attempts, MAX_FAILED_ATTEMPTS, remaining);
        }
    }

    // ─── Local Fallback ────────────────────────────────────────

    private LoginStatus checkLocal(String username) {
        LocalLockout lockout = localLockouts.get(username);
        if (lockout == null) {
            return new LoginStatus(false, 0, false);
        }

        if (lockout.isLocked()) {
            long remainingMs = lockout.getRemainingLockMs();
            long remainingSeconds = Math.max(1, remainingMs / 1000);
            return new LoginStatus(true, remainingSeconds, true);
        }

        boolean captchaRequired = captchaEnabled && lockout.failedAttempts >= CAPTCHA_THRESHOLD;
        return new LoginStatus(false, 0, captchaRequired);
    }

    private void recordFailedLocal(String username) {
        LocalLockout lockout = localLockouts.computeIfAbsent(username, k -> new LocalLockout());
        lockout.recordFailure();
    }

    /**
     * Deverrouille manuellement un compte (appele par un admin).
     * Supprime le lockout ET les tentatives echouees.
     *
     * @param username l'email ou username du compte a debloquer
     */
    public void forceUnlock(String username) {
        String normalizedUsername = normalizeUsername(username);

        try {
            if (redisTemplate != null) {
                redisTemplate.delete(REDIS_ATTEMPTS_PREFIX + normalizedUsername);
                redisTemplate.delete(REDIS_LOCKED_PREFIX + normalizedUsername);
                log.info("Compte '{}' deverrouille manuellement par un administrateur", normalizedUsername);
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour forceUnlock: {}", e.getMessage());
        }

        localLockouts.remove(normalizedUsername);
    }

    /**
     * Retourne le nombre de tentatives echouees pour un compte.
     */
    public int getFailedAttempts(String username) {
        String normalizedUsername = normalizeUsername(username);

        try {
            if (redisTemplate != null) {
                String attemptsStr = redisTemplate.opsForValue().get(REDIS_ATTEMPTS_PREFIX + normalizedUsername);
                if (attemptsStr != null) {
                    return Integer.parseInt(attemptsStr);
                }
                return 0;
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour getFailedAttempts: {}", e.getMessage());
        }

        LocalLockout lockout = localLockouts.get(normalizedUsername);
        return lockout != null ? lockout.failedAttempts : 0;
    }

    // ─── Helpers ───────────────────────────────────────────────

    private String normalizeUsername(String username) {
        if (username == null) return "";
        return username.toLowerCase().trim();
    }

    // ─── Records & Inner Classes ───────────────────────────────

    /**
     * Resultat de la verification de protection login.
     */
    public record LoginStatus(boolean isLocked, long remainingSeconds, boolean captchaRequired) {}

    /**
     * Fallback in-memory pour le lockout (quand Redis est indisponible).
     */
    static class LocalLockout {
        private static final long LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;

        volatile int failedAttempts;
        volatile long lockedAt;

        void recordFailure() {
            failedAttempts++;
            if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                lockedAt = System.currentTimeMillis();
            }
        }

        boolean isLocked() {
            if (failedAttempts < MAX_FAILED_ATTEMPTS) return false;
            if (System.currentTimeMillis() - lockedAt > LOCKOUT_DURATION_MS) {
                failedAttempts = 0;
                lockedAt = 0;
                return false;
            }
            return true;
        }

        long getRemainingLockMs() {
            long elapsed = System.currentTimeMillis() - lockedAt;
            return Math.max(0, LOCKOUT_DURATION_MS - elapsed);
        }
    }
}
