package com.clenzy.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Intercepteur de rate limiting au niveau applicatif.
 * Utilise un token bucket simplifie en memoire.
 *
 * Limites :
 * - Endpoints /api/auth/** : 30 req/min par IP (protection brute-force)
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

    // Rate limits par type
    private static final int AUTH_RATE_LIMIT = 10;      // 10 req/min pour auth (protection brute-force)
    private static final int API_RATE_LIMIT = 300;       // 300 req/min pour API authentifiee
    private static final long WINDOW_MS = 60_000;        // Fenetre de 1 minute

    // Cache en memoire des compteurs (nettoyage periodique)
    private final Map<String, RateLimitBucket> buckets = new ConcurrentHashMap<>();

    // Nettoyage toutes les 5 minutes des buckets expires
    private volatile long lastCleanup = System.currentTimeMillis();
    private static final long CLEANUP_INTERVAL_MS = 300_000;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // Nettoyage periodique
        cleanupIfNeeded();

        String path = request.getRequestURI();
        String key;
        int limit;

        if (path.startsWith("/api/auth/")) {
            // Pour les endpoints auth, limiter par IP
            key = "auth:" + getClientIp(request);
            limit = AUTH_RATE_LIMIT;
        } else {
            // Pour les endpoints authentifies, limiter par utilisateur
            String userId = getCurrentUserId();
            if (userId != null) {
                key = "user:" + userId;
            } else {
                key = "ip:" + getClientIp(request);
            }
            limit = API_RATE_LIMIT;
        }

        RateLimitBucket bucket = buckets.computeIfAbsent(key, k -> new RateLimitBucket(limit));

        if (bucket.tryConsume()) {
            // Requete autorisee - ajouter les headers informatifs
            response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(bucket.getRemaining()));
            return true;
        } else {
            // Rate limit atteint
            long retryAfter = bucket.getSecondsUntilReset();
            response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
            response.setHeader("X-RateLimit-Remaining", "0");
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"too_many_requests\",\"message\":\"Rate limit exceeded. Retry after " + retryAfter + " seconds.\"}");

            log.warn("Rate limit atteint pour {} (path: {})", key, path);
            return false;
        }
    }

    /**
     * Extrait l'IP client de maniere securisee.
     * Ne fait confiance aux headers X-Forwarded-For / X-Real-IP que si la requete
     * provient d'un proxy de confiance (loopback ou reseau Docker interne 172.x).
     * Sinon, utilise l'IP directe du socket (remoteAddr).
     */
    private String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        // Ne faire confiance aux headers proxy que si la requete vient d'un proxy de confiance
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

    private void cleanupIfNeeded() {
        long now = System.currentTimeMillis();
        if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
            lastCleanup = now;
            buckets.entrySet().removeIf(entry -> entry.getValue().isExpired());
        }
    }

    /**
     * Token bucket simplifie avec fenetre glissante.
     */
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
            // Reset si la fenetre est expiree
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
