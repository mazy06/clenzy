package com.clenzy.booking.controller;

import com.clenzy.service.PlatformSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Bibliothèque GLOBALE de widgets composites du booking engine (niveau PLATEFORME).
 *
 * <p>Les composites « normaux » restent propres à chaque engine ({@code booking_engine_configs
 * .composite_widgets}). Cette bibliothèque-ci est partagée : alimentée par les SUPER_ADMIN /
 * SUPER_MANAGER, elle est visible (lecture) dans le Studio de TOUS les booking engines.</p>
 *
 * <ul>
 *   <li>GET : HOST + platform staff (ceux qui ouvrent le Studio) → affichage dans chaque engine.</li>
 *   <li>PUT : SUPER_ADMIN / SUPER_MANAGER uniquement → seuls eux modifient la lib partagée.</li>
 * </ul>
 * Stockage : {@link PlatformSettingsService} ({@code platform_settings.global_composite_widgets}),
 * JSON sérialisé, MÊME format que la lib par-engine (parsé par le même code front).
 */
@RestController
@RequestMapping("/api/booking-engine/global-composites")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class BookingGlobalCompositesController {

    private final PlatformSettingsService platformSettingsService;

    public BookingGlobalCompositesController(PlatformSettingsService platformSettingsService) {
        this.platformSettingsService = platformSettingsService;
    }

    /** Lecture de la bibliothèque globale (tout utilisateur du Studio). Toujours un JSON array (défaut `[]`). */
    @GetMapping
    public ResponseEntity<Map<String, Object>> get() {
        String json = platformSettingsService.getGlobalCompositeWidgets();
        return ResponseEntity.ok(Map.of("widgets", json != null ? json : "[]"));
    }

    /** Corps de mise à jour : JSON sérialisé de la liste des composites globaux. */
    public record UpdateRequest(String widgets) {}

    /** Remplace la bibliothèque globale (SUPER_ADMIN / SUPER_MANAGER uniquement). */
    @PutMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<Map<String, Object>> put(@RequestBody(required = false) UpdateRequest req,
                                                    @AuthenticationPrincipal Jwt jwt) {
        String widgets = (req != null && req.widgets() != null && !req.widgets().isBlank())
                ? req.widgets() : "[]";
        platformSettingsService.updateGlobalCompositeWidgets(widgets, updatedBy(jwt));
        return ResponseEntity.ok(Map.of("widgets", widgets));
    }

    private String updatedBy(Jwt jwt) {
        if (jwt == null) return null;
        String username = jwt.getClaimAsString("preferred_username");
        return username != null ? username : jwt.getSubject();
    }
}
