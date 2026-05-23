package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.dto.ChannexConnectRequest;
import com.clenzy.integration.channex.dto.ChannexMappingDto;
import com.clenzy.integration.channex.service.ChannexConnectService;
import com.clenzy.integration.channex.service.ChannexSyncService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Onboarding et gestion des mappings Channel Manager Channex.
 *
 * <p>Endpoints reserves aux administrateurs / managers d'organisation (les
 * mappings impactent la distribution sur les OTAs — operation critique).</p>
 */
@RestController
@RequestMapping("/api/integrations/channex")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
@Tag(name = "Integration Channex", description = "Onboarding et gestion des mappings Channel Manager Channex")
public class ChannexConnectController {

    private final ChannexConnectService connectService;
    private final TenantContext tenantContext;

    public ChannexConnectController(ChannexConnectService connectService, TenantContext tenantContext) {
        this.connectService = connectService;
        this.tenantContext = tenantContext;
    }

    /**
     * Liste les mappings actifs de l'organisation.
     */
    @GetMapping("/mappings")
    @Operation(summary = "Liste tous les mappings Channex de l'organisation")
    public List<ChannexMappingDto> listMappings() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return connectService.list(orgId).stream().map(ChannexMappingDto::from).toList();
    }

    /**
     * Recupere le mapping d'une property specifique.
     */
    @GetMapping("/properties/{clenzyPropertyId}/mapping")
    @Operation(summary = "Recupere le mapping Channex d'une propriete")
    public ResponseEntity<ChannexMappingDto> getMapping(@PathVariable Long clenzyPropertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return connectService.getByPropertyId(clenzyPropertyId, orgId)
            .map(ChannexMappingDto::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Connecte une property a Channex (importe les IDs Channex existants
     * + cree le mapping + push initial 6 mois).
     */
    @PostMapping("/properties/{clenzyPropertyId}/connect")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Connecte une propriete Clenzy a son equivalent Channex")
    public ChannexMappingDto connect(@PathVariable Long clenzyPropertyId,
                                       @Valid @RequestBody ChannexConnectRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ChannexMappingDto.from(connectService.connect(clenzyPropertyId, orgId, request));
    }

    /**
     * Deconnecte une property de Channex (supprime le mapping local — la property
     * Channex reste presente cote dashboard Channex).
     */
    @DeleteMapping("/properties/{clenzyPropertyId}/disconnect")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Deconnecte une propriete de Channex (mapping local supprime)")
    public void disconnect(@PathVariable Long clenzyPropertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        connectService.disconnect(clenzyPropertyId, orgId);
    }

    /**
     * Force un re-push complet d'une property (utile pour recuperer un mapping ERROR
     * ou apres un changement de prix significatif).
     */
    @PostMapping("/properties/{clenzyPropertyId}/resync")
    @Operation(summary = "Re-push complet d'une propriete (1 a 12 mois)")
    public ChannexSyncService.ChannexSyncResult resync(@PathVariable Long clenzyPropertyId,
                                                        @RequestParam(defaultValue = "6") int months) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return connectService.resync(clenzyPropertyId, orgId, months);
    }
}
