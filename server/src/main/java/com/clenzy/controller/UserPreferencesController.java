package com.clenzy.controller;

import com.clenzy.dto.UserPreferencesDto;
import com.clenzy.service.UserPreferencesService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Preferences utilisateur persistees en BDD.
 * Chaque utilisateur a un singleton de preferences (cree lazily au premier GET).
 */
@RestController
@RequestMapping("/api/user-preferences")
@PreAuthorize("isAuthenticated()")
@Tag(name = "User Preferences", description = "Preferences utilisateur (timezone, devise, langue, notifications)")
public class UserPreferencesController {

    private final UserPreferencesService userPreferencesService;

    public UserPreferencesController(UserPreferencesService userPreferencesService) {
        this.userPreferencesService = userPreferencesService;
    }

    @GetMapping("/me")
    @Operation(summary = "Obtenir les preferences de l'utilisateur courant")
    public ResponseEntity<UserPreferencesDto> getMyPreferences(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(userPreferencesService.getOrCreateForUser(jwt.getSubject()));
    }

    @PutMapping("/me")
    @Operation(summary = "Mettre a jour les preferences de l'utilisateur courant")
    public ResponseEntity<UserPreferencesDto> updateMyPreferences(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UserPreferencesDto dto) {
        return ResponseEntity.ok(userPreferencesService.updateForUser(jwt.getSubject(), dto));
    }
}
