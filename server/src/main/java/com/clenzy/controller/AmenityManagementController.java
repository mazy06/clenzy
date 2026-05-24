package com.clenzy.controller;

import com.clenzy.dto.amenity.*;
import com.clenzy.service.AmenityManagementService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Gestion des commodites OTA :
 *
 * <ul>
 *   <li><b>Unmapped</b> : agregation des amenities OTA brutes qui n'ont pas
 *       encore d'alias / d'ignored.</li>
 *   <li><b>Custom amenities</b> : extension du referentiel Clenzy par l'org.</li>
 *   <li><b>Aliases</b> : mapping rawName → clenzyCode.</li>
 *   <li><b>Ignored</b> : noms a ignorer (nettoyent l'UI).</li>
 *   <li><b>Reprocess</b> : applique aliases + ignored aux properties existantes.</li>
 * </ul>
 *
 * <p>Accessible aux HOST + SUPER_*. La separation multi-tenant est imposee
 * par le {@link TenantContext}.</p>
 */
@RestController
@RequestMapping("/api/amenity-management")
@PreAuthorize("hasAnyRole('HOST', 'SUPERVISOR', 'SUPER_ADMIN', 'SUPER_MANAGER')")
@Tag(name = "Amenity Management",
     description = "Gestion des commodites OTA : aliases, custom amenities, ignored")
public class AmenityManagementController {

    private final AmenityManagementService service;
    private final TenantContext tenantContext;

    public AmenityManagementController(AmenityManagementService service,
                                         TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    // ─── Unmapped (lecture) ─────────────────────────────────────────────────

    @GetMapping("/unmapped")
    @Operation(summary = "Liste les amenities OTA brutes detectees, sans alias ni ignored")
    public List<UnmappedAmenityDto> listUnmapped() {
        return service.findUnmapped(tenantContext.getRequiredOrganizationId());
    }

    // ─── Custom Amenities ───────────────────────────────────────────────────

    @GetMapping("/custom")
    @Operation(summary = "Liste les commodites custom de l'organisation")
    public List<CustomAmenityDto> listCustom() {
        return service.listCustomAmenities(tenantContext.getRequiredOrganizationId());
    }

    @PostMapping("/custom")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cree une commodite custom (optionnellement + alias automatique)")
    public CustomAmenityDto createCustom(@Valid @RequestBody CreateCustomAmenityRequest req,
                                           @AuthenticationPrincipal Jwt jwt) {
        return service.createCustomAmenity(
            tenantContext.getRequiredOrganizationId(),
            jwt != null ? jwt.getSubject() : null,
            req);
    }

    @DeleteMapping("/custom/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprime une commodite custom (et ses aliases pointant dessus)")
    public void deleteCustom(@PathVariable Long id) {
        service.deleteCustomAmenity(tenantContext.getRequiredOrganizationId(), id);
    }

    // ─── Aliases ────────────────────────────────────────────────────────────

    @GetMapping("/aliases")
    @Operation(summary = "Liste les aliases rawName → clenzyCode de l'organisation")
    public List<AmenityAliasDto> listAliases() {
        return service.listAliases(tenantContext.getRequiredOrganizationId());
    }

    @PostMapping("/aliases")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cree un alias rawName → clenzyCode")
    public AmenityAliasDto createAlias(@Valid @RequestBody CreateAliasRequest req,
                                         @AuthenticationPrincipal Jwt jwt) {
        return service.createAlias(
            tenantContext.getRequiredOrganizationId(),
            jwt != null ? jwt.getSubject() : null,
            req);
    }

    @PostMapping("/aliases/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Bulk : map N rawNames sur un meme clenzyCode")
    public ReprocessResult bulkCreateAliases(@Valid @RequestBody CreateAliasRequest.BulkRequest req,
                                                @AuthenticationPrincipal Jwt jwt) {
        return service.bulkCreateAliases(
            tenantContext.getRequiredOrganizationId(),
            jwt != null ? jwt.getSubject() : null,
            req);
    }

    @DeleteMapping("/aliases/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Supprime un alias")
    public void deleteAlias(@PathVariable Long id) {
        service.deleteAlias(tenantContext.getRequiredOrganizationId(), id);
    }

    // ─── Ignored ────────────────────────────────────────────────────────────

    @GetMapping("/ignored")
    @Operation(summary = "Liste les noms d'amenities OTA explicitement ignores")
    public List<IgnoredAmenityDto> listIgnored() {
        return service.listIgnored(tenantContext.getRequiredOrganizationId());
    }

    @PostMapping("/ignored")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Marque un nom OTA comme a ignorer")
    public IgnoredAmenityDto createIgnored(@Valid @RequestBody CreateIgnoredRequest req,
                                             @AuthenticationPrincipal Jwt jwt) {
        return service.createIgnored(
            tenantContext.getRequiredOrganizationId(),
            jwt != null ? jwt.getSubject() : null,
            req);
    }

    @DeleteMapping("/ignored/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Retire un nom de la liste des ignores")
    public void deleteIgnored(@PathVariable Long id) {
        service.deleteIgnored(tenantContext.getRequiredOrganizationId(), id);
    }

    // ─── Reprocess ──────────────────────────────────────────────────────────

    @PostMapping("/reprocess")
    @Operation(summary = "Applique aliases + ignored a toutes les properties de l'org")
    public ResponseEntity<ReprocessResult> reprocess() {
        return ResponseEntity.ok(service.reprocess(tenantContext.getRequiredOrganizationId()));
    }

    // ─── Catalog Channex (suggestions UI) ───────────────────────────────────

    @GetMapping("/channex-facility-catalog")
    @Operation(summary = "Catalogue Channex des ~180 facilities standards (suggestions UI)")
    public List<com.clenzy.integration.channex.dto.ChannexFacilityOptionDto> listChannexFacilityCatalog() {
        return service.listChannexFacilityCatalog();
    }
}
