package com.clenzy.controller;

import com.clenzy.dto.UserPreferencesDto;
import com.clenzy.model.UserPreferences;
import com.clenzy.repository.UserPreferencesRepository;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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

    private final UserPreferencesRepository repository;
    private final TenantContext tenantContext;

    public UserPreferencesController(UserPreferencesRepository repository,
                                     TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/me")
    @Operation(summary = "Obtenir les preferences de l'utilisateur courant")
    public ResponseEntity<UserPreferencesDto> getMyPreferences(@AuthenticationPrincipal Jwt jwt) {
        final String keycloakId = jwt.getSubject();
        final UserPreferences entity = getOrCreate(keycloakId);
        return ResponseEntity.ok(toDto(entity));
    }

    @PutMapping("/me")
    @Operation(summary = "Mettre a jour les preferences de l'utilisateur courant")
    public ResponseEntity<UserPreferencesDto> updateMyPreferences(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody UserPreferencesDto dto) {

        final String keycloakId = jwt.getSubject();
        final UserPreferences entity = getOrCreate(keycloakId);

        if (dto.getTimezone() != null) entity.setTimezone(dto.getTimezone());
        if (dto.getCurrency() != null) entity.setCurrency(dto.getCurrency());
        if (dto.getLanguage() != null) entity.setLanguage(dto.getLanguage());
        entity.setNotifyEmail(dto.isNotifyEmail());
        entity.setNotifyPush(dto.isNotifyPush());
        entity.setNotifySms(dto.isNotifySms());

        repository.save(entity);
        return ResponseEntity.ok(toDto(entity));
    }

    // ── Private helpers ──────────────────────────────────────────────────

    private UserPreferences getOrCreate(String keycloakId) {
        return repository.findByKeycloakId(keycloakId)
                .orElseGet(() -> {
                    final var prefs = new UserPreferences(keycloakId, tenantContext.getOrganizationId());
                    return repository.save(prefs);
                });
    }

    private UserPreferencesDto toDto(UserPreferences entity) {
        return new UserPreferencesDto(
                entity.getTimezone(),
                entity.getCurrency(),
                entity.getLanguage(),
                entity.isNotifyEmail(),
                entity.isNotifyPush(),
                entity.isNotifySms()
        );
    }
}
