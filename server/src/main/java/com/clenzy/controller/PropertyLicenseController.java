package com.clenzy.controller;

import com.clenzy.dto.PropertyLicenseDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.service.PropertyLicenseService;
import com.clenzy.service.PropertyService;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Licences & autorisations d'un logement (fiche logement > Conformité).
 * Vague M-A des modèles métier de la constellation — alimente la carte
 * LICENSE_RENEWAL de l'agent Conformité.
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/licenses")
@PreAuthorize("isAuthenticated()")
public class PropertyLicenseController {

    /**
     * Ecriture reservee a l'exploitation : le numero d'enregistrement s'affiche sur les
     * annonces et engage l'exploitant — ni un prestataire ni un proprietaire tiers ne le modifie.
     */
    private static final String WRITE_ROLES = "hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')";

    private final PropertyLicenseService licenseService;
    private final PropertyService propertyService;
    private final OrganizationAccessGuard organizationAccessGuard;
    private final TenantContext tenantContext;

    public PropertyLicenseController(PropertyLicenseService licenseService,
                                     PropertyService propertyService,
                                     OrganizationAccessGuard organizationAccessGuard,
                                     TenantContext tenantContext) {
        this.licenseService = licenseService;
        this.propertyService = propertyService;
        this.organizationAccessGuard = organizationAccessGuard;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Lister les licences/autorisations d'un logement")
    public ResponseEntity<List<PropertyLicenseDto>> list(@PathVariable Long propertyId) {
        checkAccess(propertyId);
        return ResponseEntity.ok(licenseService.list(propertyId, tenantContext.getRequiredOrganizationId()));
    }

    @PostMapping
    @PreAuthorize(WRITE_ROLES)
    @Operation(summary = "Ajouter une licence/autorisation")
    public ResponseEntity<PropertyLicenseDto> create(@PathVariable Long propertyId,
                                                     @RequestBody PropertyLicenseDto request) {
        checkAccess(propertyId);
        return ResponseEntity.ok(licenseService.create(
                propertyId, tenantContext.getRequiredOrganizationId(), request));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE_ROLES)
    @Operation(summary = "Modifier une licence/autorisation")
    public ResponseEntity<PropertyLicenseDto> update(@PathVariable Long propertyId,
                                                     @PathVariable Long id,
                                                     @RequestBody PropertyLicenseDto request) {
        checkAccess(propertyId);
        return ResponseEntity.ok(licenseService.update(
                id, propertyId, tenantContext.getRequiredOrganizationId(), request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(WRITE_ROLES)
    @Operation(summary = "Supprimer une licence/autorisation")
    public ResponseEntity<Void> delete(@PathVariable Long propertyId, @PathVariable Long id) {
        checkAccess(propertyId);
        licenseService.delete(id, propertyId, tenantContext.getRequiredOrganizationId());
        return ResponseEntity.noContent().build();
    }

    /** Ownership : le logement doit appartenir à l'org du requester (règle audit n°3). */
    private void checkAccess(Long propertyId) {
        final var property = propertyService.getPropertyEntityById(propertyId);
        if (property == null) {
            throw new NotFoundException("Propriété introuvable");
        }
        organizationAccessGuard.requireSameOrganization(
                property.getOrganizationId(), "Vous n'avez pas accès à cette propriété");
    }
}
