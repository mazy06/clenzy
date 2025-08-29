package com.clenzy.service;

import com.clenzy.dto.KeycloakUserDto;
import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.UpdateUserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.exception.UserNotFoundException;
import com.clenzy.exception.KeycloakOperationException;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class NewUserService {

    @Autowired
    private KeycloakService keycloakService;

    @Autowired
    private UserRepository userRepository;

    /**
     * Récupérer le profil complet d'un utilisateur (Keycloak + données métier)
     */
    public UserProfileDto getUserProfile(String externalId) {
        try {
            // 1. Récupérer les informations depuis Keycloak
            KeycloakUserDto keycloakUser = keycloakService.getUser(externalId);
            
            // 2. Récupérer les données métier
            Optional<User> businessUserOpt = userRepository.findByKeycloakId(externalId);
            User businessUser = businessUserOpt.orElse(null);
            
            // 3. Fusionner les données
            return mergeUserData(keycloakUser, businessUser);
        } catch (Exception e) {
            throw new UserNotFoundException("Erreur lors de la récupération du profil utilisateur: " + e.getMessage());
        }
    }

    /**
     * Récupérer tous les profils utilisateurs
     */
    public List<UserProfileDto> getAllUserProfiles() {
        try {
            // 1. Récupérer tous les utilisateurs depuis Keycloak
            List<KeycloakUserDto> keycloakUsers = keycloakService.getAllUsers();
            
            // 2. Récupérer toutes les données métier
            List<User> businessUsers = userRepository.findAll();
            
            // 3. Fusionner les données
            return keycloakUsers.stream()
                .map(keycloakUser -> {
                    User businessUser = businessUsers.stream()
                        .filter(bu -> bu.getKeycloakId() != null && bu.getKeycloakId().equals(keycloakUser.getId()))
                        .findFirst()
                        .orElse(null);
                    return mergeUserData(keycloakUser, businessUser);
                })
                .collect(Collectors.toList());
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la récupération des profils utilisateurs: " + e.getMessage());
        }
    }

    /**
     * Créer un nouvel utilisateur
     */
    @Transactional
    public UserProfileDto createUser(CreateUserDto createUserDto) {
        try {
            // 1. Créer l'utilisateur dans Keycloak
            String externalId = keycloakService.createUser(createUserDto);
            
            // 2. Créer l'utilisateur dans la base métier
            User businessUser = new User();
            businessUser.setKeycloakId(externalId);
            businessUser.setRole(UserRole.valueOf(createUserDto.getRole()));
            businessUser.setStatus(UserStatus.ACTIVE);
            
            // Sauvegarder l'utilisateur métier
            businessUser = userRepository.save(businessUser);
            
            // 3. Retourner le profil complet
            return getUserProfile(externalId);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la création de l'utilisateur: " + e.getMessage());
        }
    }

    /**
     * Mettre à jour un utilisateur
     */
    @Transactional
    public UserProfileDto updateUser(String externalId, UpdateUserDto updateUserDto) {
        try {
            // 1. Mettre à jour dans Keycloak
            keycloakService.updateUser(externalId, updateUserDto);
            
            // 2. Mettre à jour dans la base métier si nécessaire
            Optional<User> businessUserOpt = userRepository.findByKeycloakId(externalId);
            if (businessUserOpt.isPresent() && updateUserDto.getRole() != null) {
                User businessUser = businessUserOpt.get();
                businessUser.setRole(UserRole.valueOf(updateUserDto.getRole()));
                userRepository.save(businessUser);
            }
            
            // 3. Retourner le profil mis à jour
            return getUserProfile(externalId);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la mise à jour de l'utilisateur: " + e.getMessage());
        }
    }

    /**
     * Supprimer un utilisateur
     */
    @Transactional
    public void deleteUser(String externalId) {
        try {
            // 1. Supprimer de Keycloak
            keycloakService.deleteUser(externalId);
            
            // 2. Supprimer de la base métier
            Optional<User> businessUserOpt = userRepository.findByKeycloakId(externalId);
            if (businessUserOpt.isPresent()) {
                userRepository.delete(businessUserOpt.get());
            }
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la suppression de l'utilisateur: " + e.getMessage());
        }
    }

    /**
     * Réinitialiser le mot de passe d'un utilisateur
     */
    public void resetPassword(String externalId, String newPassword) {
        try {
            keycloakService.resetPassword(externalId, newPassword);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la réinitialisation du mot de passe: " + e.getMessage());
        }
    }

    /**
     * Vérifier si un utilisateur existe
     */
    public boolean userExists(String externalId) {
        return keycloakService.userExists(externalId);
    }

    /**
     * Fusionner les données Keycloak et métier
     */
    private UserProfileDto mergeUserData(KeycloakUserDto keycloakUser, User businessUser) {
        UserProfileDto profile = new UserProfileDto();
        
        // Données Keycloak (source de vérité)
        profile.setId(keycloakUser.getId());
        profile.setEmail(keycloakUser.getEmail());
        profile.setFirstName(keycloakUser.getFirstName());
        profile.setLastName(keycloakUser.getLastName());
        profile.setEnabled(keycloakUser.getEnabled());
        profile.setEmailVerified(keycloakUser.getEmailVerified());
        profile.setCreatedTimestamp(keycloakUser.getCreatedTimestamp());
        
        // Données métier (si disponibles)
        if (businessUser != null) {
            profile.setRole(businessUser.getRole());
            profile.setStatus(businessUser.getStatus());
            profile.setPhone(businessUser.getPhoneNumber());
            profile.setAddress(null); // Pas de champ address dans User
            profile.setCreatedAt(businessUser.getCreatedAt());
            profile.setUpdatedAt(businessUser.getUpdatedAt());
        }
        
        return profile;
    }
}
