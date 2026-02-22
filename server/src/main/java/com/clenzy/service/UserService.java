package com.clenzy.service;

import com.clenzy.dto.UserDto;
import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.KeycloakUserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.KeycloakOperationException;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.tenant.TenantContext;
import java.util.UUID;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final PermissionService permissionService;
    private final NewUserService newUserService;
    private final NotificationService notificationService;
    private final TenantContext tenantContext;

    public UserService(UserRepository userRepository, OrganizationRepository organizationRepository, PermissionService permissionService, NewUserService newUserService, NotificationService notificationService, TenantContext tenantContext) {
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.permissionService = permissionService;
        this.newUserService = newUserService;
        this.notificationService = notificationService;
        this.tenantContext = tenantContext;
    }

    public UserDto create(UserDto dto) {
        try {
            // 1. Créer l'utilisateur dans Keycloak + base métier via NewUserService
            CreateUserDto createUserDto = new CreateUserDto();
            createUserDto.setEmail(dto.email);
            createUserDto.setFirstName(dto.firstName);
            createUserDto.setLastName(dto.lastName);
            createUserDto.setPassword(dto.password);
            createUserDto.setRole(dto.role != null ? dto.role.name() : "HOST");

            UserProfileDto userProfile = newUserService.createUser(createUserDto);

            // 2. Récupérer l'utilisateur créé par NewUserService et compléter les champs métier
            User user = userRepository.findByKeycloakId(userProfile.getId())
                    .orElseThrow(() -> new RuntimeException("Utilisateur créé mais non trouvé en base"));

            // Compléter les champs métier additionnels non gérés par NewUserService
            if (dto.phoneNumber != null) user.setPhoneNumber(dto.phoneNumber);
            if (dto.status != null) user.setStatus(dto.status);
            user.setOrganizationId(tenantContext.getOrganizationId());
            user = userRepository.save(user);

            log.debug("Utilisateur cree dans Keycloak et base metier: {} (Keycloak ID: {})", user.getEmail(), userProfile.getId());

            try {
                notificationService.notifyAdminsAndManagers(
                    NotificationKey.USER_CREATED,
                    "Nouvel utilisateur",
                    "Utilisateur " + user.getFirstName() + " " + user.getLastName() + " cree (" + user.getRole() + ")",
                    "/users/" + user.getId()
                );
            } catch (Exception notifEx) {
                log.warn("Erreur notification USER_CREATED: {}", notifEx.getMessage());
            }

            return toDto(user);

        } catch (Exception e) {
            log.error("Erreur lors de la creation de l'utilisateur: {}", e.getMessage());
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
        if (dto.deferredPayment != null) user.setDeferredPayment(dto.deferredPayment);
        if (dto.organizationId != null) user.setOrganizationId(dto.organizationId);

        // Sauvegarder d'abord dans la base métier
        user = userRepository.save(user);
        
        try {
            if (user.getKeycloakId() != null) {
                notificationService.notify(
                    user.getKeycloakId(),
                    NotificationKey.USER_UPDATED,
                    "Profil mis a jour",
                    "Votre profil a ete modifie",
                    "/users/" + user.getId()
                );
            }
        } catch (Exception notifEx) {
            log.warn("Erreur notification USER_UPDATED: {}", notifEx.getMessage());
        }

        // Mise à jour du mot de passe dans Keycloak si fourni
        if (dto.newPassword != null && !dto.newPassword.trim().isEmpty()) {
            try {
                log.debug("Mise a jour du mot de passe dans Keycloak pour l'utilisateur: {}", user.getEmail());
                newUserService.resetPassword(user.getKeycloakId(), dto.newPassword);
                log.debug("Mot de passe mis a jour dans Keycloak");
            } catch (Exception e) {
                log.warn("Erreur lors de la mise a jour du mot de passe dans Keycloak: {}", e.getMessage());
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

    @Transactional(readOnly = true)
    public User findByEmail(String email) {
        if (email == null) return null;
        String hash = StringUtils.computeEmailHash(email);
        return userRepository.findByEmailHash(hash).orElse(null);
    }

    @Transactional(readOnly = true)
    public boolean existsByEmail(String email) {
        if (email == null) return false;
        String hash = StringUtils.computeEmailHash(email);
        return userRepository.existsByEmailHash(hash);
    }

    @Transactional
    public void updateKeycloakId(Long userId, String keycloakId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setKeycloakId(keycloakId);
            userRepository.save(user);
        });
    }

    @Transactional
    public User autoProvisionUser(String keycloakId, String email, String firstName, String lastName, UserRole role) {
        try {
            User user = new User();
            user.setKeycloakId(keycloakId);
            user.setEmail(email != null ? email : keycloakId + "@auto-provisioned.local");
            user.setFirstName(firstName != null && !firstName.isBlank() ? firstName : "Auto");
            user.setLastName(lastName != null && !lastName.isBlank() ? lastName : "Provisioned");
            user.setRole(role);
            user.setStatus(UserStatus.ACTIVE);
            user.setEmailVerified(true);
            // Mot de passe aleatoire — l'utilisateur se connecte via Keycloak, pas via ce password
            user.setPassword(UUID.randomUUID().toString().replace("-", "") + "Aa1!");

            // Resoudre l'organizationId : tenant context d'abord, puis fallback sur la premiere org
            Long orgId = tenantContext.getOrganizationId();
            if (orgId == null) {
                log.warn("Auto-provisioning: tenantContext sans organizationId, recherche d'une organisation par defaut...");
                var allOrgs = organizationRepository.findAll();
                if (!allOrgs.isEmpty()) {
                    orgId = allOrgs.get(0).getId();
                    log.info("Auto-provisioning: organisation par defaut trouvee: id={}, name={}", orgId, allOrgs.get(0).getName());
                } else {
                    log.error("Auto-provisioning: aucune organisation trouvee en base, l'utilisateur sera sans organisation");
                }
            }
            user.setOrganizationId(orgId);

            user = userRepository.save(user);
            userRepository.flush(); // Force le flush pour detecter les erreurs de contrainte
            log.debug("Auto-provisioning: utilisateur cree en base - ID={}, email={}, role={}, orgId={}, keycloakId={}", user.getId(), email, role.name(), orgId, keycloakId);
            return user;
        } catch (Exception e) {
            log.error("Erreur auto-provisioning: {}", e.getMessage(), e);
            return null;
        }
    }

    public void delete(Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> new NotFoundException("User not found"));
        
        // Supprimer l'utilisateur de Keycloak s'il a un keycloakId
        if (user.getKeycloakId() != null && !user.getKeycloakId().trim().isEmpty()) {
            try {
                log.debug("Suppression de l'utilisateur de Keycloak: {}", user.getEmail());
                newUserService.deleteUser(user.getKeycloakId());
                log.debug("Utilisateur supprime de Keycloak");
            } catch (Exception e) {
                log.warn("Erreur lors de la suppression de Keycloak: {}", e.getMessage());
                // Continuer avec la suppression de la base métier même si Keycloak échoue
            }
        }
        
        // Supprimer de la base métier
        userRepository.deleteById(id);
        log.debug("Utilisateur supprime de la base metier: {}", user.getEmail());

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.USER_DELETED,
                "Utilisateur supprime",
                "Utilisateur " + user.getFirstName() + " " + user.getLastName() + " (" + user.getEmail() + ") supprime",
                "/users"
            );
        } catch (Exception notifEx) {
            log.warn("Erreur notification USER_DELETED: {}", notifEx.getMessage());
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
        // Donnees du profil host
        dto.companyName = user.getCompanyName();
        dto.forfait = user.getForfait();
        dto.city = user.getCity();
        dto.postalCode = user.getPostalCode();
        dto.propertyType = user.getPropertyType();
        dto.propertyCount = user.getPropertyCount();
        dto.surface = user.getSurface();
        dto.guestCapacity = user.getGuestCapacity();
        dto.bookingFrequency = user.getBookingFrequency();
        dto.cleaningSchedule = user.getCleaningSchedule();
        dto.calendarSync = user.getCalendarSync();
        dto.services = user.getServices();
        dto.servicesDevis = user.getServicesDevis();
        dto.deferredPayment = user.isDeferredPayment();
        // Organisation rattachee
        dto.organizationId = user.getOrganizationId();
        if (user.getOrganizationId() != null) {
            organizationRepository.findById(user.getOrganizationId()).ifPresent(org ->
                dto.organizationName = org.getName()
            );
        }
        return dto;
    }
}


