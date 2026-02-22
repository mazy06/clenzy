package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class TokenCleanupService {
    
    private static final Logger logger = LoggerFactory.getLogger(TokenCleanupService.class);
    private static final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JwtTokenService jwtTokenService;

    public TokenCleanupService(JwtTokenService jwtTokenService) {
        this.jwtTokenService = jwtTokenService;
    }
    
    /**
     * Nettoyage automatique des tokens expirés toutes les 30 minutes
     */
    @Scheduled(fixedRate = 1800000) // 30 minutes
    public void scheduledTokenCleanup() {
        try {
            logger.info("🔄 Début du nettoyage automatique des tokens - {}", 
                LocalDateTime.now().format(formatter));
            
            // Sauvegarder les statistiques avant nettoyage
            var statsBefore = jwtTokenService.getStats();
            long cacheSizeBefore = convertToLong(statsBefore.get("cacheSize"));
            long blacklistSizeBefore = convertToLong(statsBefore.get("blacklistSize"));
            
            // Effectuer le nettoyage
            jwtTokenService.cleanupExpiredTokens();
            
            // Récupérer les nouvelles statistiques
            var statsAfter = jwtTokenService.getStats();
            long cacheSizeAfter = convertToLong(statsAfter.get("cacheSize"));
            long blacklistSizeAfter = convertToLong(statsAfter.get("blacklistSize"));
            
            // Calculer les différences
            long cacheRemoved = cacheSizeBefore - cacheSizeAfter;
            long blacklistRemoved = blacklistSizeBefore - blacklistSizeAfter;
            
            logger.info("✅ Nettoyage automatique terminé - {}", 
                LocalDateTime.now().format(formatter));
            logger.info("📊 Résultats: Cache: {} supprimés, Blacklist: {} supprimés", 
                cacheRemoved, blacklistRemoved);
            
        } catch (Exception e) {
            logger.error("❌ Erreur lors du nettoyage automatique des tokens: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Nettoyage manuel des tokens expirés
     */
    public void manualTokenCleanup() {
        try {
            logger.info("🔄 Début du nettoyage manuel des tokens - {}", 
                LocalDateTime.now().format(formatter));
            
            var statsBefore = jwtTokenService.getStats();
            long cacheSizeBefore = convertToLong(statsBefore.get("cacheSize"));
            long blacklistSizeBefore = convertToLong(statsBefore.get("blacklistSize"));
            
            jwtTokenService.cleanupExpiredTokens();
            
            var statsAfter = jwtTokenService.getStats();
            long cacheSizeAfter = convertToLong(statsAfter.get("cacheSize"));
            long blacklistSizeAfter = convertToLong(statsAfter.get("blacklistSize"));
            
            long cacheRemoved = cacheSizeBefore - cacheSizeAfter;
            long blacklistRemoved = blacklistSizeBefore - blacklistSizeAfter;
            
            logger.info("✅ Nettoyage manuel terminé - {}", 
                LocalDateTime.now().format(formatter));
            logger.info("📊 Résultats: Cache: {} supprimés, Blacklist: {} supprimés", 
                cacheRemoved, blacklistRemoved);
            
        } catch (Exception e) {
            logger.error("❌ Erreur lors du nettoyage manuel des tokens: {}", e.getMessage(), e);
            throw new RuntimeException("Échec du nettoyage manuel des tokens", e);
        }
    }
    
    /**
     * Nettoyage d'urgence - force le nettoyage de tous les tokens expirés
     */
    public void emergencyTokenCleanup() {
        try {
            logger.warn("🚨 Début du nettoyage d'urgence des tokens - {}", 
                LocalDateTime.now().format(formatter));
            
            var statsBefore = jwtTokenService.getStats();
            long cacheSizeBefore = convertToLong(statsBefore.get("cacheSize"));
            long blacklistSizeBefore = convertToLong(statsBefore.get("blacklistSize"));
            
            // Nettoyage multiple pour s'assurer que tout est nettoyé
            for (int i = 0; i < 3; i++) {
                jwtTokenService.cleanupExpiredTokens();
                Thread.sleep(100); // Petite pause entre les nettoyages
            }
            
            var statsAfter = jwtTokenService.getStats();
            long cacheSizeAfter = convertToLong(statsAfter.get("cacheSize"));
            long blacklistSizeAfter = convertToLong(statsAfter.get("blacklistSize"));
            
            long cacheRemoved = cacheSizeBefore - cacheSizeAfter;
            long blacklistRemoved = blacklistSizeBefore - blacklistSizeAfter;
            
            logger.warn("🚨 Nettoyage d'urgence terminé - {}", 
                LocalDateTime.now().format(formatter));
            logger.warn("📊 Résultats: Cache: {} supprimés, Blacklist: {} supprimés", 
                cacheRemoved, blacklistRemoved);
            
        } catch (Exception e) {
            logger.error("❌ Erreur lors du nettoyage d'urgence des tokens: {}", e.getMessage(), e);
            throw new RuntimeException("Échec du nettoyage d'urgence des tokens", e);
        }
    }
    
    /**
     * Obtient les informations de nettoyage
     */
    public String getCleanupInfo() {
        try {
            var stats = jwtTokenService.getStats();
            String lastCleanup = (String) stats.get("lastCleanup");
            
            return String.format("Dernier nettoyage: %s | Cache: %d | Blacklist: %d", 
                lastCleanup, 
                stats.get("cacheSize"), 
                stats.get("blacklistSize"));
                
        } catch (Exception e) {
            logger.error("Erreur lors de la récupération des informations de nettoyage: {}", e.getMessage());
            return "Erreur lors de la récupération des informations";
        }
    }
    
    /**
     * Convertit un objet en Long de manière sûre
     */
    private long convertToLong(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            logger.warn("Impossible de convertir {} en Long, utilisation de 0", value);
            return 0L;
        }
    }
}
