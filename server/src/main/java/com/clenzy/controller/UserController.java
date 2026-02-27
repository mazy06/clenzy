package com.clenzy.controller;

import com.clenzy.dto.UserDto;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.DeviceTokenService;
import com.clenzy.service.LoginProtectionService;
import com.clenzy.service.LoginProtectionService.LoginStatus;
import com.clenzy.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.validation.annotation.Validated;
import com.clenzy.dto.validation.Create;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "Gestion des utilisateurs")
@PreAuthorize("isAuthenticated()")
public class UserController {
    private final UserService userService;
    private final UserRepository userRepository;
    private final LoginProtectionService loginProtectionService;
    private final DeviceTokenService deviceTokenService;

    public UserController(UserService userService, UserRepository userRepository,
                          LoginProtectionService loginProtectionService, DeviceTokenService deviceTokenService) {
        this.userService = userService;
        this.userRepository = userRepository;
        this.loginProtectionService = loginProtectionService;
        this.deviceTokenService = deviceTokenService;
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Créer un utilisateur")
    public ResponseEntity<UserDto> create(@Validated(Create.class) @RequestBody UserDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.create(dto));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Mettre à jour un utilisateur")
    public UserDto update(@PathVariable Long id, @RequestBody UserDto dto, @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(id, jwt);
        return userService.update(id, dto);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtenir un utilisateur par ID")
    public UserDto get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        validateOwnershipOrAdmin(id, jwt);
        return userService.getById(id);
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Lister les utilisateurs")
    public Page<UserDto> list(@PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return userService.list(pageable);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer un utilisateur")
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }

    // ─── Self-delete (exigence Apple App Store) ─────────────────

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprimer son propre compte",
            description = "Permet a l'utilisateur connecte de supprimer son propre compte. " +
                    "Supprime les tokens push, l'utilisateur Keycloak et les donnees metier. " +
                    "Exigence Apple App Store pour la suppression de compte in-app.")
    public void deleteSelf(@AuthenticationPrincipal Jwt jwt) {
        String keycloakId = jwt.getSubject();
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        // Supprimer les tokens push
        deviceTokenService.removeAllForUser(keycloakId);

        // Supprimer l'utilisateur (Keycloak + base metier)
        userService.delete(user.getId());
    }

    // ─── Login lockout management (admin only) ──────────────────

    @GetMapping("/{id}/lockout-status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Consulter le statut de verrouillage d'un utilisateur")
    public ResponseEntity<?> getLockoutStatus(@PathVariable Long id) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null || user.getEmail() == null) {
            return ResponseEntity.ok(Map.of("isLocked", false, "failedAttempts", 0, "remainingSeconds", 0));
        }

        LoginStatus status = loginProtectionService.checkLoginAllowed(user.getEmail());
        int failedAttempts = loginProtectionService.getFailedAttempts(user.getEmail());

        return ResponseEntity.ok(Map.of(
                "isLocked", status.isLocked(),
                "remainingSeconds", status.remainingSeconds(),
                "captchaRequired", status.captchaRequired(),
                "failedAttempts", failedAttempts
        ));
    }

    @PostMapping("/{id}/unlock")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Debloquer manuellement un utilisateur verrouille")
    public ResponseEntity<?> unlockUser(@PathVariable Long id) {
        User user = userRepository.findById(id).orElse(null);
        if (user == null || user.getEmail() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Utilisateur introuvable"));
        }

        loginProtectionService.forceUnlock(user.getEmail());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Utilisateur " + user.getFirstName() + " " + user.getLastName() + " debloque avec succes"
        ));
    }

    /**
     * Verifie que l'utilisateur authentifie est le proprietaire de la ressource ou un ADMIN.
     */
    private void validateOwnershipOrAdmin(Long resourceUserId, Jwt jwt) {
        String keycloakId = jwt.getSubject();
        // Verifier si l'utilisateur authentifie correspond a la ressource demandee
        User resourceUser = userRepository.findById(resourceUserId).orElse(null);
        boolean isOwner = resourceUser != null && keycloakId.equals(resourceUser.getKeycloakId());
        // Verifier le role admin plateforme (SUPER_ADMIN) depuis le JWT Keycloak
        boolean isAdmin = false;
        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof Map<?,?> ra && ra.get("roles") instanceof List<?> roles) {
            isAdmin = roles.contains("SUPER_ADMIN");
        }
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Acces refuse : vous ne pouvez acceder qu'a vos propres donnees");
        }
    }
}


