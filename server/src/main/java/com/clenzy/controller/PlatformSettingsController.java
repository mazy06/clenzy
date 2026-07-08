package com.clenzy.controller;

import com.clenzy.model.PlatformSettings;
import com.clenzy.service.PlatformSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
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
        body.put("internalNotificationEmails", service.getInternalNotificationEmails());
        body.put("senderEmail", s.getSenderEmail());
        body.put("senderName", s.getSenderName());
        body.put("conciergeDraftEnabled", s.isConciergeDraftEnabled());
        body.put("conciergeAutosendEnabled", s.isConciergeAutosendEnabled());
        body.put("conciergeAutosendMinForfait", s.getConciergeAutosendMinForfait());
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

    /**
     * Met à jour la liste des destinataires des notifications internes (lead devis,
     * copie devis, waitlist, maintenance). L'expéditeur reste toujours info@clenzy.fr.
     * Rejette une saisie sans aucune adresse valide (évite de couper toute notif).
     */
    @PutMapping("/internal-notification-emails")
    public ResponseEntity<Map<String, Object>> setInternalNotificationEmails(
            @RequestBody List<String> emails,
            @AuthenticationPrincipal Jwt jwt) {
        List<String> cleaned = PlatformSettingsService.cleanEmails(emails);
        if (cleaned.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Au moins une adresse email valide est requise."));
        }
        service.updateInternalNotificationEmails(cleaned, updatedBy(jwt));
        return ResponseEntity.ok(Map.of("internalNotificationEmails", cleaned));
    }

    /** Corps de mise à jour de l'adresse d'expédition (From) plateforme. */
    public record UpdateSenderRequest(String email, String name) {}

    /**
     * Met à jour l'adresse d'expédition (From) de la plateforme + son nom d'affichage.
     * Niveau plateforme uniquement. Rappel : changer de domaine impose de l'authentifier
     * dans Brevo (SPF/DKIM) sous peine de spam/bounce.
     */
    @PutMapping("/sender")
    public ResponseEntity<Map<String, Object>> setSender(
            @RequestBody UpdateSenderRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        if (req == null || !PlatformSettingsService.isValidEmail(req.email())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Adresse d'expédition invalide."));
        }
        PlatformSettings s = service.updateSender(req.email(), req.name(), updatedBy(jwt));
        return ResponseEntity.ok(Map.of(
                "senderEmail", s.getSenderEmail(),
                "senderName", s.getSenderName()));
    }

    /** Corps de mise à jour des masters concierge IA (plateforme). */
    public record ConciergeSettingsRequest(boolean draftEnabled, boolean autosendEnabled, String minForfait) {}

    /**
     * Active/désactive le concierge IA au niveau plateforme (brouillon + auto-envoi)
     * et son palier premium minimal. Piloté en base — pris en compte à chaud (prochain
     * message guest entrant), sans redéploiement du pms-server.
     */
    @PutMapping("/concierge")
    public ResponseEntity<Map<String, Object>> setConcierge(
            @RequestBody ConciergeSettingsRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        PlatformSettings s = service.updateConcierge(
                req.draftEnabled(), req.autosendEnabled(), req.minForfait(), updatedBy(jwt));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("conciergeDraftEnabled", s.isConciergeDraftEnabled());
        body.put("conciergeAutosendEnabled", s.isConciergeAutosendEnabled());
        body.put("conciergeAutosendMinForfait", s.getConciergeAutosendMinForfait());
        return ResponseEntity.ok(body);
    }

    private String updatedBy(Jwt jwt) {
        if (jwt == null) return null;
        String username = jwt.getClaimAsString("preferred_username");
        return username != null ? username : jwt.getSubject();
    }
}
