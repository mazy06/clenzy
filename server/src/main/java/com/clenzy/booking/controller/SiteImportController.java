package com.clenzy.booking.controller;

import com.clenzy.booking.dto.SiteImportResultDto;
import com.clenzy.booking.dto.SiteImportUrlRequest;
import com.clenzy.booking.service.SiteAdminService;
import com.clenzy.booking.service.SiteImportService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;

/**
 * Import d'une page/template externe par URL pour alimenter l'éditeur GrapesJS
 * du Studio (G3) — controller mince : validation + contrôle d'ownership +
 * délégation + mapping DTO. La logique (fetch SSRF-safe, parsing, sanitisation)
 * vit dans {@link SiteImportService}.
 *
 * <p><b>Sécurité</b> : {@code @PreAuthorize("isAuthenticated()")} au niveau
 * classe + validation d'ownership via {@link SiteAdminService#getSite} (le site
 * cible DOIT appartenir à l'organisation de l'appelant, sinon
 * {@code NotFoundException} → 404). Les garde-fous SSRF (HTTPS:443 épinglé,
 * pas de redirection, taille bornée) et l'assainissement HTML sont assurés par
 * le service.</p>
 */
@RestController
@RequestMapping("/api/sites")
@Tag(name = "Site Import", description = "Import de page externe par URL pour le Studio (GrapesJS)")
@PreAuthorize("isAuthenticated()")
public class SiteImportController {

    private final SiteImportService importService;
    private final SiteAdminService siteAdminService;
    private final TenantContext tenantContext;

    public SiteImportController(SiteImportService importService,
                                SiteAdminService siteAdminService,
                                TenantContext tenantContext) {
        this.importService = importService;
        this.siteAdminService = siteAdminService;
        this.tenantContext = tenantContext;
    }

    /**
     * Importe le HTML + CSS + assets de {@code url} pour le site {@code siteId}.
     *
     * @param siteId site cible — gate d'ownership : doit appartenir à l'org de l'appelant
     * @param req    URL HTTPS à importer
     */
    @PostMapping("/{siteId}/import-url")
    @Operation(summary = "Importer une page externe (HTML+CSS+assets) pour alimenter GrapesJS")
    public ResponseEntity<SiteImportResultDto> importUrl(@PathVariable Long siteId,
                                                         @Valid @RequestBody SiteImportUrlRequest req) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        // Gate d'ownership : lève NotFoundException si le site n'appartient pas à l'org (audit #3).
        siteAdminService.getSite(orgId, siteId);
        try {
            return ResponseEntity.ok(importService.importFromUrl(req.url()));
        } catch (IOException e) {
            // Échec en amont (cible externe injoignable / réponse non-200) → 502, pas 500.
            // L'IllegalArgumentException (rejet SSRF / URL invalide) se propage → 400 (handler global).
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Impossible de récupérer la page : " + e.getMessage());
        }
    }
}
