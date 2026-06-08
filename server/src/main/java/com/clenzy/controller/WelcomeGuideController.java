package com.clenzy.controller;

import com.clenzy.dto.GuestbookEntryDto;
import com.clenzy.dto.PoiSuggestionDto;
import com.clenzy.dto.WelcomeGuideDto;
import com.clenzy.dto.WelcomeGuideRequest;
import com.clenzy.dto.WelcomeGuideStatsDto;
import com.clenzy.exception.WelcomeGuideAlreadyExistsException;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.service.PoiSuggestionService;
import com.clenzy.service.WelcomeGuideAnalyticsService;
import com.clenzy.service.WelcomeGuideEntryService;
import com.clenzy.service.WelcomeGuideService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/welcome-guides")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class WelcomeGuideController {

    private final WelcomeGuideService guideService;
    private final WelcomeGuideEntryService entryService;
    private final WelcomeGuideAnalyticsService analyticsService;
    private final PoiSuggestionService poiSuggestionService;
    private final TenantContext tenantContext;

    public WelcomeGuideController(WelcomeGuideService guideService,
                                  WelcomeGuideEntryService entryService,
                                  WelcomeGuideAnalyticsService analyticsService,
                                  PoiSuggestionService poiSuggestionService,
                                  TenantContext tenantContext) {
        this.guideService = guideService;
        this.entryService = entryService;
        this.analyticsService = analyticsService;
        this.poiSuggestionService = poiSuggestionService;
        this.tenantContext = tenantContext;
    }

    /**
     * Organisation de scope pour les opérations sur les livrets.
     * <p>Pour le staff plateforme (SUPER_ADMIN/SUPER_MANAGER), renvoie {@code null} → vue et
     * gestion <strong>cross-org</strong> (le staff n'est rattaché à aucune org métier, et peut
     * même avoir une org « maison » non-null qu'il ne faut pas utiliser comme filtre).
     * Pour un HOST, renvoie son organisation courante (scope strict).</p>
     */
    private Long scopeOrgId() {
        return tenantContext.isSuperAdmin() ? null : tenantContext.getOrganizationId();
    }

    @GetMapping
    public ResponseEntity<List<WelcomeGuideDto>> getAll() {
        Long orgId = scopeOrgId();
        List<WelcomeGuideDto> guides = guideService.getAll(orgId)
            .stream().map(WelcomeGuideDto::from).toList();
        return ResponseEntity.ok(guides);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WelcomeGuideDto> getById(@PathVariable Long id) {
        Long orgId = scopeOrgId();
        return guideService.getById(id, orgId)
            .map(WelcomeGuideDto::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/guestbook")
    public ResponseEntity<List<GuestbookEntryDto>> getGuestbook(@PathVariable Long id) {
        Long orgId = scopeOrgId();
        return ResponseEntity.ok(entryService.listForGuide(id, orgId));
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<WelcomeGuideStatsDto> getStats(@PathVariable Long id) {
        Long orgId = scopeOrgId();
        return analyticsService.getStats(id, orgId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /** Suggestions de POI « autour de moi » auto-populées (OSM) à partir du logement du livret. */
    @GetMapping("/{id}/poi-suggestions")
    public ResponseEntity<List<PoiSuggestionDto>> poiSuggestions(@PathVariable Long id) {
        Long orgId = scopeOrgId();
        return ResponseEntity.ok(poiSuggestionService.suggest(id, orgId));
    }

    /**
     * Donnees auto-remplies d'un logement pour l'apercu live de l'editeur (adresse, wifi,
     * digicode, horaires par defaut) — memes sources que le payload guest, sans token.
     */
    @GetMapping("/property-preview/{propertyId}")
    public ResponseEntity<com.clenzy.dto.WelcomeGuidePublicDto.PreviewData> propertyPreview(@PathVariable Long propertyId) {
        return guideService.getPropertyPreviewData(propertyId, scopeOrgId())
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Création manuelle d'un livret rattaché à une réservation — réservée au staff plateforme.
     * Un seul livret par réservation : si un livret existe déjà → 409 (le front demande confirmation,
     * puis re-POST avec {@code overwrite=true} pour écraser l'ancien).
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<?> create(@Valid @RequestBody WelcomeGuideRequest request,
                                    @RequestParam(defaultValue = "false") boolean overwrite) {
        Long orgId = scopeOrgId();
        try {
            WelcomeGuide guide = guideService.createGuide(orgId, request, overwrite);
            return ResponseEntity.ok(WelcomeGuideDto.from(guide));
        } catch (WelcomeGuideAlreadyExistsException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", "GUIDE_ALREADY_EXISTS",
                "existingGuideId", e.getExistingGuideId(),
                "reservationId", e.getReservationId(),
                "message", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<WelcomeGuideDto> update(@PathVariable Long id,
                                                    @Valid @RequestBody WelcomeGuideRequest request) {
        Long orgId = scopeOrgId();
        WelcomeGuide guide = guideService.updateGuide(id, orgId, request);
        return ResponseEntity.ok(WelcomeGuideDto.from(guide));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Long orgId = scopeOrgId();
        guideService.deleteGuide(id, orgId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/token")
    public ResponseEntity<Map<String, String>> generateToken(@PathVariable Long id) {
        Long orgId = scopeOrgId();
        WelcomeGuideToken token = guideService.generateToken(id, orgId, null);
        String link = guideService.generateGuideLink(token);
        return ResponseEntity.ok(Map.of("token", token.getToken().toString(), "link", link));
    }

    @GetMapping("/{id}/qrcode")
    public ResponseEntity<byte[]> getQrCode(@PathVariable Long id) {
        Long orgId = scopeOrgId();
        WelcomeGuideToken token = guideService.generateToken(id, orgId, null);
        String link = guideService.generateGuideLink(token);
        byte[] qrCode = guideService.generateQrCode(link, 300, 300);
        return ResponseEntity.ok()
            .contentType(MediaType.IMAGE_PNG)
            .body(qrCode);
    }

    /** Lien de partage + QR code (data URL base64) en un seul appel. */
    @PostMapping("/{id}/share")
    public ResponseEntity<Map<String, String>> share(@PathVariable Long id) {
        Long orgId = scopeOrgId();
        WelcomeGuideToken token = guideService.generateToken(id, orgId, null);
        String link = guideService.generateGuideLink(token);
        byte[] qr = guideService.generateQrCode(link, 300, 300);
        String qrDataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(qr);
        return ResponseEntity.ok(Map.of(
            "token", token.getToken().toString(),
            "link", link,
            "qrCode", qrDataUrl));
    }
}
