package com.clenzy.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.clenzy.service.SecurityAuditService;

import java.time.Duration;
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

    private static final int AUTH_RATE_LIMIT = 10;   // par IP sur /api/auth/**
    private static final int API_RATE_LIMIT = 300;
    private static final long WINDOW_MS = 60_000;
    private static final String REDIS_PREFIX = "ratelimit:";

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

        if (path.startsWith("/api/auth/")) {
            key = "auth:" + getClientIp(request);
            limit = AUTH_RATE_LIMIT;
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
     * Compteur atomique avec TTL = fenetre de 1 minute.
     */
    private RateLimitResult tryConsumeRedis(String key, int limit) {
        String redisKey = REDIS_PREFIX + key;
        Long count = redisTemplate.opsForValue().increment(redisKey);
        if (count == null) {
            return new RateLimitResult(true, limit - 1, 60);
        }

        if (count == 1) {
            redisTemplate.expire(redisKey, Duration.ofMillis(WINDOW_MS));
        }

        if (count <= limit) {
            return new RateLimitResult(true, (int) (limit - count), 60);
        }

        Long ttl = redisTemplate.getExpire(redisKey);
        long retryAfter = (ttl != null && ttl > 0) ? ttl : 60;
        return new RateLimitResult(false, 0, retryAfter);
    }

    private RateLimitResult tryConsumeLocal(String key, int limit) {
        RateLimitBucket bucket = localBuckets.computeIfAbsent(key, k -> new RateLimitBucket(limit));
        if (bucket.tryConsume()) {
            return new RateLimitResult(true, bucket.getRemaining(), 60);
        }
        return new RateLimitResult(false, 0, bucket.getSecondsUntilReset());
    }

    private String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (isTrustedProxy(remoteAddr)) {
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
                return xForwardedFor.split(",")[0].trim();
            }
            String xRealIp = request.getHeader("X-Real-IP");
            if (xRealIp != null && !xRealIp.isEmpty()) {
                return xRealIp;
            }
        }
        return remoteAddr;
    }

    private boolean isTrustedProxy(String remoteAddr) {
        if (remoteAddr == null) return false;
        return remoteAddr.equals("127.0.0.1")
                || remoteAddr.equals("0:0:0:0:0:0:0:1")
                || remoteAddr.startsWith("172.")
                || remoteAddr.startsWith("10.")
                || remoteAddr.startsWith("192.168.");
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
