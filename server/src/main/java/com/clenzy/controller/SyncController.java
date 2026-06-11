package com.clenzy.controller;

import com.clenzy.service.UserKeycloakSyncService;
import com.clenzy.service.UserKeycloakSyncService.ForceSyncResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/sync")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SyncController {

    private static final Logger log = LoggerFactory.getLogger(SyncController.class);

    private final UserKeycloakSyncService userKeycloakSyncService;

    public SyncController(UserKeycloakSyncService userKeycloakSyncService) {
        this.userKeycloakSyncService = userKeycloakSyncService;
    }

    /**
     * Synchronisation forcée de tous les utilisateurs depuis la base de données vers Keycloak
     */
    @PostMapping("/force-sync-all-to-keycloak")
    public ResponseEntity<Map<String, Object>> forceSyncAllToKeycloak() {
        try {
            ForceSyncResult result = userKeycloakSyncService.forceSyncAllUsersToKeycloak();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Synchronisation terminée");
            response.put("totalDbUsers", result.totalDbUsers());
            response.put("created", result.created());
            response.put("updated", result.updated());
            response.put("errors", result.errors());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("SyncController - Erreur lors de la synchronisation: {}", e.getMessage(), e);

            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de la synchronisation: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * Synchroniser un utilisateur spécifique
     */
    @PostMapping("/sync-user/{keycloakId}")
    public ResponseEntity<Map<String, Object>> syncUser(@PathVariable String keycloakId) {
        try {
            String action = userKeycloakSyncService.syncUserFromKeycloak(keycloakId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", UserKeycloakSyncService.ACTION_CREATED.equals(action)
                    ? "Utilisateur créé avec succès"
                    : "Utilisateur mis à jour avec succès");
            response.put("action", action);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("SyncController - Erreur lors de la synchronisation de l'utilisateur {}: {}", keycloakId, e.getMessage());

            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de la synchronisation: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }
}
