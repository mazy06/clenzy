package com.clenzy.controller;

import com.clenzy.service.KeycloakService;
import com.clenzy.repository.UserRepository;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.access.prepost.PreAuthorize;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sync")
@PreAuthorize("hasRole('ADMIN')")
public class SyncController {

    private static final Logger log = LoggerFactory.getLogger(SyncController.class);

    @Autowired
    private KeycloakService keycloakService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Synchronisation forcée de tous les utilisateurs depuis la base de données vers Keycloak
     */
    @PostMapping("/force-sync-all-to-keycloak")
    public ResponseEntity<Map<String, Object>> forceSyncAllToKeycloak() {
        try {
            log.debug("SyncController - Debut de la synchronisation forcee de tous les utilisateurs...");
            
            // 1. Récupérer tous les utilisateurs depuis la base de données
            List<User> dbUsers = userRepository.findAll();
            log.debug("SyncController - {} utilisateurs trouves dans la base de donnees", dbUsers.size());
            
            // 2. Récupérer tous les utilisateurs Keycloak existants
            List<com.clenzy.dto.KeycloakUserDto> keycloakUsers = keycloakService.getAllUsers();
            log.debug("SyncController - {} utilisateurs trouves dans Keycloak", keycloakUsers.size());
            
            // Créer une map avec email normalisé (lowercase, trim) comme clé
            Map<String, com.clenzy.dto.KeycloakUserDto> keycloakUsersMap = new HashMap<>();
            for (com.clenzy.dto.KeycloakUserDto keycloakUser : keycloakUsers) {
                String normalizedEmail = keycloakUser.getEmail().toLowerCase().trim();
                keycloakUsersMap.put(normalizedEmail, keycloakUser);
                log.debug("SyncController - Utilisateur Keycloak: {}", normalizedEmail);
            }
            
            int createdCount = 0;
            int updatedCount = 0;
            int errorCount = 0;
            
            // 3. Pour chaque utilisateur de la base, créer ou mettre à jour dans Keycloak
            for (User dbUser : dbUsers) {
                try {
                    String normalizedDbEmail = dbUser.getEmail().toLowerCase().trim();
                    log.debug("SyncController - Verification utilisateur DB: {}", normalizedDbEmail);
                    
                    if (keycloakUsersMap.containsKey(normalizedDbEmail)) {
                        // Utilisateur existe dans Keycloak -> mettre à jour
                        com.clenzy.dto.KeycloakUserDto keycloakUser = keycloakUsersMap.get(normalizedDbEmail);
                        log.debug("SyncController - Utilisateur trouve dans Keycloak, mise a jour: {}", dbUser.getEmail());
                        
                        com.clenzy.dto.UpdateUserDto updateUserDto = new com.clenzy.dto.UpdateUserDto();
                        updateUserDto.setEmail(dbUser.getEmail());
                        updateUserDto.setFirstName(dbUser.getFirstName());
                        updateUserDto.setLastName(dbUser.getLastName());
                        updateUserDto.setRole(dbUser.getRole().name());
                        
                        keycloakService.updateUser(keycloakUser.getId(), updateUserDto);
                        
                        // Mettre à jour le KeycloakId dans la base si nécessaire
                        if (dbUser.getKeycloakId() == null || !dbUser.getKeycloakId().equals(keycloakUser.getId())) {
                            dbUser.setKeycloakId(keycloakUser.getId());
                            userRepository.save(dbUser);
                        }
                        
                        updatedCount++;
                        log.debug("SyncController - Utilisateur mis a jour dans Keycloak: {}", dbUser.getEmail());
                    } else {
                        // Utilisateur n'existe pas dans Keycloak -> créer
                        log.debug("SyncController - Utilisateur non trouve dans Keycloak, creation: {}", dbUser.getEmail());
                        
                        com.clenzy.dto.CreateUserDto createUserDto = new com.clenzy.dto.CreateUserDto();
                        createUserDto.setEmail(dbUser.getEmail());
                        createUserDto.setFirstName(dbUser.getFirstName());
                        createUserDto.setLastName(dbUser.getLastName());
                        createUserDto.setPassword("password"); // Mot de passe par défaut
                        createUserDto.setRole(dbUser.getRole().name());
                        
                        String newKeycloakId = keycloakService.createUser(createUserDto);
                        dbUser.setKeycloakId(newKeycloakId);
                        userRepository.save(dbUser);
                        
                        createdCount++;
                        log.debug("SyncController - Utilisateur cree dans Keycloak: {}", dbUser.getEmail());
                    }
                } catch (Exception e) {
                    errorCount++;
                    log.error("SyncController - Erreur pour l'utilisateur {}: {}", dbUser.getEmail(), e.getMessage(), e);
                }
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Synchronisation terminée");
            response.put("totalDbUsers", dbUsers.size());
            response.put("created", createdCount);
            response.put("updated", updatedCount);
            response.put("errors", errorCount);
            
            log.debug("SyncController - Synchronisation terminee: {} crees, {} mis a jour, {} erreurs", createdCount, updatedCount, errorCount);
            
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
     * Déterminer le rôle d'un utilisateur basé sur ses attributs Keycloak
     */
    private UserRole determineRoleFromKeycloak(com.clenzy.dto.KeycloakUserDto keycloakUser) {
        // Par défaut, assigner le rôle HOST
        // Dans un vrai système, on récupérerait les rôles depuis Keycloak
        return UserRole.HOST;
    }

    /**
     * Synchroniser un utilisateur spécifique
     */
    @PostMapping("/sync-user/{keycloakId}")
    public ResponseEntity<Map<String, Object>> syncUser(@PathVariable String keycloakId) {
        try {
            log.debug("SyncController - Synchronisation de l'utilisateur: {}", keycloakId);
            
            // Récupérer l'utilisateur depuis Keycloak
            com.clenzy.dto.KeycloakUserDto keycloakUser = keycloakService.getUser(keycloakId);
            
            // Vérifier si l'utilisateur existe dans la base
            User existingUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
            
            if (existingUser == null) {
                // Créer un nouvel utilisateur
                User newUser = new User();
                newUser.setKeycloakId(keycloakUser.getId());
                newUser.setFirstName(keycloakUser.getFirstName());
                newUser.setLastName(keycloakUser.getLastName());
                newUser.setEmail(keycloakUser.getEmail());
                newUser.setRole(determineRoleFromKeycloak(keycloakUser));
                newUser.setStatus(UserStatus.ACTIVE);
                
                userRepository.save(newUser);
                
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "Utilisateur créé avec succès");
                response.put("action", "created");
                
                return ResponseEntity.ok(response);
            } else {
                // Mettre à jour l'utilisateur existant
                existingUser.setFirstName(keycloakUser.getFirstName());
                existingUser.setLastName(keycloakUser.getLastName());
                existingUser.setEmail(keycloakUser.getEmail());
                
                userRepository.save(existingUser);
                
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "Utilisateur mis à jour avec succès");
                response.put("action", "updated");
                
                return ResponseEntity.ok(response);
            }
            
        } catch (Exception e) {
            log.error("SyncController - Erreur lors de la synchronisation de l'utilisateur {}: {}", keycloakId, e.getMessage());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Erreur lors de la synchronisation: " + e.getMessage());
            
            return ResponseEntity.status(500).body(response);
        }
    }
}
