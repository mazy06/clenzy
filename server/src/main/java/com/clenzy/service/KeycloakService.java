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
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

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

    /**
     * Client admin Keycloak, optionnel (peut etre absent dans certains
     * contextes de test). Injection par constructeur via ObjectProvider
     * (T-ARCH-10) : equivalent de l'ancien @Autowired(required = false)
     * sur champ, mais final et visible dans la signature.
     */
    private final Keycloak keycloak;
    private final String realm;

    public KeycloakService(ObjectProvider<Keycloak> keycloakProvider,
                           @Value("${keycloak.realm:clenzy}") String realm) {
        this.keycloak = keycloakProvider.getIfAvailable();
        this.realm = realm;
    }

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
    @CircuitBreaker(name = "keycloak-admin")
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
    @CircuitBreaker(name = "keycloak-admin")
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
    @CircuitBreaker(name = "keycloak-admin")
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

            // Les étapes suivantes sont compensées : sans cela, un échec après
            // l'étape 1 laisse un compte Keycloak ORPHELIN qui garde l'adresse
            // et fait échouer toutes les tentatives suivantes — sans que rien
            // ne dise pourquoi.
            try {
                // Étape 2 : Définir le mot de passe, S'IL Y EN A UN.
                //
                // Un mot de passe absent est un cas légitime : certains parcours
                // créent le compte et laissent Keycloak inviter la personne à
                // en choisir un. Envoyer une valeur nulle ici faisait répondre
                // 400 à Keycloak, après création — d'où l'orphelin.
                if (createUserDto.getPassword() != null && !createUserDto.getPassword().isBlank()) {
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
                } else {
                    logger.info("Compte {} créé sans mot de passe : il sera défini par la personne", userId);
                }

                // Étape 3 : Assigner le rôle par défaut
                if (createUserDto.getRole() != null) {
                    assignRoleToUser(userId, createUserDto.getRole());
                }
            } catch (RuntimeException e) {
                logger.error("❌ Compte {} incomplet, retrait pour ne pas bloquer l'adresse", userId, e);
                try {
                    keycloak.realm(realm).users().get(userId).remove();
                } catch (Exception cleanup) {
                    logger.error("❌ Compte Keycloak {} orphelin — à supprimer à la main : {}",
                        userId, cleanup.getMessage());
                }
                throw e;
            }

            return userId;
        } catch (KeycloakOperationException e) {
            throw e;
        } catch (Exception e) {
            logger.error("❌ Erreur inattendue lors de la création de l'utilisateur: {}", e.getMessage(), e);
            throw new KeycloakOperationException("Erreur lors de la création de l'utilisateur: " + e.getMessage());
        }
    }

    /** Attribut réservé au provisionnement serveur ; à autoriser uniquement au contexte administrateur. */
    private static final String MARKETPLACE_OPERATION = "baitly_marketplace_operation";

    /** Création reprenable : ne reprend que le compte portant la preuve de cette opération serveur. */
    @CircuitBreaker(name = "keycloak-admin")
    public String createMarketplaceUser(CreateUserDto request, String operationKey) {
        // La clé est générée en base, jamais choisie par un candidat ou un appelant HTTP.
        java.util.UUID.fromString(operationKey);
        if (request.getPassword() != null) {
            throw new IllegalArgumentException("Le provisionnement marketplace ne définit pas de mot de passe");
        }
        String existing = findMarketplaceIdentity(request.getEmail(), operationKey);
        String id = existing;
        if (id == null) {
            UserRepresentation user = new UserRepresentation();
            user.setUsername(request.getEmail());
            user.setEmail(request.getEmail());
            user.setFirstName(request.getFirstName());
            user.setLastName(request.getLastName());
            user.setEnabled(true);
            user.setEmailVerified(false);
            user.setAttributes(java.util.Map.of(MARKETPLACE_OPERATION, List.of(operationKey)));
            id = withTokenRetry(() -> {
                try (Response response = keycloak.realm(realm).users().create(user)) {
                    if (response.getStatus() == 201) return CreatedResponseUtil.getCreatedId(response);
                    if (response.getStatus() == 409) {
                        String recovered = findMarketplaceIdentity(request.getEmail(), operationKey);
                        if (recovered != null) return recovered;
                    }
                    throw new KeycloakOperationException("Création marketplace non confirmée : HTTP " + response.getStatus());
                }
            }, "createMarketplaceUser");
            String createdId = id;
            var persisted = withTokenRetry(() -> keycloak.realm(realm).users().get(createdId).toRepresentation(),
                    "verifyMarketplaceIdentity");
            if (persisted == null || !createdId.equals(persisted.getId())
                    || !matchesMarketplaceIdentity(persisted, request.getEmail(), operationKey)) {
                throw new KeycloakOperationException("Keycloak n'a pas conservé la preuve de provisionnement ; vérifier le profil utilisateur");
            }
        }
        // Cette étape est idempotente. En cas d'échec, conserver la preuve pour la prochaine reprise.
        if (request.getRole() != null) assignRoleToUser(id, request.getRole());
        return id;
    }

    private String findMarketplaceIdentity(String email, String operationKey) {
        List<UserRepresentation> matches = withTokenRetry(
                () -> keycloak.realm(realm).users().searchByEmail(email, true), "findMarketplaceIdentity");
        if (matches == null) throw new KeycloakOperationException("Recherche d'identité indisponible");
        if (matches.isEmpty()) return null;
        if (matches.size() == 1) {
            UserRepresentation match = matches.get(0);
            if (matchesMarketplaceIdentity(match, email, operationKey)) {
                return match.getId();
            }
        }
        throw new KeycloakOperationException("Un compte existe sans preuve de ce provisionnement ; réconciliation requise");
    }

    /** Vérifie une session propriétaire contre l'identité distante actuelle, sans rapprochement par email seul. */
    public void verifyMarketplaceAccountOwner(String subject, String email) {
        var user = withTokenRetry(() -> keycloak.realm(realm).users().get(subject).toRepresentation(),
            "verifyMarketplaceAccountOwner");
        var matches = withTokenRetry(() -> keycloak.realm(realm).users().searchByEmail(email, true),
            "verifyMarketplaceAccountUniqueness");
        if (user == null || !subject.equals(user.getId()) || !Boolean.TRUE.equals(user.isEnabled())
            || !Boolean.TRUE.equals(user.isEmailVerified()) || !email.equalsIgnoreCase(user.getEmail())
            || matches == null || matches.size() != 1 || !subject.equals(matches.getFirst().getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Identité du prestataire non confirmée");
        }
    }

    private boolean matchesMarketplaceIdentity(UserRepresentation user, String email, String operationKey) {
        var attributes = user.getAttributes();
        return user.getId() != null && email.equalsIgnoreCase(user.getEmail())
                && email.equalsIgnoreCase(user.getUsername()) && Boolean.TRUE.equals(user.isEnabled())
                && attributes != null && List.of(operationKey).equals(attributes.get(MARKETPLACE_OPERATION));
    }

    /** Mettre à jour un utilisateur dans Keycloak. */
    @CircuitBreaker(name = "keycloak-admin")
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
    @CircuitBreaker(name = "keycloak-admin")
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
    @CircuitBreaker(name = "keycloak-admin")
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
     * Envoyer l'email Keycloak de réinitialisation de mot de passe (action token
     * UPDATE_PASSWORD, via le SMTP configuré sur le realm) à l'utilisateur
     * correspondant à cet email.
     *
     * @return true si un utilisateur a été trouvé et l'email envoyé, false sinon
     *         (l'appelant reste silencieux pour ne pas révéler l'existence du compte)
     */
    @CircuitBreaker(name = "keycloak-admin")
    public boolean sendPasswordResetEmail(String email) {
        List<UserRepresentation> users = withTokenRetry(() ->
            keycloak.realm(realm).users().searchByEmail(email, true), "searchByEmail");
        if (users == null || users.isEmpty()) {
            return false;
        }
        String userId = users.get(0).getId();
        withTokenRetryVoid(() ->
            keycloak.realm(realm)
                .users()
                .get(userId)
                .executeActionsEmail(List.of("UPDATE_PASSWORD")), "sendPasswordResetEmail");
        return true;
    }

    /**
     * Envoyer l'email de réinitialisation de mot de passe à un utilisateur
     * identifié par son id Keycloak (cas utilisateur connecté, Paramètres).
     */
    @CircuitBreaker(name = "keycloak-admin")
    public void sendPasswordResetEmailByKeycloakId(String externalId) {
        try {
            withTokenRetryVoid(() ->
                keycloak.realm(realm)
                    .users()
                    .get(externalId)
                    .executeActionsEmail(List.of("UPDATE_PASSWORD")), "sendPasswordResetEmailByKeycloakId");
        } catch (Exception e) {
            throw new KeycloakOperationException("Erreur lors de l'envoi de l'email de réinitialisation: " + e.getMessage());
        }
    }

    /**
     * Assigner un rôle à un utilisateur
     */
    @CircuitBreaker(name = "keycloak-admin")
    public void assignRoleToUser(String externalId, String roleName) {
        try {
            withTokenRetryVoid(() -> {
                // Le role est resolu par la LISTE, et non par
                // `roles().get(nom).toRepresentation()`.
                //
                // Pourquoi : sur le Keycloak 24.0.5 de l'environnement,
                // `GET /admin/realms/{realm}/roles/{nom}` repond 404 pour TOUS
                // les roles — y compris ceux que `GET .../roles` renvoie juste
                // apres. L'assignation echouait donc systematiquement, quel que
                // soit le parcours. `roles().list()` et `roles-by-id` repondent,
                // eux, correctement.
                RoleRepresentation role = keycloak.realm(realm)
                    .roles()
                    .list()
                    .stream()
                    .filter(r -> roleName.equals(r.getName()))
                    .findFirst()
                    .orElseThrow(() -> new KeycloakOperationException(
                        "Role introuvable dans le realm : " + roleName));

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
    @CircuitBreaker(name = "keycloak-admin")
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
    @CircuitBreaker(name = "keycloak-admin")
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
