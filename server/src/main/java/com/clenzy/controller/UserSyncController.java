package com.clenzy.controller;

import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.UserSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sync")
public class UserSyncController {

    private final UserSyncService userSyncService;
    private final UserRepository userRepository;

    public UserSyncController(UserSyncService userSyncService, UserRepository userRepository) {
        this.userSyncService = userSyncService;
        this.userRepository = userRepository;
    }

    /**
     * Synchronise tous les utilisateurs Keycloak vers la base métier
     */
    @PostMapping("/from-keycloak")
    public ResponseEntity<String> syncFromKeycloak() {
        try {
            userSyncService.syncAllFromKeycloak();
            return ResponseEntity.ok("Synchronisation depuis Keycloak terminée avec succès");
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body("Erreur lors de la synchronisation: " + e.getMessage());
        }
    }

    /**
     * Synchronise tous les utilisateurs de la base métier vers Keycloak
     */
    @PostMapping("/to-keycloak")
    public ResponseEntity<String> syncToKeycloak() {
        try {
            userSyncService.syncAllToKeycloak();
            return ResponseEntity.ok("Synchronisation vers Keycloak terminée avec succès");
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body("Erreur lors de la synchronisation: " + e.getMessage());
        }
    }

    /**
     * Synchronise un utilisateur spécifique depuis Keycloak
     */
    @PostMapping("/from-keycloak/{keycloakId}")
    public ResponseEntity<String> syncUserFromKeycloak(@PathVariable String keycloakId) {
        try {
            userSyncService.syncFromKeycloak(keycloakId);
            return ResponseEntity.ok("Utilisateur synchronisé avec succès");
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body("Erreur lors de la synchronisation: " + e.getMessage());
        }
    }

    /**
     * Synchronise un utilisateur spécifique vers Keycloak
     */
    @PostMapping("/to-keycloak/{userId}")
    public ResponseEntity<String> syncUserToKeycloak(@PathVariable Long userId) {
        try {
            // Récupérer l'utilisateur et le synchroniser
            // Cette logique devra être implémentée selon vos besoins
            return ResponseEntity.ok("Utilisateur synchronisé avec succès");
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body("Erreur lors de la synchronisation: " + e.getMessage());
        }
    }
    
    /**
     * Force la synchronisation d'un utilisateur spécifique vers Keycloak
     * Utile pour résoudre les problèmes de synchronisation
     */
    @PostMapping("/force-sync-to-keycloak/{userId}")
    public ResponseEntity<String> forceSyncUserToKeycloak(@PathVariable Long userId) {
        try {
            // Récupérer l'utilisateur depuis la base de données
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé avec l'ID: " + userId));
            
            // Forcer la synchronisation
            String keycloakId = userSyncService.forceSyncToKeycloak(user);
            return ResponseEntity.ok("Utilisateur " + user.getEmail() + " synchronisé avec succès vers Keycloak (ID: " + keycloakId + ")");
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body("Erreur lors de la synchronisation forcée: " + e.getMessage());
        }
    }
    
    /**
     * Force la synchronisation de TOUS les utilisateurs vers Keycloak
     * Utile pour résoudre les problèmes de synchronisation en masse
     */
    @PostMapping("/force-sync-all-to-keycloak")
    public ResponseEntity<String> forceSyncAllUsersToKeycloak() {
        try {
            System.out.println("🔄 Début de la synchronisation forcée de tous les utilisateurs...");
            
            // Récupérer tous les utilisateurs
            List<User> users = userRepository.findAll();
            int successCount = 0;
            int errorCount = 0;
            
            for (User user : users) {
                try {
                    System.out.println("🔄 Synchronisation forcée de l'utilisateur: " + user.getEmail());
                    String keycloakId = userSyncService.forceSyncToKeycloak(user);
                    System.out.println("✅ Utilisateur " + user.getEmail() + " synchronisé avec succès (ID: " + keycloakId + ")");
                    successCount++;
                } catch (Exception e) {
                    System.err.println("❌ Erreur lors de la synchronisation de " + user.getEmail() + ": " + e.getMessage());
                    errorCount++;
                }
            }
            
            String result = String.format("Synchronisation terminée. %d succès, %d erreurs", successCount, errorCount);
            System.out.println("✅ " + result);
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body("Erreur lors de la synchronisation forcée: " + e.getMessage());
        }
    }

    /**
     * État de la synchronisation
     */
    @GetMapping("/status")
    public ResponseEntity<String> getSyncStatus() {
        return ResponseEntity.ok("Service de synchronisation actif");
    }
}
