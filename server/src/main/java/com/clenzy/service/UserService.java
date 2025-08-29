package com.clenzy.service;

import com.clenzy.dto.UserDto;
import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.KeycloakUserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.KeycloakOperationException;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Autowired;

@Service
@Transactional
public class UserService {
    private final UserRepository userRepository;
    private final PermissionService permissionService;
    private final NewUserService newUserService;

    public UserService(UserRepository userRepository, PermissionService permissionService, NewUserService newUserService) {
        this.userRepository = userRepository;
        this.permissionService = permissionService;
        this.newUserService = newUserService;
    }

    public UserDto create(UserDto dto) {
        try {
            // Créer l'utilisateur dans Keycloak via NewUserService
            CreateUserDto createUserDto = new CreateUserDto();
            createUserDto.setEmail(dto.email);
            createUserDto.setFirstName(dto.firstName);
            createUserDto.setLastName(dto.lastName);
            createUserDto.setPassword(dto.password);
            createUserDto.setRole(dto.role != null ? dto.role.name() : "HOST");
            
            UserProfileDto userProfile = newUserService.createUser(createUserDto);
            
            // Créer l'utilisateur dans la base métier avec le keycloakId
            User user = new User();
            user.setFirstName(dto.firstName);
            user.setLastName(dto.lastName);
            user.setEmail(dto.email);
            user.setPassword(dto.password);
            user.setPhoneNumber(dto.phoneNumber);
            user.setRole(dto.role != null ? dto.role : com.clenzy.model.UserRole.HOST);
            user.setStatus(dto.status != null ? dto.status : com.clenzy.model.UserStatus.ACTIVE);
            user.setKeycloakId(userProfile.getId());
            
            user = userRepository.save(user);
            
            System.out.println("✅ Utilisateur créé dans Keycloak et base métier: " + user.getEmail() + " (Keycloak ID: " + userProfile.getId() + ")");
            
            return toDto(user);
            
        } catch (Exception e) {
            System.err.println("❌ Erreur lors de la création de l'utilisateur: " + e.getMessage());
            throw new RuntimeException("Impossible de créer l'utilisateur: " + e.getMessage(), e);
        }
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
        
        // Mise à jour du mot de passe dans Keycloak si fourni
        if (dto.newPassword != null && !dto.newPassword.trim().isEmpty()) {
            try {
                System.out.println("🔄 Mise à jour du mot de passe dans Keycloak pour l'utilisateur: " + user.getEmail());
                newUserService.resetPassword(user.getKeycloakId(), dto.newPassword);
                System.out.println("✅ Mot de passe mis à jour dans Keycloak");
            } catch (Exception e) {
                System.err.println("⚠️ Erreur lors de la mise à jour du mot de passe dans Keycloak: " + e.getMessage());
                // L'utilisateur est mis à jour dans la base métier même si la mise à jour Keycloak échoue
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
        User user = userRepository.findById(id).orElseThrow(() -> new NotFoundException("User not found"));
        
        // Supprimer l'utilisateur de Keycloak s'il a un keycloakId
        if (user.getKeycloakId() != null && !user.getKeycloakId().trim().isEmpty()) {
            try {
                System.out.println("🔄 Suppression de l'utilisateur de Keycloak: " + user.getEmail());
                newUserService.deleteUser(user.getKeycloakId());
                System.out.println("✅ Utilisateur supprimé de Keycloak");
            } catch (Exception e) {
                System.err.println("⚠️ Erreur lors de la suppression de Keycloak: " + e.getMessage());
                // Continuer avec la suppression de la base métier même si Keycloak échoue
            }
        }
        
        // Supprimer de la base métier
        userRepository.deleteById(id);
        System.out.println("✅ Utilisateur supprimé de la base métier: " + user.getEmail());
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


