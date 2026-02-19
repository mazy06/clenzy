package com.clenzy.service;

import com.clenzy.dto.KeycloakUserDto;
import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.UpdateUserDto;
import com.clenzy.exception.UserNotFoundException;
import com.clenzy.exception.KeycloakOperationException;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
public class KeycloakService {

    private static final Logger logger = LoggerFactory.getLogger(KeycloakService.class);

    @Autowired(required = false)
    private Keycloak keycloak;

    @Value("${keycloak.realm:clenzy}")
    private String realm;

    /**
     * Exécuter une opération Keycloak avec retry automatique en cas de 401 (token expiré).
     * Lors du retry, on force le renouvellement du token via keycloak.tokenManager().grantToken().
     */
    private <T> T withTokenRetry(Supplier<T> operation, String operationName) {
        try {
            return operation.get();
        } catch (NotAuthorizedException e) {
            logger.warn("⚠️ Token Keycloak expiré pour '{}', renouvellement en cours...", operationName);
            try {
                // Forcer le renouvellement du token admin
                keycloak.tokenManager().grantToken();
                logger.info("✅ Token Keycloak renouvelé, retry de '{}'", operationName);
                return operation.get();
            } catch (Exception retryEx) {
                logger.error("❌ Échec du retry pour '{}': {}", operationName, retryEx.getMessage());
                throw retryEx;
            }
        }
    }

    private void withTokenRetryVoid(Runnable operation, String operationName) {
        withTokenRetry(() -> { operation.run(); return null; }, operationName);
    }

    /**
     * Récupérer un utilisateur depuis Keycloak
     */
    public KeycloakUserDto getUser(String externalId) {
        try {
            return withTokenRetry(() -> {
                UserRepresentation user = keycloak.realm(realm)
                    .users()
                    .get(externalId)
                    .toRepresentation();
                return mapToDto(user);
            }, "getUser");
        } catch (Exception e) {
            throw new UserNotFoundException("Utilisateur non trouvé dans Keycloak: " + externalId);
        }
    }

    /**
     * Récupérer tous les utilisateurs depuis Keycloak
     */
    public List<KeycloakUserDto> getAllUsers() {
        try {
            return withTokenRetry(() -> {
                UsersResource usersResource = keycloak.realm(realm).users();
                List<UserRepresentation> users = usersResource.list();
                return users.stream()
                    .map(this::mapToDto)
                    .collect(Collectors.toList());
            }, "getAllUsers");
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de la récupération des utilisateurs: " + e.getMessage());
        }
    }

    /**
     * Créer un nouvel utilisateur dans Keycloak
     */
    public String createUser(CreateUserDto createUserDto) {
        try {
            // Étape 1 : Créer l'utilisateur (avec retry token)
            String userId = withTokenRetry(() -> {
                UserRepresentation user = new UserRepresentation();
                user.setUsername(createUserDto.getEmail());
                user.setEmail(createUserDto.getEmail());
                user.setFirstName(createUserDto.getFirstName());
                user.setLastName(createUserDto.getLastName());
                user.setEnabled(true);
                user.setEmailVerified(false);

                Response response = keycloak.realm(realm)
                    .users()
                    .create(user);

                if (response.getStatus() != 201) {
                    String body = response.readEntity(String.class);
                    logger.error("❌ Keycloak user creation failed: status={}, body={}", response.getStatus(), body);
                    throw new KeycloakOperationException(
                        "Erreur lors de la création de l'utilisateur: HTTP " + response.getStatus() + " - " + body
                    );
                }

                return CreatedResponseUtil.getCreatedId(response);
            }, "createUser");

            logger.info("✅ Utilisateur créé dans Keycloak: {}", userId);

            // Étape 2 : Définir le mot de passe
            withTokenRetryVoid(() -> {
                CredentialRepresentation credential = new CredentialRepresentation();
                credential.setType(CredentialRepresentation.PASSWORD);
                credential.setValue(createUserDto.getPassword());
                credential.setTemporary(false);

                keycloak.realm(realm)
                    .users()
                    .get(userId)
                    .resetPassword(credential);
            }, "setPassword");

            // Étape 3 : Assigner le rôle par défaut
            if (createUserDto.getRole() != null) {
                assignRoleToUser(userId, createUserDto.getRole());
            }

            return userId;
        } catch (KeycloakOperationException e) {
            throw e;
        } catch (Exception e) {
            logger.error("❌ Erreur inattendue lors de la création de l'utilisateur: {}", e.getMessage(), e);
            throw new KeycloakOperationException("Erreur lors de la création de l'utilisateur: " + e.getMessage());
        }
    }

