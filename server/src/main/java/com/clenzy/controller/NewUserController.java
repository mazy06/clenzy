package com.clenzy.controller;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.UpdateUserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.service.LoginProtectionService;
import com.clenzy.service.LoginProtectionService.LoginStatus;
import com.clenzy.service.NewUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v2/users")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class NewUserController {

    private final NewUserService newUserService;
    private final LoginProtectionService loginProtectionService;

    public NewUserController(NewUserService newUserService,
                             LoginProtectionService loginProtectionService) {
        this.newUserService = newUserService;
        this.loginProtectionService = loginProtectionService;
    }

    /**
     * Récupérer tous les profils utilisateurs
     */
    @GetMapping
    public ResponseEntity<List<UserProfileDto>> getAllUsers() {
        try {
            List<UserProfileDto> users = newUserService.getAllUserProfiles();
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Récupérer le profil d'un utilisateur par son ID
     */
    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileDto> getUserById(@PathVariable String userId) {
        try {
            UserProfileDto user = newUserService.getUserProfile(userId);
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Créer un nouvel utilisateur
     */
    @PostMapping
    public ResponseEntity<UserProfileDto> createUser(
            @Valid @RequestBody CreateUserDto createUserDto,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            UserProfileDto createdUser = newUserService.createUser(createUserDto);
            return ResponseEntity.ok(createdUser);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Mettre à jour un utilisateur
     */
    @PutMapping("/{userId}")
    public ResponseEntity<UserProfileDto> updateUser(
            @PathVariable String userId,
            @Valid @RequestBody UpdateUserDto updateUserDto,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            UserProfileDto updatedUser = newUserService.updateUser(userId, updateUserDto);
            return ResponseEntity.ok(updatedUser);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Supprimer un utilisateur
     */
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUser(
            @PathVariable String userId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            newUserService.deleteUser(userId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Réinitialiser le mot de passe d'un utilisateur
     */
    @PostMapping("/{userId}/reset-password")
    public ResponseEntity<Void> resetPassword(
            @PathVariable String userId,
            @RequestParam String newPassword,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            newUserService.resetPassword(userId, newPassword);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Vérifier si un utilisateur existe
     */
    @GetMapping("/{userId}/exists")
    public ResponseEntity<Boolean> userExists(@PathVariable String userId) {
        try {
            boolean exists = newUserService.userExists(userId);
            return ResponseEntity.ok(exists);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    // ─── Login lockout management (admin only) ──────────────────

    /**
     * Consulter le statut de verrouillage d'un utilisateur.
     * Utilise l'email de l'utilisateur pour interroger Redis.
     */
    @GetMapping("/{userId}/lockout-status")
    public ResponseEntity<?> getLockoutStatus(@PathVariable String userId) {
        try {
            UserProfileDto user = newUserService.getUserProfile(userId);
            String email = user.getEmail();
            if (email == null || email.isBlank()) {
                return ResponseEntity.ok(Map.of("isLocked", false, "failedAttempts", 0, "remainingSeconds", 0));
            }

            LoginStatus status = loginProtectionService.checkLoginAllowed(email);
            int failedAttempts = loginProtectionService.getFailedAttempts(email);

            return ResponseEntity.ok(Map.of(
                    "isLocked", status.isLocked(),
                    "remainingSeconds", status.remainingSeconds(),
                    "captchaRequired", status.captchaRequired(),
                    "failedAttempts", failedAttempts
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("isLocked", false, "failedAttempts", 0, "remainingSeconds", 0));
        }
    }

    /**
     * Débloquer manuellement un utilisateur verrouillé.
     * Supprime le lockout Redis et réinitialise le compteur de tentatives.
     */
    @PostMapping("/{userId}/unlock")
    public ResponseEntity<?> unlockUser(@PathVariable String userId) {
        try {
            UserProfileDto user = newUserService.getUserProfile(userId);
            String email = user.getEmail();
            if (email == null || email.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email introuvable pour cet utilisateur"));
            }

            loginProtectionService.forceUnlock(email);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Utilisateur " + user.getFirstName() + " " + user.getLastName() + " débloqué avec succès"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Impossible de débloquer l'utilisateur: " + e.getMessage()));
        }
    }
}
