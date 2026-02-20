package com.clenzy.service;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class JwtTokenService {

    private static final Logger logger = LoggerFactory.getLogger(JwtTokenService.class);
    private static final String BLACKLIST_KEY = "jwt:blacklist";

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration:3600}")
    private long jwtExpiration;

    private final StringRedisTemplate redisTemplate;
    private SecretKey secretKey;

    // Métriques
    private long validTokens = 0;
    private long invalidTokens = 0;
    private long revokedTokens = 0;
    private long rejectedTokens = 0;
    private long cacheHits = 0;
    private long errors = 0;
    private LocalDateTime lastCleanup = LocalDateTime.now();

    public JwtTokenService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @jakarta.annotation.PostConstruct
    public void init() {
        if (jwtSecret == null || jwtSecret.length() < 32) {
            throw new IllegalStateException("JWT secret must be at least 32 characters");
        }
        this.secretKey = Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    /**
     * Valide un token JWT
     */
    public boolean isTokenValid(String token) {
        try {
            Boolean isMember = redisTemplate.opsForSet().isMember(BLACKLIST_KEY, token);
            if (Boolean.TRUE.equals(isMember)) {
                rejectedTokens++;
                return false;
            }

            Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

            // Vérifier l'expiration
            if (claims.getExpiration().before(new Date())) {
                invalidTokens++;
                return false;
            }

            validTokens++;
            return true;

        } catch (JwtException | IllegalArgumentException e) {
            logger.warn("Token invalide: {}", e.getMessage());
            invalidTokens++;
            return false;
        } catch (Exception e) {
            logger.error("Erreur lors de la validation du token: {}", e.getMessage());
            errors++;
            return false;
        }
    }

    /**
     * Récupère les informations d'un token
     */
    public Optional<TokenInfo> getCurrentTokenInfo() {
        // Cette méthode nécessiterait le contexte de sécurité Spring
        // Pour l'instant, retournons un Optional vide
        return Optional.empty();
    }

    /**
     * Valide un token et retourne les informations
     */
    public TokenValidationResult validateToken(String token) {
        try {
            Boolean isMember = redisTemplate.opsForSet().isMember(BLACKLIST_KEY, token);
            if (Boolean.TRUE.equals(isMember)) {
                return new TokenValidationResult(false, "Token révoqué", null);
            }

            Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

            // Vérifier l'expiration
            if (claims.getExpiration().before(new Date())) {
                return new TokenValidationResult(false, "Token expiré", null);
            }

            TokenInfo tokenInfo = new TokenInfo(
                generateTokenId(token),
                claims.getSubject(),
                claims.getIssuer(),
                claims.getIssuedAt().toInstant(),
                claims.getExpiration().toInstant()
            );

            return new TokenValidationResult(true, null, tokenInfo);

        } catch (JwtException | IllegalArgumentException e) {
            return new TokenValidationResult(false, e.getMessage(), null);
        } catch (Exception e) {
            return new TokenValidationResult(false, "Erreur de validation", null);
        }
    }

    /**
     * Révoque un token
     */
    public void revokeToken(String token) {
        try {
            Claims claims = Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
            long ttlSeconds = (claims.getExpiration().getTime() - System.currentTimeMillis()) / 1000;
            if (ttlSeconds > 0) {
                redisTemplate.opsForSet().add(BLACKLIST_KEY, token);
                redisTemplate.expire(BLACKLIST_KEY, ttlSeconds, TimeUnit.SECONDS);
            }
        } catch (Exception e) {
            // If we can't parse the token, blacklist it for 24h
            redisTemplate.opsForSet().add(BLACKLIST_KEY, token);
            redisTemplate.expire(BLACKLIST_KEY, 86400, TimeUnit.SECONDS);
        }
        revokedTokens++;
        logger.info("Token revoque: {}", generateTokenId(token));
    }

    /**
     * Nettoie les tokens expirés.
     * Redis handles TTL expiry automatically for the blacklist set.
     * This method is kept for manual cache cleanup and metric tracking.
     */
    public void cleanupExpiredTokens() {
        try {
            // Redis handles TTL-based expiry automatically for the blacklist.
            // This method can be used for any additional manual cleanup if needed.
            lastCleanup = LocalDateTime.now();
            Long blacklistSize = redisTemplate.opsForSet().size(BLACKLIST_KEY);
            logger.info("Nettoyage terminé. Blacklist Redis actuelle: {} tokens",
                blacklistSize != null ? blacklistSize : 0);

        } catch (Exception e) {
            logger.error("Erreur lors du nettoyage: {}", e.getMessage());
        }
    }

    /**
     * Obtient les statistiques du service
     */
    public Map<String, Object> getStats() {
        Long blacklistSize = redisTemplate.opsForSet().size(BLACKLIST_KEY);
        Map<String, Object> stats = new HashMap<>();
        stats.put("blacklistSize", blacklistSize != null ? blacklistSize : 0);
        stats.put("validTokens", validTokens);
        stats.put("invalidTokens", invalidTokens);
        stats.put("revokedTokens", revokedTokens);
        stats.put("rejectedTokens", rejectedTokens);
        stats.put("cacheHits", cacheHits);
        stats.put("errors", errors);
        stats.put("lastCleanup", lastCleanup.toString());
        return stats;
    }

    /**
     * Obtient les métriques de performance
     */
    public TokenMetrics getMetrics() {
        long totalTokens = validTokens + invalidTokens + revokedTokens + rejectedTokens;
        double successRate = totalTokens > 0 ?
            ((double) validTokens / totalTokens) * 100 : 0.0;

        return new TokenMetrics(
            validTokens,
            invalidTokens,
            revokedTokens,
            rejectedTokens,
            cacheHits,
            errors,
            totalTokens,
            successRate
        );
    }

    /**
     * Obtient le nombre de tokens révoqués (sans exposer les valeurs)
     */
    public Map<String, Object> getBlacklistedTokens() {
        Long count = redisTemplate.opsForSet().size(BLACKLIST_KEY);
        Map<String, Object> result = new HashMap<>();
        result.put("count", count != null ? count : 0);
        return result;
    }

    /**
     * Supprime un token de la blacklist
     */
    public boolean removeFromBlacklist(String token) {
        Long removed = redisTemplate.opsForSet().remove(BLACKLIST_KEY, token);
        return removed != null && removed > 0;
    }

    /**
     * Vide le cache des tokens
     */
    public void clearCache() {
        redisTemplate.delete(BLACKLIST_KEY);
        logger.info("Cache des tokens vidé (blacklist Redis supprimée)");
    }

    /**
     * Obtient l'état de santé du service
     */
    public Map<String, Object> getHealthStatus() {
        Long blacklistSize = redisTemplate.opsForSet().size(BLACKLIST_KEY);
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("blacklistSize", blacklistSize != null ? blacklistSize : 0);
        health.put("lastCleanup", lastCleanup.toString());
        health.put("uptime", System.currentTimeMillis());
        return health;
    }

    /**
     * Génère un ID unique pour un token
     */
    private String generateTokenId(String token) {
        return token.length() > 8 ?
            token.substring(0, 8) + "..." + token.substring(token.length() - 4) :
            token;
    }

    // Classes internes
    public static class TokenInfo {
        private final String tokenId;
        private final String subject;
        private final String issuer;
        private final Instant issuedAt;
        private final Instant expiresAt;

        public TokenInfo(String tokenId, String subject, String issuer,
                        Instant issuedAt, Instant expiresAt) {
            this.tokenId = tokenId;
            this.subject = subject;
            this.issuer = issuer;
            this.issuedAt = issuedAt;
            this.expiresAt = expiresAt;
        }

        public String getTokenId() { return tokenId; }
        public String getSubject() { return subject; }
        public String getIssuer() { return issuer; }
        public Instant getIssuedAt() { return issuedAt; }
        public Instant getExpiresAt() { return expiresAt; }

        public boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }

        public boolean isNotYetValid() {
            return Instant.now().isBefore(issuedAt);
        }

        public long getTimeUntilExpiry() {
            return expiresAt.getEpochSecond() - Instant.now().getEpochSecond();
        }
    }

    public static class TokenValidationResult {
        private final boolean valid;
        private final String error;
        private final TokenInfo tokenInfo;

        public TokenValidationResult(boolean valid, String error, TokenInfo tokenInfo) {
            this.valid = valid;
            this.error = error;
            this.tokenInfo = tokenInfo;
        }

        public boolean isValid() { return valid; }
        public String getError() { return error; }
        public TokenInfo getTokenInfo() { return tokenInfo; }
    }

    public static class TokenMetrics {
        private final long validTokens;
        private final long invalidTokens;
        private final long revokedTokens;
        private final long rejectedTokens;
        private final long cacheHits;
        private final long errors;
        private final long totalTokens;
        private final double successRate;

        public TokenMetrics(long validTokens, long invalidTokens, long revokedTokens,
                          long rejectedTokens, long cacheHits, long errors,
                          long totalTokens, double successRate) {
            this.validTokens = validTokens;
            this.invalidTokens = invalidTokens;
            this.revokedTokens = revokedTokens;
            this.rejectedTokens = rejectedTokens;
            this.cacheHits = cacheHits;
            this.errors = errors;
            this.totalTokens = totalTokens;
            this.successRate = successRate;
        }

        public long getValidTokens() { return validTokens; }
        public long getInvalidTokens() { return invalidTokens; }
        public long getRevokedTokens() { return revokedTokens; }
        public long getRejectedTokens() { return rejectedTokens; }
        public long getCacheHits() { return cacheHits; }
        public long getErrors() { return errors; }
        public long getTotalTokens() { return totalTokens; }
        public double getSuccessRate() { return successRate; }
    }
}
