package com.clenzy.controller;

import com.clenzy.dto.NotificationPreferenceDto;
import com.clenzy.service.NotificationPreferenceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notification-preferences")
@Tag(name = "Notification Preferences", description = "Gestion des preferences de notifications utilisateur")
public class NotificationPreferenceController {

    private final NotificationPreferenceService preferenceService;

    public NotificationPreferenceController(NotificationPreferenceService preferenceService) {
        this.preferenceService = preferenceService;
    }

    @GetMapping
    @Operation(summary = "Obtenir toutes les preferences de notification de l'utilisateur connecte")
    public ResponseEntity<Map<String, Boolean>> getPreferences(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        Map<String, Boolean> preferences = preferenceService.getPreferencesForUser(userId);
        return ResponseEntity.ok(preferences);
    }

    @PutMapping
    @Operation(summary = "Mettre a jour les preferences de notification de l'utilisateur connecte")
    public ResponseEntity<Map<String, Boolean>> updatePreferences(
            @RequestBody NotificationPreferenceDto dto,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        preferenceService.updatePreferences(userId, dto.preferences);
        // Retourner les preferences mises a jour
        Map<String, Boolean> updated = preferenceService.getPreferencesForUser(userId);
        return ResponseEntity.ok(updated);
    }
}
