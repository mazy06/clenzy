package com.clenzy.booking.controller;

import com.clenzy.booking.dto.GrowthSettingsDto;
import com.clenzy.booking.service.GrowthSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Réglages de croissance org-level du booking engine (capture de leads, relance de panier).
 * Controller mince : délégation au service (org-scope via TenantContext). Les drapeaux sont
 * réellement appliqués par LeadCaptureService et AbandonedBookingRecoveryScheduler.
 */
@RestController
@RequestMapping("/api/booking-engine/growth")
@Tag(name = "Booking Engine Growth", description = "Reglages de croissance org-level (leads, relance panier)")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class GrowthSettingsController {

    private final GrowthSettingsService growthSettingsService;

    public GrowthSettingsController(GrowthSettingsService growthSettingsService) {
        this.growthSettingsService = growthSettingsService;
    }

    @GetMapping("/settings")
    @Operation(summary = "Lire les reglages de croissance + compteurs de l'organisation")
    public ResponseEntity<GrowthSettingsDto> getSettings() {
        return ResponseEntity.ok(growthSettingsService.getSettings());
    }

    @PutMapping("/settings")
    @Operation(summary = "Mettre a jour les reglages de croissance de l'organisation")
    public ResponseEntity<GrowthSettingsDto> updateSettings(@RequestBody GrowthSettingsDto body) {
        return ResponseEntity.ok(growthSettingsService.updateSettings(
            body.leadCaptureEnabled(), body.leadCapturePopupEnabled(), body.abandonedCartRecoveryEnabled(),
            body.loyaltyCreditPercent(), body.referralCreditCents()));
    }
}
