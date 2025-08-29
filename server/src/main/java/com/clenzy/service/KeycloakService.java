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

import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class KeycloakService {

    @Autowired(required = false)
    private Keycloak keycloak;

    @Value("${keycloak.realm:clenzy}")
    private String realm;

    /**
     * Récupérer un utilisateur depuis Keycloak
     */
    public KeycloakUserDto getUser(String externalId) {
        try {
            UserRepresentation user = keycloak.realm(realm)
                .users()
                .get(externalId)
                .toRepresentation();

            return mapToDto(user);
        } catch (Exception e) {
            throw new UserNotFoundException("Utilisateur non trouvé dans Keycloak: " + externalId);
        }
    }

    /**
     * Récupérer tous les utilisateurs depuis Keycloak
     */
    public List<KeycloakUserDto> getAllUsers() {
        try {
            UsersResource usersResource = keycloak.realm(realm).users();
            List<UserRepresentation> users = usersResource.list();
            
            return users.stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de la récupération des utilisateurs: " + e.getMessage());
        }
    }

    /**
     * Créer un nouvel utilisateur dans Keycloak
     */
    public String createUser(CreateUserDto createUserDto) {
        try {
            UserRepresentation user = new UserRepresentation();
            user.setUsername(createUserDto.getEmail());
            user.setEmail(createUserDto.getEmail());
            user.setFirstName(createUserDto.getFirstName());
            user.setLastName(createUserDto.getLastName());
            user.setEnabled(true);
            user.setEmailVerified(false);

            // Créer l'utilisateur
            Response response = keycloak.realm(realm)
                .users()
                .create(user);

            if (response.getStatus() != 201) {
                throw new KeycloakOperationException("Erreur lors de la création de l'utilisateur: " + response.getStatus());
            }

            String userId = CreatedResponseUtil.getCreatedId(response);

            // Définir le mot de passe
            CredentialRepresentation credential = new CredentialRepresentation();
            credential.setType(CredentialRepresentation.PASSWORD);
            credential.setValue(createUserDto.getPassword());
            credential.setTemporary(false);

            keycloak.realm(realm)
                .users()
                .get(userId)
                .resetPassword(credential);

            // Assigner le rôle par défaut
            if (createUserDto.getRole() != null) {
                assignRoleToUser(userId, createUserDto.getRole());
            }

            return userId;
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de la création de l'utilisateur: " + e.getMessage());
        }
    }

    /**
     * Mettre à jour un utilisateur dans Keycloak
     */
    public void updateUser(String externalId, UpdateUserDto updateUserDto) {
        try {
            UserResource userResource = keycloak.realm(realm).users().get(externalId);
            UserRepresentation user = userResource.toRepresentation();

            // Mettre à jour les champs modifiés
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
            keycloak.realm(realm)
                .users()
                .delete(externalId);
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de la suppression de l'utilisateur: " + e.getMessage());
        }
    }

    /**
     * Réinitialiser le mot de passe d'un utilisateur
     */
    public void resetPassword(String externalId, String newPassword) {
        try {
            CredentialRepresentation credential = new CredentialRepresentation();
            credential.setType(CredentialRepresentation.PASSWORD);
            credential.setValue(newPassword);
            credential.setTemporary(false);

            keycloak.realm(realm)
                .users()
                .get(externalId)
                .resetPassword(credential);
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de la réinitialisation du mot de passe: " + e.getMessage());
        }
    }

    /**
     * Assigner un rôle à un utilisateur
     */
    public void assignRoleToUser(String externalId, String roleName) {
        try {
            // Récupérer le rôle
            RoleRepresentation role = keycloak.realm(realm)
                .roles()
                .get(roleName)
                .toRepresentation();

            // Assigner le rôle à l'utilisateur
            keycloak.realm(realm)
                .users()
                .get(externalId)
                .roles()
                .realmLevel()
                .add(List.of(role));
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de l'assignation du rôle: " + e.getMessage());
        }
    }

    /**
     * Mettre à jour le rôle d'un utilisateur
     */
    public void updateUserRole(String externalId, String newRole) {
        try {
            // Récupérer tous les rôles actuels
            List<RoleRepresentation> currentRoles = keycloak.realm(realm)
                .users()
                .get(externalId)
                .roles()
                .realmLevel()
                .listAll();

            // Supprimer tous les rôles actuels
            if (!currentRoles.isEmpty()) {
                keycloak.realm(realm)
                    .users()
                    .get(externalId)
                    .roles()
                    .realmLevel()
                    .remove(currentRoles);
            }

            // Assigner le nouveau rôle
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
            keycloak.realm(realm)
                .users()
                .get(externalId)
                .toRepresentation();
            return true;
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
