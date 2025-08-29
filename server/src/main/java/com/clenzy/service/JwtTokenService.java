package com.clenzy.service;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class JwtTokenService {
    
    private static final Logger logger = LoggerFactory.getLogger(JwtTokenService.class);
    
    @Value("${jwt.secret:default-secret-key-for-development-only}")
    private String jwtSecret;
    
    @Value("${jwt.expiration:3600}")
    private long jwtExpiration;
    
    private final SecretKey secretKey;
    private final Map<String, TokenInfo> tokenCache = new ConcurrentHashMap<>();
    private final Set<String> blacklistedTokens = ConcurrentHashMap.newKeySet();
    
    // Métriques
    private long validTokens = 0;
    private long invalidTokens = 0;
    private long revokedTokens = 0;
    private long rejectedTokens = 0;
    private long cacheHits = 0;
    private long errors = 0;
    private LocalDateTime lastCleanup = LocalDateTime.now();
    
    public JwtTokenService() {
        this.secretKey = Keys.hmacShaKeyFor("default-secret-key-for-development-only-32-chars".getBytes());
    }
    
    /**
     * Valide un token JWT
     */
    public boolean isTokenValid(String token) {
        try {
            if (blacklistedTokens.contains(token)) {
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
            if (blacklistedTokens.contains(token)) {
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
        blacklistedTokens.add(token);
        revokedTokens++;
        logger.info("Token révoqué: {}", generateTokenId(token));
    }
    
    /**
     * Nettoie les tokens expirés
     */
    public void cleanupExpiredTokens() {
        try {
            int removedCount = 0;
            Iterator<Map.Entry<String, TokenInfo>> iterator = tokenCache.entrySet().iterator();
            
            while (iterator.hasNext()) {
                Map.Entry<String, TokenInfo> entry = iterator.next();
                if (entry.getValue().isExpired()) {
                    iterator.remove();
                    removedCount++;
                }
            }
            
            // Nettoyer aussi la blacklist des tokens très anciens
            // (plus de 24h)
            blacklistedTokens.removeIf(token -> {
                try {
                    Claims claims = Jwts.parser()
                        .verifyWith(secretKey)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();
                    
                    return claims.getExpiration().before(
                        Date.from(Instant.now().minusSeconds(86400))
                    );
                } catch (Exception e) {
                    return true; // Supprimer si on ne peut pas parser
                }
            });
            
            lastCleanup = LocalDateTime.now();
            logger.info("Nettoyage terminé: {} tokens supprimés", removedCount);
            
        } catch (Exception e) {
            logger.error("Erreur lors du nettoyage: {}", e.getMessage());
        }
    }
    
    /**
     * Obtient les statistiques du service
     */
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("cacheSize", tokenCache.size());
        stats.put("blacklistSize", blacklistedTokens.size());
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
     * Obtient la liste des tokens révoqués
     */
    public Map<String, Object> getBlacklistedTokens() {
        Map<String, Object> result = new HashMap<>();
        result.put("count", blacklistedTokens.size());
        result.put("tokens", new ArrayList<>(blacklistedTokens));
        return result;
    }
    
    /**
     * Supprime un token de la blacklist
     */
    public boolean removeFromBlacklist(String tokenId) {
        // Rechercher le token par son ID dans la blacklist
        for (String token : blacklistedTokens) {
            if (generateTokenId(token).equals(tokenId)) {
                blacklistedTokens.remove(token);
                return true;
            }
        }
        return false;
    }
    
    /**
     * Vide le cache des tokens
     */
    public void clearCache() {
        tokenCache.clear();
        logger.info("Cache des tokens vidé");
    }
    
    /**
     * Obtient l'état de santé du service
     */
    public Map<String, Object> getHealthStatus() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("cacheSize", tokenCache.size());
        health.put("blacklistSize", blacklistedTokens.size());
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
