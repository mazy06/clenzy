package com.clenzy.service;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.KeycloakUserDto;
import com.clenzy.dto.UpdateUserDto;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Synchronisation des comptes utilisateurs entre la base PMS et Keycloak
 * (administration plateforme). Logique deplacee depuis {@code SyncController}
 * (refactor T-ARCH-01 — controller mince).
 *
 * <p>Volontairement SANS {@code @Transactional} englobant : chaque iteration
 * appelle l'API Keycloak (HTTP externe) — jamais d'appel externe dans une
 * transaction DB (regle 2 des lecons d'audit 2026-06). Les saves repository
 * restent transactionnels individuellement, comme avant le refactor.</p>
 */
@Service
public class UserKeycloakSyncService {

    private static final Logger log = LoggerFactory.getLogger(UserKeycloakSyncService.class);

    /** Action appliquee lors de la synchronisation d'un utilisateur unique. */
    public static final String ACTION_CREATED = "created";
    public static final String ACTION_UPDATED = "updated";

    /** Bilan d'une synchronisation forcee DB → Keycloak. */
    public record ForceSyncResult(int totalDbUsers, int created, int updated, int errors) {}

    private final KeycloakService keycloakService;
    private final UserRepository userRepository;

    public UserKeycloakSyncService(KeycloakService keycloakService,
                                   UserRepository userRepository) {
        this.keycloakService = keycloakService;
        this.userRepository = userRepository;
    }

    /**
     * Synchronisation forcee de tous les utilisateurs de la base vers Keycloak :
     * cree les comptes manquants, met a jour les existants (match par email
     * normalise), et realigne le keycloakId en base. Les erreurs par utilisateur
     * sont comptees sans interrompre le batch.
     */
    public ForceSyncResult forceSyncAllUsersToKeycloak() {
        log.debug("UserKeycloakSyncService - Debut de la synchronisation forcee de tous les utilisateurs...");

        List<User> dbUsers = userRepository.findAll();
        log.debug("UserKeycloakSyncService - {} utilisateurs trouves dans la base de donnees", dbUsers.size());

        List<KeycloakUserDto> keycloakUsers = keycloakService.getAllUsers();
        log.debug("UserKeycloakSyncService - {} utilisateurs trouves dans Keycloak", keycloakUsers.size());

        // Map avec email normalise (lowercase, trim) comme cle
        Map<String, KeycloakUserDto> keycloakUsersMap = new HashMap<>();
        for (KeycloakUserDto keycloakUser : keycloakUsers) {
            keycloakUsersMap.put(keycloakUser.getEmail().toLowerCase().trim(), keycloakUser);
        }

        int createdCount = 0;
        int updatedCount = 0;
        int errorCount = 0;

        for (User dbUser : dbUsers) {
            try {
                String normalizedDbEmail = dbUser.getEmail().toLowerCase().trim();

                if (keycloakUsersMap.containsKey(normalizedDbEmail)) {
                    syncExistingKeycloakUser(dbUser, keycloakUsersMap.get(normalizedDbEmail));
                    updatedCount++;
                } else {
                    createKeycloakUser(dbUser);
                    createdCount++;
                }
            } catch (Exception e) {
                errorCount++;
                log.error("UserKeycloakSyncService - Erreur pour l'utilisateur {}: {}",
                        dbUser.getEmail(), e.getMessage(), e);
            }
        }

        log.debug("UserKeycloakSyncService - Synchronisation terminee: {} crees, {} mis a jour, {} erreurs",
                createdCount, updatedCount, errorCount);
        return new ForceSyncResult(dbUsers.size(), createdCount, updatedCount, errorCount);
    }

    /**
     * Synchronise un utilisateur unique depuis Keycloak vers la base : cree
     * l'entite si absente, sinon realigne nom/prenom/email.
     *
     * @return {@link #ACTION_CREATED} ou {@link #ACTION_UPDATED}
     */
    public String syncUserFromKeycloak(String keycloakId) {
        KeycloakUserDto keycloakUser = keycloakService.getUser(keycloakId);
        User existingUser = userRepository.findByKeycloakId(keycloakId).orElse(null);

        if (existingUser == null) {
            User newUser = new User();
            newUser.setKeycloakId(keycloakUser.getId());
            newUser.setFirstName(keycloakUser.getFirstName());
            newUser.setLastName(keycloakUser.getLastName());
            newUser.setEmail(keycloakUser.getEmail());
            newUser.setRole(determineRoleFromKeycloak(keycloakUser));
            newUser.setStatus(UserStatus.ACTIVE);
            userRepository.save(newUser);
            return ACTION_CREATED;
        }

        existingUser.setFirstName(keycloakUser.getFirstName());
        existingUser.setLastName(keycloakUser.getLastName());
        existingUser.setEmail(keycloakUser.getEmail());
        userRepository.save(existingUser);
        return ACTION_UPDATED;
    }

    private void syncExistingKeycloakUser(User dbUser, KeycloakUserDto keycloakUser) {
        UpdateUserDto updateUserDto = new UpdateUserDto();
        updateUserDto.setEmail(dbUser.getEmail());
        updateUserDto.setFirstName(dbUser.getFirstName());
        updateUserDto.setLastName(dbUser.getLastName());
        updateUserDto.setRole(dbUser.getRole().name());

        keycloakService.updateUser(keycloakUser.getId(), updateUserDto);

        // Realigner le keycloakId en base si necessaire
        if (dbUser.getKeycloakId() == null || !dbUser.getKeycloakId().equals(keycloakUser.getId())) {
            dbUser.setKeycloakId(keycloakUser.getId());
            userRepository.save(dbUser);
        }
    }

    private void createKeycloakUser(User dbUser) {
        CreateUserDto createUserDto = new CreateUserDto();
        createUserDto.setEmail(dbUser.getEmail());
        createUserDto.setFirstName(dbUser.getFirstName());
        createUserDto.setLastName(dbUser.getLastName());
        createUserDto.setPassword("password"); // Mot de passe par defaut (comportement historique)
        createUserDto.setRole(dbUser.getRole().name());

        String newKeycloakId = keycloakService.createUser(createUserDto);
        dbUser.setKeycloakId(newKeycloakId);
        userRepository.save(dbUser);
    }

    /**
     * Determine le role d'un utilisateur base sur ses attributs Keycloak.
     * Par defaut HOST — dans un vrai systeme, on recupererait les roles
     * depuis Keycloak (comportement historique conserve).
     */
    private UserRole determineRoleFromKeycloak(KeycloakUserDto keycloakUser) {
        return UserRole.HOST;
    }
}
