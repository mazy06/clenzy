package com.clenzy.service;

import com.clenzy.exception.TooManyVerificationAttemptsException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * Protection anti brute-force de la verification publique des codes d'echange
 * de cles ({@code /api/public/key-verify/{token}}).
 *
 * <p>Les codes Clenzy KeyVault ne font que 6 chiffres (1M de combinaisons) et
 * l'endpoint est public : le rate-limiting par IP ({@code RateLimitInterceptor})
 * ne suffit pas contre un attaquant multi-IP. On verrouille donc le <b>token</b>
 * (un point d'echange) apres {@link #MAX_FAILED_ATTEMPTS} codes errones, pendant
 * {@link #LOCKOUT_MINUTES} minutes — peu importe l'IP source.</p>
 *
 * <p>Le compteur n'est incremente que sur un <b>code errone avec un token
 * valide</b> (le seul vecteur de brute-force ; les tokens sont des UUID 128 bits,
 * non enumerables). Tout est fail-open si Redis est indisponible, pour ne pas
 * bloquer un commercant legitime.</p>
 *
 * <p>Cles Redis : {@code keyverify:attempts:{token}} et
 * {@code keyverify:locked:{token}}.</p>
 */
@Service
public class KeyVerificationThrottle {

    private static final Logger log = LoggerFactory.getLogger(KeyVerificationThrottle.class);

    static final int MAX_FAILED_ATTEMPTS = 10;
    static final long LOCKOUT_MINUTES = 10;
    private static final String ATTEMPTS_PREFIX = "keyverify:attempts:";
    private static final String LOCKED_PREFIX = "keyverify:locked:";

    private final StringRedisTemplate redisTemplate;

    public KeyVerificationThrottle(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Refuse l'acces (HTTP 429) si le token est actuellement verrouille.
     * Fail-open si Redis est indisponible.
     */
    public void assertNotLocked(String token) {
        try {
            if (redisTemplate.opsForValue().get(LOCKED_PREFIX + token) == null) {
                return;
            }
            Long ttl = redisTemplate.getExpire(LOCKED_PREFIX + token);
            throw new TooManyVerificationAttemptsException(ttl != null && ttl > 0 ? ttl : LOCKOUT_MINUTES * 60);
        } catch (TooManyVerificationAttemptsException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis indisponible pour le throttle key-verify (fail-open) : {}", e.getMessage());
        }
    }

    /**
     * Enregistre une tentative de code erronee et verrouille le token au seuil.
     */
    public void recordFailure(String token) {
        try {
            String attemptsKey = ATTEMPTS_PREFIX + token;
            Duration lockout = Duration.ofMinutes(LOCKOUT_MINUTES);

            Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
            if (attempts == null) {
                return;
            }
            if (attempts == 1L) {
                redisTemplate.expire(attemptsKey, lockout);
            }
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                redisTemplate.opsForValue().set(LOCKED_PREFIX + token, "1", lockout);
                log.warn("Token de verification verrouille apres {} codes errones (TTL={}min)",
                        attempts, LOCKOUT_MINUTES);
            }
        } catch (Exception e) {
            log.warn("Redis indisponible pour record key-verify (fail-open) : {}", e.getMessage());
        }
    }

    /**
     * Reinitialise le compteur apres un code correct.
     */
    public void reset(String token) {
        try {
            redisTemplate.delete(ATTEMPTS_PREFIX + token);
            redisTemplate.delete(LOCKED_PREFIX + token);
        } catch (Exception e) {
            log.debug("Redis cleanup key-verify ignore : {}", e.getMessage());
        }
    }
}
