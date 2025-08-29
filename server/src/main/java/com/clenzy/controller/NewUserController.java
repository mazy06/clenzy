package com.clenzy.controller;

import com.clenzy.dto.CreateUserDto;
import com.clenzy.dto.UpdateUserDto;
import com.clenzy.dto.UserProfileDto;
import com.clenzy.service.NewUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/v2/users")
@CrossOrigin(origins = "*")
public class NewUserController {

    @Autowired
    private NewUserService newUserService;

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
}
