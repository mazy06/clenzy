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
     * Synchronise un utilisateur de la base métier vers Keycloak
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
        UserRepresentation keycloakUser = new UserRepresentation();
        keycloakUser.setUsername(user.getEmail()); // Utiliser l'email comme username
        keycloakUser.setEmail(user.getEmail());
        keycloakUser.setFirstName(user.getFirstName());
        keycloakUser.setLastName(user.getLastName());
        keycloakUser.setEnabled(true);
        keycloakUser.setEmailVerified(user.isEmailVerified());
        
        // Créer l'utilisateur
        jakarta.ws.rs.core.Response response = keycloak.realm(realm).users().create(keycloakUser);
        String userId = getCreatedUserId(response);
        
        // TODO: Implémenter la gestion des mots de passe et rôles
        // Définir le mot de passe temporaire
        // CredentialRepresentation credential = new CredentialRepresentation();
        // credential.setType(CredentialRepresentation.PASSWORD);
        // credential.setValue("tempPassword123");
        // credential.setTemporary(true);
        // keycloak.realm(realm).users().get(userId).resetPassword(credential);
        
        // TODO: Assigner le rôle approprié
        // assignRoleToUser(keycloak, userId, user.getRole());
        
        return userId;
    }

    /**
     * Met à jour un utilisateur dans Keycloak
     */
    private void updateKeycloakUser(Keycloak keycloak, User user) {
        UserRepresentation keycloakUser = keycloak.realm(realm).users().get(user.getKeycloakId()).toRepresentation();
        keycloakUser.setUsername(user.getEmail()); // Utiliser l'email comme username
        keycloakUser.setEmail(user.getEmail());
        keycloakUser.setFirstName(user.getFirstName());
        keycloakUser.setLastName(user.getLastName());
        keycloakUser.setEmailVerified(user.isEmailVerified());
        
        keycloak.realm(realm).users().get(user.getKeycloakId()).update(keycloakUser);
        
        // Mettre à jour le rôle si nécessaire
        assignRoleToUser(keycloak, user.getKeycloakId(), user.getRole());
    }

    /**
     * Assigne un rôle à un utilisateur dans Keycloak
     */
    private void assignRoleToUser(Keycloak keycloak, String userId, UserRole role) {
        // Logique pour assigner le rôle approprié dans Keycloak
        // Cette méthode devra être adaptée selon votre configuration Keycloak
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
