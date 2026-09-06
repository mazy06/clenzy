package com.clenzy.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.clenzy.service.SecurityAuditService;
import com.clenzy.tenant.TenantContext;
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
 *   ET un plafond par ORGANISATION (defaut 3000/min), qui borne la part du pool
 *   partage qu'un seul tenant peut consommer
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
    private final TenantContext tenantContext;

    /**
     * Limite generale de l'API authentifiee, par utilisateur et par minute.
     * Configurable (defaut 300, valeur historique inchangee) : un test de charge
     * concentre 50 VUs sur une seule identite et heurte le plafond des la
     * premiere minute — il mesurerait alors le limiteur, pas l'application.
     */
    private final int apiRateLimit;

    /**
     * Plafond par ORGANISATION, par minute.
     *
     * <p>La limite par utilisateur ne protege pas le pool partage : elle borne
     * un individu, pas un tenant. Une organisation de vingt utilisateurs pouvait
     * donc consommer vingt fois la limite et etouffer les autres — d'autant plus
     * facilement qu'un gros parc multiplie le cout de chaque ecran. Ce second
     * plafond borne la part qu'un seul tenant peut prendre.</p>
     *
     * <p>Defaut 3000/min, soit dix utilisateurs a plein regime : large pour un
     * usage normal, net pour un emballement.</p>
     */
    private final int orgRateLimit;

    // Fallback in-memory si Redis indisponible
    private final Map<String, RateLimitBucket> localBuckets = new ConcurrentHashMap<>();
    private volatile long lastCleanup = System.currentTimeMillis();
    private static final long CLEANUP_INTERVAL_MS = 300_000;

    public RateLimitInterceptor(StringRedisTemplate redisTemplate,
                                SecurityAuditService securityAuditService,
                                TenantContext tenantContext,
                                @Value("${clenzy.security.rate-limit.api-per-minute:300}") int apiRateLimit,
                                @Value("${clenzy.security.rate-limit.org-per-minute:3000}") int orgRateLimit) {
        this.redisTemplate = redisTemplate;
        this.securityAuditService = securityAuditService;
        this.tenantContext = tenantContext;
        this.apiRateLimit = apiRateLimit;
        this.orgRateLimit = orgRateLimit;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        cleanupLocalIfNeeded();

        String path = request.getRequestURI();
        String key;
        int limit;
        boolean orgScoped = false;

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
            limit = apiRateLimit;
            orgScoped = true;
        }

        // Plafond d'organisation, evalue AVANT celui de l'utilisateur : inutile
        // de consommer un jeton individuel si le tenant a deja sature sa part.
        if (orgScoped) {
            Long orgId = currentOrganizationId();
            if (orgId != null) {
                RateLimitResult orgResult = tryConsume("org:" + orgId, orgRateLimit);
                if (!orgResult.allowed) {
                    reject(response, "org:" + orgId, path, orgRateLimit, orgResult.retryAfterSeconds);
                    return false;
                }
            }
        }

        RateLimitResult result = tryConsume(key, limit);

        if (result.allowed) {
            response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(result.remaining));
            return true;
        } else {
            reject(response, key, path, limit, result.retryAfterSeconds);
            return false;
        }
    }

    /** Reponse 429 commune aux deux plafonds (utilisateur et organisation). */
    private void reject(HttpServletResponse response, String key, String path,
                        int limit, long retryAfter) throws java.io.IOException {
        response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
        response.setHeader("X-RateLimit-Remaining", "0");
        response.setHeader("Retry-After", String.valueOf(retryAfter));
        response.setStatus(429);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"too_many_requests\",\"message\":\"Rate limit exceeded. Retry after "
                + retryAfter + " seconds.\"}");

        log.warn("Rate limit atteint pour {} (path: {})", key, path);
        securityAuditService.logSuspiciousActivity(getCurrentUserId(),
                "Rate limit exceeded", Map.of("key", key, "path", path, "limit", limit));
    }

    /** Organisation courante, ou null hors contexte tenant (endpoints publics). */
    private Long currentOrganizationId() {
        try {
            return tenantContext.getOrganizationId();
        } catch (Exception e) {
            return null;
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