    /**
     * Mettre à jour un utilisateur dans Keycloak
     */
    public void updateUser(String externalId, UpdateUserDto updateUserDto) {
        try {
            withTokenRetryVoid(() -> {
                UserResource userResource = keycloak.realm(realm).users().get(externalId);
                UserRepresentation user = userResource.toRepresentation();

                if (updateUserDto.getFirstName() != null) {
                    user.setFirstName(updateUserDto.getFirstName());
                }
                if (updateUserDto.getLastName() != null) {
                    user.setLastName(updateUserDto.getLastName());
                }
                if (updateUserDto.getEmail() != null) {
                    user.setEmail(updateUserDto.getEmail());
                    user.setUsername(updateUserDto.getEmail());
                }

                userResource.update(user);
            }, "updateUser");

            // Mettre à jour le rôle si nécessaire
            if (updateUserDto.getRole() != null) {
                updateUserRole(externalId, updateUserDto.getRole());
            }
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de la mise à jour de l'utilisateur: " + e.getMessage());
        }
    }

    /**
     * Supprimer un utilisateur de Keycloak
     */
    public void deleteUser(String externalId) {
        try {
            withTokenRetryVoid(() -> {
                keycloak.realm(realm)
                    .users()
                    .delete(externalId);
            }, "deleteUser");
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de la suppression de l'utilisateur: " + e.getMessage());
        }
    }

    /**
     * Réinitialiser le mot de passe d'un utilisateur
     */
    public void resetPassword(String externalId, String newPassword) {
        try {
            withTokenRetryVoid(() -> {
                CredentialRepresentation credential = new CredentialRepresentation();
                credential.setType(CredentialRepresentation.PASSWORD);
                credential.setValue(newPassword);
                credential.setTemporary(false);

                keycloak.realm(realm)
                    .users()
                    .get(externalId)
                    .resetPassword(credential);
            }, "resetPassword");
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de la réinitialisation du mot de passe: " + e.getMessage());
        }
    }

    /**
     * Assigner un rôle à un utilisateur
     */
    public void assignRoleToUser(String externalId, String roleName) {
        try {
            withTokenRetryVoid(() -> {
                RoleRepresentation role = keycloak.realm(realm)
                    .roles()
                    .get(roleName)
                    .toRepresentation();

                keycloak.realm(realm)
                    .users()
                    .get(externalId)
                    .roles()
                    .realmLevel()
                    .add(List.of(role));
            }, "assignRoleToUser");
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de l'assignation du rôle: " + e.getMessage());
        }
    }

    /**
     * Mettre à jour le rôle d'un utilisateur
     */
    public void updateUserRole(String externalId, String newRole) {
        try {
            withTokenRetryVoid(() -> {
                List<RoleRepresentation> currentRoles = keycloak.realm(realm)
                    .users()
                    .get(externalId)
                    .roles()
                    .realmLevel()
                    .listAll();

                if (!currentRoles.isEmpty()) {
                    keycloak.realm(realm)
                        .users()
                        .get(externalId)
                        .roles()
                        .realmLevel()
                        .remove(currentRoles);
                }
            }, "removeOldRoles");

            assignRoleToUser(externalId, newRole);
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de la mise à jour du rôle: " + e.getMessage());
        }
    }

    /**
     * Vérifier si un utilisateur existe dans Keycloak
     */
    public boolean userExists(String externalId) {
        try {
            return withTokenRetry(() -> {
                keycloak.realm(realm)
                    .users()
                    .get(externalId)
                    .toRepresentation();
                return true;
            }, "userExists");
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Mapper UserRepresentation vers KeycloakUserDto
     */
    private KeycloakUserDto mapToDto(UserRepresentation user) {
        KeycloakUserDto dto = new KeycloakUserDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setEnabled(user.isEnabled());
        dto.setEmailVerified(user.isEmailVerified());
        
        // Convertir le timestamp Long en LocalDateTime
        if (user.getCreatedTimestamp() != null) {
            LocalDateTime createdDateTime = LocalDateTime.ofInstant(
                Instant.ofEpochMilli(user.getCreatedTimestamp()), 
                ZoneId.systemDefault()
            );
            dto.setCreatedTimestamp(createdDateTime);
        }
        
        return dto;
    }
}
