package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class ScheduledSyncService {

    private static final Logger logger = LoggerFactory.getLogger(ScheduledSyncService.class);
    
    private final UserSyncService userSyncService;

    @Autowired
    public ScheduledSyncService(UserSyncService userSyncService) {
        this.userSyncService = userSyncService;
    }

    /**
     * Synchronisation automatique toutes les heures
     * Se déclenche automatiquement sans intervention manuelle
     */
    @Scheduled(fixedRate = 3600000) // 1 heure = 3,600,000 ms
    public void scheduledSyncFromKeycloak() {
        logger.info("⏰ Synchronisation périodique programmée - Début");
        
        try {
            userSyncService.syncAllFromKeycloak();
            logger.info("✅ Synchronisation périodique terminée avec succès");
        } catch (Exception e) {
            logger.error("❌ Erreur lors de la synchronisation périodique: {}", e.getMessage(), e);
        }
    }

    /**
     * Synchronisation automatique tous les jours à 2h00 du matin
     * Moment de faible activité pour éviter l'impact sur les utilisateurs
     */
    @Scheduled(cron = "0 0 2 * * ?") // Tous les jours à 2h00
    public void dailySyncFromKeycloak() {
        logger.info("🌅 Synchronisation quotidienne programmée - Début");
        
        try {
            userSyncService.syncAllFromKeycloak();
            logger.info("✅ Synchronisation quotidienne terminée avec succès");
        } catch (Exception e) {
            logger.error("❌ Erreur lors de la synchronisation quotidienne: {}", e.getMessage(), e);
        }
    }
}
