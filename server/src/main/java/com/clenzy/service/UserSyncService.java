package com.clenzy.service;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.UserRepository;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.keycloak.representations.idm.UserRepresentation;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class UserSyncService {

    @Value("${keycloak.auth-server-url}")
    private String keycloakUrl;

    @Value("${keycloak.realm}")
    private String realm;

    @Value("${keycloak.admin.username}")
    private String adminUsername;

    @Value("${keycloak.admin.password}")
    private String adminPassword;

    @Value("${keycloak.admin.client-id}")
    private String adminClientId;

    private final UserRepository userRepository;

    public UserSyncService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Synchronise un utilisateur Keycloak vers la base métier
     */
    @Transactional
    public User syncFromKeycloak(String keycloakUserId) {
        try (Keycloak keycloak = getKeycloakAdminClient()) {
            UserRepresentation keycloakUser = keycloak.realm(realm).users().get(keycloakUserId).toRepresentation();
            
            // Vérifier si l'utilisateur existe déjà dans la base métier
            Optional<User> existingUser = userRepository.findByKeycloakId(keycloakUserId);
            
            if (existingUser.isPresent()) {
                // Mettre à jour l'utilisateur existant
                User user = existingUser.get();
                updateUserFromKeycloak(user, keycloakUser);
                return userRepository.save(user);
            } else {
                // Créer un nouvel utilisateur
                User newUser = createUserFromKeycloak(keycloakUser);
                return userRepository.save(newUser);
            }
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la synchronisation depuis Keycloak: " + e.getMessage(), e);
        }
    }


    
    /**
     * Force la synchronisation d'un utilisateur vers Keycloak (même s'il a déjà un keycloakId)
     * Utile pour résoudre les problèmes de synchronisation
     */
    @Transactional
    public String forceSyncToKeycloak(User user) {
        try (Keycloak keycloak = getKeycloakAdminClient()) {
            // Pour forcer la synchronisation, on supprime toujours l'ancien keycloak_id
            // et on recrée l'utilisateur pour s'assurer que tout est correct
            if (user.getKeycloakId() != null) {
                try {
                    // Supprimer l'ancien utilisateur Keycloak
                    System.out.println("🗑️ Suppression de l'ancien utilisateur Keycloak: " + user.getEmail());
                    keycloak.realm(realm).users().delete(user.getKeycloakId());
                    System.out.println("✅ Ancien utilisateur Keycloak supprimé");
                } catch (Exception e) {
                    System.out.println("⚠️ Impossible de supprimer l'ancien utilisateur Keycloak: " + e.getMessage());
                }
                // Réinitialiser le keycloak_id
                user.setKeycloakId(null);
            }
            
            // Créer un nouvel utilisateur dans Keycloak
            System.out.println("🔄 Recréation de l'utilisateur dans Keycloak: " + user.getEmail());
            String keycloakUserId = createKeycloakUser(keycloak, user);
            user.setKeycloakId(keycloakUserId);
            userRepository.save(user);
            System.out.println("✅ Utilisateur recréé avec succès dans Keycloak: " + user.getEmail());
            return keycloakUserId;
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la synchronisation forcée vers Keycloak: " + e.getMessage(), e);
        }
    }
    
    /**
     * Synchronise un utilisateur de la base métier vers Keycloak avec gestion robuste du mot de passe
     */
    @Transactional
    public String syncToKeycloak(User user) {
        try (Keycloak keycloak = getKeycloakAdminClient()) {
            // Vérifier si l'utilisateur existe déjà dans Keycloak
            if (user.getKeycloakId() != null) {
                // Mettre à jour l'utilisateur existant
                updateKeycloakUser(keycloak, user);
                return user.getKeycloakId();
            } else {
                // Créer un nouvel utilisateur dans Keycloak
                String keycloakUserId = createKeycloakUser(keycloak, user);
                user.setKeycloakId(keycloakUserId);
                userRepository.save(user);
                return keycloakUserId;
            }
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la synchronisation vers Keycloak: " + e.getMessage(), e);
        }
    }
    
    /**
     * Nettoie les utilisateurs orphelins (ceux qui ont un keycloak_id mais n'existent plus dans Keycloak)
     * Cette méthode est appelée automatiquement au démarrage
     */
    @Transactional
    public void cleanupOrphanedUsers() {
        System.out.println("🧹 Nettoyage des utilisateurs orphelins...");
        List<User> usersWithKeycloakId = userRepository.findByKeycloakIdIsNotNull();
        int cleanedCount = 0;
        
        try (Keycloak keycloak = getKeycloakAdminClient()) {
            for (User user : usersWithKeycloakId) {
                try {
                    // Vérifier si l'utilisateur existe dans Keycloak
                    keycloak.realm(realm).users().get(user.getKeycloakId()).toRepresentation();
                } catch (Exception e) {
                    // L'utilisateur n'existe plus dans Keycloak, nettoyer le keycloak_id
                    System.out.println("🧹 Nettoyage de l'utilisateur orphelin: " + user.getEmail());
                    user.setKeycloakId(null);
                    userRepository.save(user);
                    cleanedCount++;
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️ Erreur lors du nettoyage des utilisateurs orphelins: " + e.getMessage());
        }
        
        System.out.println("✅ Nettoyage terminé. " + cleanedCount + " utilisateur(s) orphelin(s) nettoyé(s)");
    }

    /**
     * Synchronise tous les utilisateurs Keycloak vers la base métier
     */
    @Transactional
    public void syncAllFromKeycloak() {
        try (Keycloak keycloak = getKeycloakAdminClient()) {
            List<UserRepresentation> keycloakUsers = keycloak.realm(realm).users().list();
            
            for (UserRepresentation keycloakUser : keycloakUsers) {
                try {
                    syncFromKeycloak(keycloakUser.getId());
                } catch (Exception e) {
                    // Logger l'erreur mais continuer avec les autres utilisateurs
                    System.err.println("Erreur lors de la synchronisation de l'utilisateur " + 
                                    keycloakUser.getUsername() + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la synchronisation complète: " + e.getMessage(), e);
        }
    }

    /**
     * Synchronise tous les utilisateurs de la base métier vers Keycloak
     */
    @Transactional
    public void syncAllToKeycloak() {
        List<User> users = userRepository.findAll();
        
        for (User user : users) {
            try {
                syncToKeycloak(user);
            } catch (Exception e) {
                // Logger l'erreur mais continuer avec les autres utilisateurs
                System.err.println("Erreur lors de la synchronisation de l'utilisateur " + 
                                user.getEmail() + ": " + e.getMessage());
            }
        }
    }

    /**
     * Crée un utilisateur dans la base métier à partir d'un utilisateur Keycloak
     */
    private User createUserFromKeycloak(UserRepresentation keycloakUser) {
        User user = new User();
        user.setKeycloakId(keycloakUser.getId());
        user.setEmail(keycloakUser.getEmail());
        user.setFirstName(keycloakUser.getFirstName() != null ? keycloakUser.getFirstName() : "");
        user.setLastName(keycloakUser.getLastName() != null ? keycloakUser.getLastName() : "");
        
        // Définir un mot de passe temporaire pour satisfaire la contrainte de validation
        user.setPassword("tempPassword123_" + System.currentTimeMillis());
        
        // Détecter le rôle depuis Keycloak
        UserRole detectedRole = detectUserRoleFromKeycloak(keycloakUser);
        user.setRole(detectedRole);
        
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerified(keycloakUser.isEmailVerified());
        
        return user;
    }

    /**
     * Détecte le rôle de l'utilisateur depuis Keycloak
     */
    private UserRole detectUserRoleFromKeycloak(UserRepresentation keycloakUser) {
        // Vérifier si c'est l'admin principal
        if ("admin@clenzy.fr".equals(keycloakUser.getEmail())) {
            return UserRole.ADMIN;
        }
        
        // Vérifier les rôles dans les attributs Keycloak
        if (keycloakUser.getAttributes() != null) {
            List<String> roles = keycloakUser.getAttributes().get("roles");
            if (roles != null) {
                for (String role : roles) {
                    if (role.toUpperCase().contains("ADMIN")) {
                        return UserRole.ADMIN;
                    } else if (role.toUpperCase().contains("MANAGER")) {
                        return UserRole.MANAGER;
                    } else if (role.toUpperCase().contains("HOST")) {
                        return UserRole.HOST;
                    } else if (role.toUpperCase().contains("TECHNICIAN")) {
                        return UserRole.TECHNICIAN;
                    } else if (role.toUpperCase().contains("HOUSEKEEPER")) {
                        return UserRole.HOUSEKEEPER;
                    }
                }
            }
        }
        
        // Rôle par défaut
        return UserRole.HOST;
    }

    /**
     * Met à jour un utilisateur existant avec les données Keycloak
     */
    private void updateUserFromKeycloak(User user, UserRepresentation keycloakUser) {
        user.setEmail(keycloakUser.getEmail());
        user.setFirstName(keycloakUser.getFirstName() != null ? keycloakUser.getFirstName() : user.getFirstName());
        user.setLastName(keycloakUser.getLastName() != null ? keycloakUser.getLastName() : user.getLastName());
        user.setEmailVerified(keycloakUser.isEmailVerified());
    }

    /**
     * Crée un utilisateur dans Keycloak
     */
    private String createKeycloakUser(Keycloak keycloak, User user) {
        try {
            UserRepresentation keycloakUser = new UserRepresentation();
            keycloakUser.setUsername(user.getEmail()); // Utiliser l'email comme username
            keycloakUser.setEmail(user.getEmail());
            keycloakUser.setFirstName(user.getFirstName());
            keycloakUser.setLastName(user.getLastName());
            keycloakUser.setEnabled(true);
            keycloakUser.setEmailVerified(user.isEmailVerified());
            
            // Créer l'utilisateur
            System.out.println("🔄 Création de l'utilisateur dans Keycloak: " + user.getEmail());
            jakarta.ws.rs.core.Response response = keycloak.realm(realm).users().create(keycloakUser);
            
            if (response.getStatus() != 201) {
                throw new RuntimeException("Erreur lors de la création de l'utilisateur dans Keycloak. Status: " + response.getStatus());
            }
            
            String userId = getCreatedUserId(response);
            System.out.println("✅ Utilisateur créé dans Keycloak avec l'ID: " + userId);
            
            // Définir le mot de passe
            try {
                CredentialRepresentation credential = new CredentialRepresentation();
                credential.setType(CredentialRepresentation.PASSWORD);
                
                // Récupérer le mot de passe depuis la base de données
                String password = user.getPassword();
                if (password == null || password.trim().isEmpty()) {
                    // Si pas de mot de passe, utiliser un mot de passe par défaut
                    password = "Clenzy2024!";
                    System.out.println("⚠️ Aucun mot de passe défini pour " + user.getEmail() + ", utilisation du mot de passe par défaut");
                }
                
                credential.setValue(password);
                credential.setTemporary(false); // Le mot de passe n'est pas temporaire
                
                keycloak.realm(realm).users().get(userId).resetPassword(credential);
                System.out.println("✅ Mot de passe défini dans Keycloak pour l'utilisateur: " + user.getEmail());
            } catch (Exception e) {
                System.err.println("⚠️ Erreur lors de la définition du mot de passe dans Keycloak: " + e.getMessage());
                throw new RuntimeException("Impossible de définir le mot de passe dans Keycloak", e);
            }
            
            // Assigner le rôle approprié
            try {
                assignRoleToUser(keycloak, userId, user.getRole());
                System.out.println("✅ Rôle assigné dans Keycloak pour l'utilisateur: " + user.getEmail());
            } catch (Exception e) {
                System.err.println("⚠️ Erreur lors de l'assignation du rôle dans Keycloak: " + e.getMessage());
                // Ne pas faire échouer la création si le rôle ne peut pas être assigné
            }
            
            return userId;
            
        } catch (Exception e) {
            System.err.println("❌ Erreur lors de la création de l'utilisateur dans Keycloak: " + e.getMessage());
            throw new RuntimeException("Impossible de créer l'utilisateur dans Keycloak", e);
        }
    }

    /**
     * Met à jour un utilisateur dans Keycloak
     */
    private void updateKeycloakUser(Keycloak keycloak, User user) {
        try {
            UserRepresentation keycloakUser = keycloak.realm(realm).users().get(user.getKeycloakId()).toRepresentation();
            keycloakUser.setUsername(user.getEmail()); // Utiliser l'email comme username
            keycloakUser.setEmail(user.getEmail());
            keycloakUser.setFirstName(user.getFirstName());
            keycloakUser.setLastName(user.getLastName());
            keycloakUser.setEmailVerified(user.isEmailVerified());
            
            keycloak.realm(realm).users().get(user.getKeycloakId()).update(keycloakUser);
            System.out.println("✅ Utilisateur mis à jour dans Keycloak: " + user.getEmail());
            
            // Mettre à jour le rôle si nécessaire
            assignRoleToUser(keycloak, user.getKeycloakId(), user.getRole());
        } catch (Exception e) {
            System.err.println("⚠️ Erreur lors de la mise à jour de l'utilisateur dans Keycloak: " + e.getMessage());
            throw new RuntimeException("Impossible de mettre à jour l'utilisateur dans Keycloak", e);
        }
    }

    /**
     * Met à jour le mot de passe d'un utilisateur dans Keycloak
     */
    public void updatePasswordInKeycloak(String keycloakUserId, String newPassword) {
        try (Keycloak keycloak = getKeycloakAdminClient()) {
            // Créer les credentials pour le nouveau mot de passe
            CredentialRepresentation credential = new CredentialRepresentation();
            credential.setType(CredentialRepresentation.PASSWORD);
            credential.setValue(newPassword);
            credential.setTemporary(false); // Le mot de passe n'est pas temporaire
            
            // Mettre à jour le mot de passe dans Keycloak
            keycloak.realm(realm).users().get(keycloakUserId).resetPassword(credential);
            System.out.println("✅ Mot de passe mis à jour dans Keycloak pour l'utilisateur: " + keycloakUserId);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la mise à jour du mot de passe dans Keycloak: " + e.getMessage(), e);
        }
    }

    /**
     * Assigne un rôle à un utilisateur dans Keycloak
     */
    private void assignRoleToUser(Keycloak keycloak, String userId, UserRole role) {
        try {
            // Récupérer le rôle depuis Keycloak
            String roleName = getKeycloakRoleName(role);
            var keycloakRole = keycloak.realm(realm).roles().get(roleName).toRepresentation();
            
            // Assigner le rôle à l'utilisateur
            keycloak.realm(realm).users().get(userId).roles().realmLevel().add(List.of(keycloakRole));
            
            System.out.println("✅ Rôle '" + roleName + "' assigné à l'utilisateur " + userId);
        } catch (Exception e) {
            System.err.println("⚠️ Erreur lors de l'assignation du rôle '" + role + "': " + e.getMessage());
            throw new RuntimeException("Impossible d'assigner le rôle " + role + " à l'utilisateur", e);
        }
    }
    
    /**
     * Convertit le rôle métier en nom de rôle Keycloak
     */
    private String getKeycloakRoleName(UserRole role) {
        switch (role) {
            case ADMIN:
                return "ADMIN";
            case MANAGER:
                return "MANAGER";
            case SUPERVISOR:
                return "SUPERVISOR";
            case TECHNICIAN:
                return "TECHNICIAN";
            case HOUSEKEEPER:
                return "HOUSEKEEPER";
            case HOST:
                return "HOST";
            default:
                return "HOST"; // Rôle par défaut
        }
    }

    /**
     * Obtient l'ID de l'utilisateur créé depuis la réponse
     */
    private String getCreatedUserId(jakarta.ws.rs.core.Response response) {
        String location = response.getHeaderString("Location");
        return location.substring(location.lastIndexOf('/') + 1);
    }

    /**
     * Obtient le client admin Keycloak
     */
    private Keycloak getKeycloakAdminClient() {
        return KeycloakBuilder.builder()
                .serverUrl(keycloakUrl)
                .realm("master")
                .username(adminUsername)
                .password(adminPassword)
                .clientId(adminClientId)
                .build();
    }
}
