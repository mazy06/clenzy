package com.clenzy.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.clenzy.service.SecurityAuditService;
import com.clenzy.util.ClientIpResolver;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Intercepteur de rate limiting au niveau applicatif.
 *
 * Mode distribue Redis (si disponible) avec fallback in-memory.
 * Utilise un compteur Redis avec TTL (sliding window simplifie).
 *
 * Limites :
 * - Endpoints /api/auth/** : 10 req/min par IP (protection brute-force)
 * - Endpoints /api/** (authentifie) : 300 req/min par utilisateur
 *
 * Headers standards retournes :
 * - X-RateLimit-Limit : limite maximale
 * - X-RateLimit-Remaining : requetes restantes
 * - Retry-After : secondes avant reset (si limite atteinte)
 */
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(RateLimitInterceptor.class);

    private static final int AUTH_RATE_LIMIT = 30;   // par IP sur /api/auth/** (hors session)
    private static final int SESSION_RATE_LIMIT = 120; // /api/auth/session — appele a chaque navigation
    private static final int API_RATE_LIMIT = 300;
    // Protection brute-force des codes voucher (endpoint public, non auth).
    // 20 essais/min/IP suffit largement pour un guest qui tape son code,
    // bloque l'enumeration auto.
    private static final int VOUCHER_VALIDATE_RATE_LIMIT = 20;
    // Protection brute-force de la verification publique des codes d'echange de
    // cles (codes 6 chiffres). Plus strict que voucher car le code est court et
    // l'enjeu physique (acces logement). Complete par le lockout par token cote
    // KeyVerificationThrottle.
    private static final int KEY_VERIFY_RATE_LIMIT = 10;
    // Livre d'or public du livret d'accueil (Z4B-SECBUGS-05) : un guest poste
    // 1 entree — 5 POST/min/IP absorbe les retries tout en bloquant le spam.
    // Complete les plafonds applicatifs par token/livret de
    // WelcomeGuideEntryService.
    private static final int GUESTBOOK_POST_RATE_LIMIT = 5;
    private static final long WINDOW_MS = 60_000;
    private static final String REDIS_PREFIX = "ratelimit:";

    /**
     * INCR + PEXPIRE atomiques (Z1-BUGS-03). L'ancien check-then-act en deux
     * appels (increment puis expire si count == 1) laissait une cle SANS TTL si
     * l'EXPIRE n'etait jamais execute (timeout Redis entre les deux appels,
     * crash du pod) : la cle devenait permanente et l'IP/l'utilisateur restait
     * bloque en 429 jusqu'a purge manuelle. Le script Lua est execute
     * atomiquement par Redis ET re-pose le TTL si la cle n'en a plus
     * (auto-reparation des cles orphelines existantes).
     * Retourne {count, ttlMillis}.
     */
    @SuppressWarnings("rawtypes")
    private static final RedisScript<List> RATE_LIMIT_SCRIPT = new DefaultRedisScript<>(
            """
            local count = redis.call('INCR', KEYS[1])
            local ttl = redis.call('PTTL', KEYS[1])
            if ttl < 0 then
                redis.call('PEXPIRE', KEYS[1], ARGV[1])
                ttl = tonumber(ARGV[1])
            end
            return {count, ttl}
            """, List.class);

    private final StringRedisTemplate redisTemplate;
    private final SecurityAuditService securityAuditService;

    // Fallback in-memory si Redis indisponible
    private final Map<String, RateLimitBucket> localBuckets = new ConcurrentHashMap<>();
    private volatile long lastCleanup = System.currentTimeMillis();
    private static final long CLEANUP_INTERVAL_MS = 300_000;

    public RateLimitInterceptor(StringRedisTemplate redisTemplate,
                                SecurityAuditService securityAuditService) {
        this.redisTemplate = redisTemplate;
        this.securityAuditService = securityAuditService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        cleanupLocalIfNeeded();

        String path = request.getRequestURI();
        String key;
        int limit;

        if (path.equals("/api/auth/session") || path.equals("/api/permissions/sync")) {
            // Session check et permission sync sont appeles frequemment par le frontend
            key = "session:" + getClientIp(request);
            limit = SESSION_RATE_LIMIT;
        } else if (path.startsWith("/api/auth/")) {
            key = "auth:" + getClientIp(request);
            limit = AUTH_RATE_LIMIT;
        } else if (path.equals("/api/public/vouchers/validate")) {
            // Limite stricte par IP sur la validation publique de code voucher
            // (protection brute-force).
            key = "voucher-validate:" + getClientIp(request);
            limit = VOUCHER_VALIDATE_RATE_LIMIT;
        } else if (path.startsWith("/api/public/key-verify/")) {
            // Limite stricte par IP sur la verification publique des codes
            // d'echange de cles (protection brute-force des codes 6 chiffres).
            key = "key-verify:" + getClientIp(request);
            limit = KEY_VERIFY_RATE_LIMIT;
        } else if (isPublicGuestbookPost(request, path)) {
            // Limite stricte par IP sur l'ajout public d'entrees de livre d'or
            // (anti spam/storage abuse, Z4B-SECBUGS-05). La lecture (GET) reste
            // sur la limite generale.
            key = "guide-guestbook:" + getClientIp(request);
            limit = GUESTBOOK_POST_RATE_LIMIT;
        } else {
            String userId = getCurrentUserId();
            if (userId != null) {
                key = "user:" + userId;
            } else {
                key = "ip:" + getClientIp(request);
            }
            limit = API_RATE_LIMIT;
        }

        RateLimitResult result = tryConsume(key, limit);

        if (result.allowed) {
            response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(result.remaining));
            return true;
        } else {
            long retryAfter = result.retryAfterSeconds;
            response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
            response.setHeader("X-RateLimit-Remaining", "0");
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"too_many_requests\",\"message\":\"Rate limit exceeded. Retry after " + retryAfter + " seconds.\"}");

            log.warn("Rate limit atteint pour {} (path: {})", key, path);
            securityAuditService.logSuspiciousActivity(getCurrentUserId(),
                    "Rate limit exceeded", Map.of("key", key, "path", path, "limit", limit));
            return false;
        }
    }

    /** POST /api/public/guide/{token}/guestbook (le token UUID est un segment de path). */
    private static boolean isPublicGuestbookPost(HttpServletRequest request, String path) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && path.startsWith("/api/public/guide/")
                && path.endsWith("/guestbook");
    }

    private RateLimitResult tryConsume(String key, int limit) {
        try {
            if (redisTemplate != null) {
                return tryConsumeRedis(key, limit);
            }
        } catch (Exception e) {
            log.debug("Redis indisponible pour rate limiting, fallback local: {}", e.getMessage());
        }
        return tryConsumeLocal(key, limit);
    }

    /**
     * Rate limiting distribue via Redis.
     * Compteur atomique avec TTL = fenetre de 1 minute, en un seul
     * aller-retour Lua (INCR + PEXPIRE + PTTL atomiques).
     */
    private RateLimitResult tryConsumeRedis(String key, int limit) {
        String redisKey = REDIS_PREFIX + key;
        List<?> result = redisTemplate.execute(RATE_LIMIT_SCRIPT,
                List.of(redisKey), String.valueOf(WINDOW_MS));
        if (result == null || result.size() < 2 || !(result.get(0) instanceof Long count)) {
            // Reponse Redis inattendue : fail-open (coherent avec le fallback local)
            return new RateLimitResult(true, limit - 1, 60);
        }

        if (count <= limit) {
            return new RateLimitResult(true, (int) (limit - count), 60);
        }

        long ttlMs = result.get(1) instanceof Long ttl && ttl > 0 ? ttl : WINDOW_MS;
        long retryAfter = Math.max(1, (ttlMs + 999) / 1000);
        return new RateLimitResult(false, 0, retryAfter);
    }

    private RateLimitResult tryConsumeLocal(String key, int limit) {
        RateLimitBucket bucket = localBuckets.computeIfAbsent(key, k -> new RateLimitBucket(limit));
        if (bucket.tryConsume()) {
            return new RateLimitResult(true, bucket.getRemaining(), 60);
        }
        return new RateLimitResult(false, 0, bucket.getSecondsUntilReset());
    }

    /**
     * Resout l'IP cliente reelle pour le keying du rate-limit. Delegue a
     * {@link ClientIpResolver} (source de verite unique partagee avec
     * {@code TrustedClientIpResolver}) : X-Forwarded-For n'est exploite que si le
     * pair direct est un proxy de confiance, et il est parcouru de DROITE a GAUCHE
     * en sautant les proxies de confiance.
     *
     * <p>Visibilite package-private pour les tests.</p>
     */
    String getClientIp(HttpServletRequest request) {
        return ClientIpResolver.resolve(
                request.getRemoteAddr(),
                request.getHeader("X-Forwarded-For"),
                request.getHeader("X-Real-IP"));
    }

    /** Visibilite package-private pour les tests. Delegue a {@link ClientIpResolver}. */
    boolean isTrustedProxy(String address) {
        return ClientIpResolver.isTrustedProxy(address);
    }

    private String getCurrentUserId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
                return jwt.getSubject();
            }
        } catch (Exception e) {
            // Ignore
        }
        return null;
    }

    private void cleanupLocalIfNeeded() {
        long now = System.currentTimeMillis();
        if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
            lastCleanup = now;
            localBuckets.entrySet().removeIf(entry -> entry.getValue().isExpired());
        }
    }

    record RateLimitResult(boolean allowed, int remaining, long retryAfterSeconds) {}

    static class RateLimitBucket {
        private final int limit;
        private final AtomicInteger count = new AtomicInteger(0);
        private volatile long windowStart;

        RateLimitBucket(int limit) {
            this.limit = limit;
            this.windowStart = System.currentTimeMillis();
        }

        boolean tryConsume() {
            long now = System.currentTimeMillis();
            if (now - windowStart > WINDOW_MS) {
                count.set(0);
                windowStart = now;
            }
            return count.incrementAndGet() <= limit;
        }

        int getRemaining() {
            long now = System.currentTimeMillis();
            if (now - windowStart > WINDOW_MS) {
                return limit;
            }
            return Math.max(0, limit - count.get());
        }

        long getSecondsUntilReset() {
            long elapsed = System.currentTimeMillis() - windowStart;
            long remaining = WINDOW_MS - elapsed;
            return Math.max(1, remaining / 1000);
        }

        boolean isExpired() {
            return System.currentTimeMillis() - windowStart > WINDOW_MS * 5;
        }
    }
}
