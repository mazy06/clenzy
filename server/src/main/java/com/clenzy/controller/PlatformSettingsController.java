package com.clenzy.controller;

import com.clenzy.model.PlatformSettings;
import com.clenzy.service.PlatformSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Réglages plateforme Baitly — réservés aux SUPER_ADMIN / SUPER_MANAGER.
 *
 * GET  /api/admin/platform-settings                       → état des toggles
 * PUT  /api/admin/platform-settings/prospect-devis-emails → activer/désactiver
 *      l'envoi des emails de devis aux prospects (landing).
 */
@RestController
@RequestMapping("/api/admin/platform-settings")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class PlatformSettingsController {

    private final PlatformSettingsService service;

    public PlatformSettingsController(PlatformSettingsService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> get() {
        PlatformSettings s = service.getOrDefault();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sendProspectDevisEmails", s.isSendProspectDevisEmails());
        body.put("addDevisLeadsToWaitlist", s.isAddDevisLeadsToWaitlist());
        body.put("updatedAt", s.getUpdatedAt());
        body.put("updatedBy", s.getUpdatedBy());
        return ResponseEntity.ok(body);
    }

    @PutMapping("/prospect-devis-emails")
    public ResponseEntity<Map<String, Object>> setProspectDevisEmails(
            @RequestParam boolean enabled,
            @AuthenticationPrincipal Jwt jwt) {
        PlatformSettings s = service.updateSendProspectDevisEmails(enabled, updatedBy(jwt));
        return ResponseEntity.ok(Map.of("sendProspectDevisEmails", s.isSendProspectDevisEmails()));
    }

    @PutMapping("/devis-leads-to-waitlist")
    public ResponseEntity<Map<String, Object>> setDevisLeadsToWaitlist(
            @RequestParam boolean enabled,
            @AuthenticationPrincipal Jwt jwt) {
        PlatformSettings s = service.updateAddDevisLeadsToWaitlist(enabled, updatedBy(jwt));
        return ResponseEntity.ok(Map.of("addDevisLeadsToWaitlist", s.isAddDevisLeadsToWaitlist()));
    }

    private String updatedBy(Jwt jwt) {
        if (jwt == null) return null;
        String username = jwt.getClaimAsString("preferred_username");
        return username != null ? username : jwt.getSubject();
    }
}
