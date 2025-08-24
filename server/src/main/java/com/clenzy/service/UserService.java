package com.clenzy.service;

import com.clenzy.dto.UserDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
public class UserService {
    private final UserRepository userRepository;
    private final UserSyncService userSyncService;

    public UserService(UserRepository userRepository, UserSyncService userSyncService) {
        this.userRepository = userRepository;
        this.userSyncService = userSyncService;
    }

    public UserDto create(UserDto dto) {
        User user = new User();
        user.setFirstName(dto.firstName);
        user.setLastName(dto.lastName);
        user.setEmail(dto.email);
        user.setPassword(dto.password); // Set password from DTO
        user.setPhoneNumber(dto.phoneNumber);
        user.setRole(dto.role != null ? dto.role : com.clenzy.model.UserRole.HOST);
        user.setStatus(dto.status != null ? dto.status : com.clenzy.model.UserStatus.ACTIVE);
        
        // Sauvegarder d'abord dans la base métier
        user = userRepository.save(user);
        
        // Synchronisation automatique vers Keycloak (en arrière-plan)
        try {
            System.out.println("🔄 Synchronisation automatique vers Keycloak pour l'utilisateur: " + user.getEmail());
            String keycloakId = userSyncService.syncToKeycloak(user);
            user.setKeycloakId(keycloakId);
            user = userRepository.save(user);
            System.out.println("✅ Utilisateur synchronisé vers Keycloak avec l'ID: " + keycloakId);
        } catch (Exception e) {
            // Logger l'erreur mais ne pas faire échouer la création
            System.err.println("⚠️ Erreur lors de la synchronisation vers Keycloak: " + e.getMessage());
            // L'utilisateur est créé dans la base métier même si la sync Keycloak échoue
        }
        
        return toDto(user);
    }

    public UserDto update(Long id, UserDto dto) {
        User user = userRepository.findById(id).orElseThrow(() -> new NotFoundException("User not found"));
        if (dto.firstName != null) user.setFirstName(dto.firstName);
        if (dto.lastName != null) user.setLastName(dto.lastName);
        if (dto.phoneNumber != null) user.setPhoneNumber(dto.phoneNumber);
        if (dto.role != null) user.setRole(dto.role);
        if (dto.status != null) user.setStatus(dto.status);
        if (dto.profilePictureUrl != null) user.setProfilePictureUrl(dto.profilePictureUrl);
        
        // Sauvegarder d'abord dans la base métier
        user = userRepository.save(user);
        
        // Si un nouveau mot de passe est fourni, synchroniser vers Keycloak
        if (dto.newPassword != null && !dto.newPassword.trim().isEmpty()) {
            try {
                System.out.println("🔄 Synchronisation du nouveau mot de passe vers Keycloak pour l'utilisateur: " + user.getEmail());
                userSyncService.updatePasswordInKeycloak(user.getKeycloakId(), dto.newPassword);
                System.out.println("✅ Mot de passe mis à jour dans Keycloak");
            } catch (Exception e) {
                // Logger l'erreur mais ne pas faire échouer la mise à jour
                System.err.println("⚠️ Erreur lors de la mise à jour du mot de passe dans Keycloak: " + e.getMessage());
                // L'utilisateur est mis à jour dans la base métier même si la sync Keycloak échoue
            }
        }
        
        return toDto(user);
    }

    @Transactional(readOnly = true)
    public UserDto getById(Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> new NotFoundException("User not found"));
        return toDto(user);
    }

    @Transactional(readOnly = true)
    public List<UserDto> list() {
        return userRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<UserDto> list(Pageable pageable) {
        return userRepository.findAll(pageable).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public User findByKeycloakId(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId).orElse(null);
    }

    public void delete(Long id) {
        if (!userRepository.existsById(id)) throw new NotFoundException("User not found");
        userRepository.deleteById(id);
    }

    private UserDto toDto(User user) {
        UserDto dto = new UserDto();
        dto.id = user.getId();
        dto.firstName = user.getFirstName();
        dto.lastName = user.getLastName();
        dto.email = user.getEmail();
        dto.password = user.getPassword(); // Include password in DTO
        dto.newPassword = null; // Ne jamais exposer le nouveau mot de passe
        dto.phoneNumber = user.getPhoneNumber();
        dto.role = user.getRole();
        dto.status = user.getStatus();
        dto.profilePictureUrl = user.getProfilePictureUrl();
        dto.emailVerified = user.isEmailVerified();
        dto.phoneVerified = user.isPhoneVerified();
        dto.lastLogin = user.getLastLogin();
        dto.createdAt = user.getCreatedAt();
        dto.updatedAt = user.getUpdatedAt();
        return dto;
    }
}


