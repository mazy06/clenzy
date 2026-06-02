package com.clenzy.controller;

import com.clenzy.dto.MarketingIntegrationDto;
import com.clenzy.integration.brevo.BrevoApiClient;
import com.clenzy.service.MarketingIntegrationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Administration de la configuration d'integration marketing (Brevo).
 *
 * Reserve aux SUPER_ADMIN / SUPER_MANAGER (config plateforme). La cle API n'est
 * jamais renvoyee en clair (DTO masque). Gere via la section « Marketing &
 * Newsletter » de la tab Settings > Integrations.
 */
@RestController
@RequestMapping("/api/admin/marketing-integration")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class MarketingIntegrationController {

    private final MarketingIntegrationService service;

    public MarketingIntegrationController(MarketingIntegrationService service) {
        this.service = service;
    }

    // ─── Requetes ───────────────────────────────────────────────────────────
    public record UpdateApiKeyRequest(String apiKey) {}
    public record UpdateListsRequest(Long waitlistListId, Long newsletterListId, Long prospectsListId) {}
    public record UpdateTogglesRequest(Boolean syncWaitlist, Boolean syncNewsletter,
                                       Boolean syncProspects, Boolean syncAttributes) {}

    @GetMapping
    public ResponseEntity<MarketingIntegrationDto> get() {
        return ResponseEntity.ok(MarketingIntegrationDto.from(service.getOrCreate()));
    }

    @PutMapping("/api-key")
    public ResponseEntity<MarketingIntegrationDto> updateApiKey(@RequestBody UpdateApiKeyRequest req,
                                                               @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(MarketingIntegrationDto.from(
                service.updateApiKey(req.apiKey(), actor(jwt))));
    }

    @PutMapping("/lists")
    public ResponseEntity<MarketingIntegrationDto> updateLists(@RequestBody UpdateListsRequest req,
                                                              @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(MarketingIntegrationDto.from(
                service.updateLists(req.waitlistListId(), req.newsletterListId(), req.prospectsListId(), actor(jwt))));
    }

    @PutMapping("/toggles")
    public ResponseEntity<MarketingIntegrationDto> updateToggles(@RequestBody UpdateTogglesRequest req,
                                                                @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(MarketingIntegrationDto.from(
                service.updateToggles(req.syncWaitlist(), req.syncNewsletter(),
                        req.syncProspects(), req.syncAttributes(), actor(jwt))));
    }

    /** Teste la cle effective contre l'API Brevo et persiste le statut. */
    @PostMapping("/test")
    public ResponseEntity<MarketingIntegrationService.TestResult> test() {
        return ResponseEntity.ok(service.testConnection());
    }

    /** Liste les listes Brevo (pour peupler les menus de mapping). */
    @GetMapping("/brevo-lists")
    public ResponseEntity<List<BrevoApiClient.BrevoList>> brevoLists() {
        return ResponseEntity.ok(service.listBrevoLists());
    }

    private static String actor(Jwt jwt) {
        if (jwt == null) return "system";
        String email = jwt.getClaimAsString("email");
        if (email != null && !email.isBlank()) return email;
        String username = jwt.getClaimAsString("preferred_username");
        return (username != null && !username.isBlank()) ? username : jwt.getSubject();
    }
}
