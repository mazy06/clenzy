package com.clenzy.controller;

import com.clenzy.dto.AmenityIconOverrideDto;
import com.clenzy.service.AmenityIconOverrideService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * API REST pour la personnalisation des icones de commodites par organisation.
 *
 * <p><b>Securite</b> : tous les endpoints sont restreints aux roles ayant
 * acces a la gestion des commodites (HOST/SUPERVISOR/SUPER_*) — meme niveau
 * que la page AmenityMappingPage cote frontend.</p>
 *
 * <p>L'organizationId provient du TenantContext (extrait du JWT). Pas de
 * lookup cross-org possible : l'API ne traite que les overrides de l'org du
 * caller. Le frontend doit changer de tenant via Keycloak pour modifier
 * ceux d'une autre org.</p>
 */
@RestController
@RequestMapping("/api/amenities/icon-overrides")
@PreAuthorize("hasAnyRole('HOST', 'SUPERVISOR', 'SUPER_ADMIN', 'SUPER_MANAGER')")
public class AmenityIconOverrideController {

    private final AmenityIconOverrideService service;
    private final TenantContext tenantContext;

    public AmenityIconOverrideController(AmenityIconOverrideService service, TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    /**
     * GET /api/amenities/icon-overrides
     *
     * <p>Retourne tous les overrides d'icones definis pour l'organisation
     * courante. Tableau vide si l'org n'a rien personnalise.</p>
     */
    @GetMapping
    public ResponseEntity<List<AmenityIconOverrideDto>> list() {
        Long orgId = tenantContext.getOrganizationId();
        return ResponseEntity.ok(service.listForOrganization(orgId));
    }

    /**
     * PUT /api/amenities/icon-overrides/{amenityCode}
     *
     * <p>Cree ou met a jour l'override pour le code donne. Idempotent.
     * Le body contient {@code { iconName: "..." }}.</p>
     */
    @PutMapping("/{amenityCode}")
    public ResponseEntity<AmenityIconOverrideDto> upsert(
            @PathVariable String amenityCode,
            @RequestBody UpsertRequest body
    ) {
        Long orgId = tenantContext.getOrganizationId();
        AmenityIconOverrideDto result = service.upsert(orgId, amenityCode, body.iconName());
        return ResponseEntity.ok(result);
    }

    /**
     * DELETE /api/amenities/icon-overrides/{amenityCode}
     *
     * <p>Supprime l'override = retour a l'icone par defaut Clenzy. Idempotent
     * (204 si l'override n'existait pas).</p>
     */
    @DeleteMapping("/{amenityCode}")
    public ResponseEntity<Void> delete(@PathVariable String amenityCode) {
        Long orgId = tenantContext.getOrganizationId();
        service.delete(orgId, amenityCode);
        return ResponseEntity.noContent().build();
    }

    /** Body PUT — explicite plutot que de prendre le DTO complet (amenityCode est dans le path). */
    public record UpsertRequest(String iconName) {}
}
