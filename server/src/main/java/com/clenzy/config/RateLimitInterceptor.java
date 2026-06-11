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
    // Retour PayPal public (Z3-SEC-04) : un guest legitime ne revient qu'une
    // fois de PayPal — 15 req/min/IP absorbe les retries navigateur tout en
    // bloquant le scan d'order_id et l'epuisement BDD/API PayPal.
    private static final int PAYPAL_RETURN_RATE_LIMIT = 15;
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
        } else if (path.equals("/api/payments/paypal/return")) {
            // Limite stricte par IP sur le retour PayPal public (anti scan
            // d'order_id / DoS, Z3-SEC-04).
            key = "paypal-return:" + getClientIp(request);
            limit = PAYPAL_RETURN_RATE_LIMIT;
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
     * Plages privees/loopback considerees comme proxies de confiance (nginx,
     * reseaux Docker). CIDR exacts : 172.32.x.x ou 172.0.x.x (publiques) ne sont
     * PAS de confiance, contrairement a l'ancien test startsWith("172.").
     */
    private static final List<Ipv4Cidr> TRUSTED_PROXY_RANGES = List.of(
            Ipv4Cidr.parse("127.0.0.0/8"),
            Ipv4Cidr.parse("10.0.0.0/8"),
            Ipv4Cidr.parse("172.16.0.0/12"),
            Ipv4Cidr.parse("192.168.0.0/16"));

    /**
     * Resout l'IP cliente reelle pour le keying du rate-limit.
     *
     * X-Forwarded-For n'est exploite que si le pair direct est un proxy de
     * confiance, et il est parcouru de DROITE a GAUCHE en sautant les proxies de
     * confiance : nginx AJOUTE l'IP reelle en fin de chaine
     * (proxy_add_x_forwarded_for), donc les entrees de gauche sont fournies par
     * le client et spoofables.
     *
     * <p>Visibilite package-private pour les tests.</p>
     */
    String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (!isTrustedProxy(remoteAddr)) {
            return remoteAddr;
        }
        String forwardedClientIp = resolveClientIpFromForwardedChain(request.getHeader("X-Forwarded-For"));
        if (forwardedClientIp != null) {
            return forwardedClientIp;
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return remoteAddr;
    }

    /**
     * Parcourt X-Forwarded-For de droite a gauche et retourne la premiere adresse
     * qui n'est pas un proxy de confiance (= IP cliente vue par le premier proxy
     * de confiance). Retourne null si le header est absent/vide ou si toute la
     * chaine est de confiance (client interne : repli X-Real-IP/remoteAddr).
     */
    private String resolveClientIpFromForwardedChain(String xForwardedFor) {
        if (xForwardedFor == null || xForwardedFor.isBlank()) {
            return null;
        }
        String[] entries = xForwardedFor.split(",");
        for (int i = entries.length - 1; i >= 0; i--) {
            String candidate = entries[i].trim();
            if (candidate.isEmpty()) {
                continue;
            }
            if (!isTrustedProxy(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    /** Visibilite package-private pour les tests. */
    boolean isTrustedProxy(String address) {
        if (address == null || address.isBlank()) {
            return false;
        }
        String trimmed = address.trim();
        if (trimmed.equals("0:0:0:0:0:0:0:1") || trimmed.equals("::1")) {
            return true;
        }
        Integer ipv4 = Ipv4Cidr.parseAddress(trimmed);
        if (ipv4 == null) {
            return false;
        }
        for (Ipv4Cidr range : TRUSTED_PROXY_RANGES) {
            if (range.contains(ipv4)) {
                return true;
            }
        }
        return false;
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

    /**
     * Plage CIDR IPv4 : comparaison par masque sur des litteraux d'adresse,
     * sans aucune resolution DNS.
     */
    record Ipv4Cidr(int network, int mask) {

        static Ipv4Cidr parse(String cidr) {
            int slash = cidr.indexOf('/');
            if (slash < 0) {
                throw new IllegalArgumentException("CIDR invalide: " + cidr);
            }
            Integer base = parseAddress(cidr.substring(0, slash));
            int prefix = Integer.parseInt(cidr.substring(slash + 1));
            if (base == null || prefix < 0 || prefix > 32) {
                throw new IllegalArgumentException("CIDR invalide: " + cidr);
            }
            int mask = prefix == 0 ? 0 : -1 << (32 - prefix);
            return new Ipv4Cidr(base & mask, mask);
        }

        /** Retourne null si la valeur n'est pas une IPv4 litterale valide. */
        static Integer parseAddress(String address) {
            String[] octets = address.split("\\.", -1);
            if (octets.length != 4) {
                return null;
            }
            int value = 0;
            for (String octetText : octets) {
                if (octetText.isEmpty() || octetText.length() > 3) {
                    return null;
                }
                final int octet;
                try {
                    octet = Integer.parseInt(octetText);
                } catch (NumberFormatException e) {
                    return null;
                }
                if (octet < 0 || octet > 255) {
                    return null;
                }
                value = (value << 8) | octet;
            }
            return value;
        }

        boolean contains(int address) {
            return (address & mask) == network;
        }
    }

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
