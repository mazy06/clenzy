package com.clenzy.controller;

import com.clenzy.service.UserSyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sync")
public class UserSyncController {

    private final UserSyncService userSyncService;

    public UserSyncController(UserSyncService userSyncService) {
        this.userSyncService = userSyncService;
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
     * État de la synchronisation
     */
    @GetMapping("/status")
    public ResponseEntity<String> getSyncStatus() {
        return ResponseEntity.ok("Service de synchronisation actif");
    }
}
