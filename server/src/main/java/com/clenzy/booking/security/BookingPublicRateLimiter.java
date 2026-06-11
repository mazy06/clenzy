package com.clenzy.booking.security;

import com.clenzy.util.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Rate limiter Redis dedie aux endpoints publics du booking engine
 * (creation de holds 30 min : {@code /reserve}, {@code /reserve-batch},
 * {@code /checkout/create-session}) et a la preview de site.
 *
 * <p>Mitige le DoS de calendrier : sans limite, un attaquant peut bloquer
 * toutes les dates d'une propriete en creant des reservations PENDING en
 * boucle (chaque hold gele les dates 30 minutes).</p>
 *
 * <p>Pattern identique au rate-limit Redis de la signature de contrats
 * (INCR + EXPIRE, fail-open si Redis indisponible) et au keying IP du
 * {@code RateLimitInterceptor}.</p>
 */
@Component
public class BookingPublicRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(BookingPublicRateLimiter.class);

    private static final String REDIS_PREFIX = "booking-rl:";

    /** Holds de reservation : 5 tentatives / 10 min / (IP + propriete). */
    public static final int HOLD_MAX_PER_WINDOW = 5;
    public static final Duration HOLD_WINDOW = Duration.ofMinutes(10);

    /** Paniers batch (jusqu'a 20 holds par appel) : 3 / 10 min / IP. */
    public static final int BATCH_MAX_PER_WINDOW = 3;

    /** Preview proxy (surface open-proxy) : 60 req / min / IP. */
    public static final int PREVIEW_MAX_PER_WINDOW = 60;
    public static final Duration PREVIEW_WINDOW = Duration.ofMinutes(1);

    private final StringRedisTemplate redisTemplate;

    public BookingPublicRateLimiter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Incremente le compteur de {@code key} et verifie la limite.
     * Fail-open si Redis est indisponible (la disponibilite du booking
     * engine prime ; le rate-limit Nginx reste actif en amont).
     *
     * @return {@code true} si la requete est autorisee
     */
    public boolean tryAcquire(String key, int maxPerWindow, Duration window) {
        try {
            String redisKey = REDIS_PREFIX + key;
            Long current = redisTemplate.opsForValue().increment(redisKey);
            if (current != null && current == 1L) {
                redisTemplate.expire(redisKey, window);
            }
            boolean allowed = current == null || current <= maxPerWindow;
            if (!allowed) {
                log.warn("Booking rate-limit atteint pour {} ({}/{})", key, current, maxPerWindow);
            }
            return allowed;
        } catch (Exception e) {
            log.warn("Booking rate-limit indisponible (Redis): {}", e.getMessage());
            return true;
        }
    }

    /** Raccourci pour les creations de hold (cle IP + propriete). */
    public boolean tryAcquireHold(HttpServletRequest request, Long propertyId) {
        return tryAcquire("hold:" + clientIp(request) + ":" + propertyId,
            HOLD_MAX_PER_WINDOW, HOLD_WINDOW);
    }

    /** Raccourci pour les paniers batch (cle IP seule). */
    public boolean tryAcquireBatch(HttpServletRequest request) {
        return tryAcquire("hold-batch:" + clientIp(request),
            BATCH_MAX_PER_WINDOW, HOLD_WINDOW);
    }

    /** Raccourci pour la preview proxy (cle IP seule). */
    public boolean tryAcquirePreview(HttpServletRequest request) {
        return tryAcquire("preview:" + clientIp(request),
            PREVIEW_MAX_PER_WINDOW, PREVIEW_WINDOW);
    }

    /**
     * IP cliente pour le keying : X-Forwarded-For n'est exploite que si le pair
     * direct est un proxy de confiance, parcouru de droite a gauche pour ignorer
     * les entrees spoofables. Delegue a {@link ClientIpResolver} (source unique,
     * partagee avec RateLimitInterceptor et la signature de contrats).
     */
    String clientIp(HttpServletRequest request) {
        return ClientIpResolver.resolve(
            request.getRemoteAddr(),
            request.getHeader("X-Forwarded-For"),
            request.getHeader("X-Real-IP"));
    }
}
