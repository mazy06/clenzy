package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.sectors.MySectorMapService;
import com.clenzy.marketplace.sectors.ProviderSectorMapService;
import com.clenzy.marketplace.sectors.SectorMapDto;
import com.clenzy.model.UserRole;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Carte des secteurs d'intervention.
 *
 * <p>L'organisation vient du contexte tenant, jamais d'un paramètre. Un prestataire masqué
 * pour l'organisation répond 404, comme sa fiche catalogue : 403 confirmerait qu'il existe.</p>
 */
@RestController
@PreAuthorize("isAuthenticated()")
public class ProviderSectorMapController {

    private final ProviderSectorMapService providerSectors;
    private final MySectorMapService mySectors;
    private final TenantContext tenantContext;

    public ProviderSectorMapController(ProviderSectorMapService providerSectors, MySectorMapService mySectors,
                                       TenantContext tenantContext) {
        this.providerSectors = providerSectors;
        this.mySectors = mySectors;
        this.tenantContext = tenantContext;
    }

    /** Prestataires qui couvrent au moins un logement de l'organisation (calque de la carte Propriétés). */
    @GetMapping("/api/provider-catalog/sectors")
    public SectorMapDto relevant(@AuthenticationPrincipal Jwt jwt) {
        return providerSectors.relevantTo(tenantContext.getRequiredOrganizationId(), hostSubject(jwt));
    }

    /** Secteur d'un prestataire et logements couverts ou non (fiche prestataire). */
    @GetMapping("/api/provider-catalog/{id}/sectors")
    public ResponseEntity<SectorMapDto> provider(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return providerSectors.forProvider(id, tenantContext.getRequiredOrganizationId(), hostSubject(jwt))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Secteur du prestataire relié à un compte : l'intervenant d'une prestation (carte Propriétés). */
    @GetMapping("/api/provider-catalog/sectors/by-user/{userId}")
    public ResponseEntity<SectorMapDto> providerOfUser(@PathVariable Long userId, @AuthenticationPrincipal Jwt jwt) {
        return providerSectors.forProviderUser(userId, tenantContext.getRequiredOrganizationId(), hostSubject(jwt))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Secteur déclaré par l'intervenant connecté (Mon compte → Zone d'intervention). */
    @GetMapping("/api/my-coverage-zones/sectors")
    public SectorMapDto mine(@AuthenticationPrincipal Jwt jwt) {
        return mySectors.mine(jwt == null ? null : jwt.getSubject());
    }

    private static String hostSubject(Jwt jwt) {
        return jwt != null && JwtRoleExtractor.extractUserRole(jwt) == UserRole.HOST ? jwt.getSubject() : null;
    }
}
