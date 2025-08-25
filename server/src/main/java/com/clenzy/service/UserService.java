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
import org.springframework.scheduling.annotation.Async;
import org.springframework.beans.factory.annotation.Autowired;

@Service
@Transactional
public class UserService {
    private final UserRepository userRepository;
    private final UserSyncService userSyncService;
    private final PermissionService permissionService;

    public UserService(UserRepository userRepository, UserSyncService userSyncService, PermissionService permissionService) {
        this.userRepository = userRepository;
        this.userSyncService = userSyncService;
        this.permissionService = permissionService;
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
        
        // Synchronisation automatique vers Keycloak avec retry et fallback
        int maxRetries = 3;
        int retryCount = 0;
        boolean syncSuccess = false;
        String keycloakId = null;

        while (retryCount < maxRetries && !syncSuccess) {
            try {
                System.out.println("🔄 Tentative " + (retryCount + 1) + " de synchronisation vers Keycloak pour l'utilisateur: " + user.getEmail());
                keycloakId = userSyncService.syncToKeycloak(user);
                user.setKeycloakId(keycloakId);
                user = userRepository.save(user);
                System.out.println("✅ Utilisateur synchronisé vers Keycloak avec l'ID: " + keycloakId);
                syncSuccess = true;
            } catch (Exception e) {
                retryCount++;
                System.err.println("⚠️ Tentative " + retryCount + " échouée: " + e.getMessage());
                
                if (retryCount >= maxRetries) {
                    System.err.println("❌ Échec de la synchronisation après " + maxRetries + " tentatives");
                    System.err.println("⚠️ L'utilisateur sera créé uniquement dans la base métier");
                    System.err.println("🔄 Tentative de synchronisation différée dans 10 secondes...");
                    
                    // Programmer une synchronisation différée
                    scheduleDelayedSync(user);
                } else {
                    // Attendre avant de réessayer (backoff exponentiel)
                    try {
                        int delayMs = 2000 * retryCount; // 2s, 4s, 6s
                        System.out.println("⏳ Attente de " + delayMs + "ms avant la prochaine tentative...");
                        Thread.sleep(delayMs);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        System.err.println("⚠️ Synchronisation interrompue");
                        break;
                    }
                }
            }
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
    
    /**
     * Synchronisation différée d'un utilisateur vers Keycloak
     * Se déclenche automatiquement si la synchronisation immédiate échoue
     */
    @Async
    public void scheduleDelayedSync(User user) {
        try {
            System.out.println("⏰ Synchronisation différée programmée pour l'utilisateur: " + user.getEmail());
            Thread.sleep(10000); // Attendre 10 secondes
            
            System.out.println("🔄 Lancement de la synchronisation différée pour l'utilisateur: " + user.getEmail());
            String keycloakId = userSyncService.forceSyncToKeycloak(user);
            user.setKeycloakId(keycloakId);
            userRepository.save(user);
            System.out.println("✅ Synchronisation différée réussie pour l'utilisateur: " + user.getEmail() + " (ID: " + keycloakId + ")");
            
        } catch (Exception e) {
            System.err.println("❌ Échec de la synchronisation différée pour l'utilisateur " + user.getEmail() + ": " + e.getMessage());
            // L'utilisateur reste dans la base métier sans keycloak_id
        }
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
        dto.emailVerified = user.isEmailVerified() != null ? user.isEmailVerified() : false;
        dto.phoneVerified = user.isPhoneVerified() != null ? user.isPhoneVerified() : false;
        dto.lastLogin = user.getLastLogin();
        dto.createdAt = user.getCreatedAt();
        dto.updatedAt = user.getUpdatedAt();
        return dto;
    }
}


