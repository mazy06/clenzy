package com.clenzy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class StartupSyncService {

    private static final Logger logger = LoggerFactory.getLogger(StartupSyncService.class);
    
    private final UserSyncService userSyncService;

    @Autowired
    public StartupSyncService(UserSyncService userSyncService) {
        this.userSyncService = userSyncService;
    }

    /**
     * Synchronisation automatique au démarrage de l'application
     * Se déclenche une fois que l'application est complètement démarrée
     */
    @EventListener(ApplicationReadyEvent.class)
    @Async
    public void onApplicationReady() {
        logger.info("🚀 Application démarrée - Début de la synchronisation automatique Keycloak");
        
        try {
            // Attendre quelques secondes pour que tous les services soient prêts
            Thread.sleep(5000);
            
            // Nettoyer les utilisateurs orphelins d'abord
            logger.info("🧹 Nettoyage des utilisateurs orphelins...");
            userSyncService.cleanupOrphanedUsers();
            logger.info("✅ Nettoyage des utilisateurs orphelins terminé");
            
            // Synchroniser depuis Keycloak vers la base métier
            logger.info("🔄 Synchronisation automatique depuis Keycloak...");
            userSyncService.syncAllFromKeycloak();
            logger.info("✅ Synchronisation automatique depuis Keycloak terminée avec succès");
            
            // Synchroniser les utilisateurs de la base métier vers Keycloak (ceux qui n'ont pas de keycloak_id)
            logger.info("🔄 Synchronisation automatique vers Keycloak...");
            userSyncService.syncAllToKeycloak();
            logger.info("✅ Synchronisation automatique vers Keycloak terminée avec succès");
            
        } catch (Exception e) {
            logger.error("❌ Erreur lors de la synchronisation automatique: {}", e.getMessage(), e);
            // Ne pas faire échouer le démarrage de l'application
        }
    }
}
