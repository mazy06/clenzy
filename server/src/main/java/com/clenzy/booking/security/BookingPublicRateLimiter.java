package com.clenzy.booking.security;

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
     * IP cliente pour le keying : X-Forwarded-For n'est exploite que si le
     * pair direct est un proxy de confiance (reseau prive/loopback — nginx,
     * Docker), parcouru de droite a gauche pour ignorer les entrees
     * spoofables ajoutees par le client (meme regle que RateLimitInterceptor).
     */
    String clientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (!isPrivateOrLoopback(remoteAddr)) {
            return remoteAddr;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] entries = forwarded.split(",");
            for (int i = entries.length - 1; i >= 0; i--) {
                String candidate = entries[i].trim();
                if (!candidate.isEmpty() && !isPrivateOrLoopback(candidate)) {
                    return candidate;
                }
            }
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return remoteAddr;
    }

    /** Comparaison sur litteraux d'adresse uniquement — aucune resolution DNS. */
    private static boolean isPrivateOrLoopback(String address) {
        if (address == null || address.isBlank()) {
            return false;
        }
        String trimmed = address.trim();
        if (trimmed.equals("::1") || trimmed.equals("0:0:0:0:0:0:0:1")) {
            return true;
        }
        String[] octets = trimmed.split("\\.", -1);
        if (octets.length != 4) {
            return false;
        }
        final int b0;
        final int b1;
        try {
            b0 = Integer.parseInt(octets[0]);
            b1 = Integer.parseInt(octets[1]);
        } catch (NumberFormatException e) {
            return false;
        }
        if (b0 == 127 || b0 == 10) {
            return true;
        }
        if (b0 == 172 && b1 >= 16 && b1 <= 31) {
            return true;
        }
        return b0 == 192 && b1 == 168;
    }
}
