package com.clenzy.controller;

import com.clenzy.dto.FiscalProfileDto;
import com.clenzy.service.FiscalProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Controller REST pour la gestion du profil fiscal de l'organisation courante.
 *
 * Endpoints :
 * - GET  /api/fiscal-profile       → profil fiscal courant
 * - PUT  /api/fiscal-profile       → mise a jour du profil fiscal
 */
@RestController
@RequestMapping("/api/fiscal-profile")
@PreAuthorize("isAuthenticated()")
public class FiscalProfileController {

    private final FiscalProfileService fiscalProfileService;
    private final com.clenzy.service.BaitlyFiscalJurisdictions jurisdictions;
    private final com.clenzy.service.OrganizationService access;
    private final com.clenzy.tenant.TenantContext tenant;

    public FiscalProfileController(FiscalProfileService fiscalProfileService,com.clenzy.service.BaitlyFiscalJurisdictions jurisdictions,
            com.clenzy.service.OrganizationService access,com.clenzy.tenant.TenantContext tenant) {
        this.fiscalProfileService = fiscalProfileService;
        this.jurisdictions=jurisdictions;this.access=access;this.tenant=tenant;
    }

    /**
     * Retourne le profil fiscal de l'organisation courante.
     * Retourne un brouillon non enregistré si le profil n'existe pas.
     */
    @GetMapping
    public ResponseEntity<FiscalProfileDto> getCurrentProfile() {
        return ResponseEntity.ok(fiscalProfileService.getCurrentProfile());
    }

    /**
     * Met a jour le profil fiscal de l'organisation courante.
     */
    @PutMapping
    public ResponseEntity<FiscalProfileDto> updateProfile(@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt,@RequestBody FiscalProfileDto dto) {
        access.validateOrgManagement(jwt.getSubject(),tenant.getRequiredOrganizationId());
        // Compatibilité des anciens clients : éditer le pays demandé sans déplacer le profil principal.
        return ResponseEntity.ok(jurisdictions.update(dto.countryCode(),dto));
    }

    @GetMapping("/countries")
    public java.util.List<FiscalProfileDto> countries(){return jurisdictions.list();}

    @GetMapping("/countries/{country}")
    public FiscalProfileDto country(@PathVariable String country){return jurisdictions.get(country);}

    @PutMapping("/countries/{country}")
    public FiscalProfileDto updateCountry(@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt,
            @PathVariable String country,@RequestBody FiscalProfileDto dto) {
        access.validateOrgManagement(jwt.getSubject(),tenant.getRequiredOrganizationId());
        return jurisdictions.update(country,dto);
    }
}
