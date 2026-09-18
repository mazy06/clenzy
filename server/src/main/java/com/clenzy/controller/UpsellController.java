package com.clenzy.controller;

import com.clenzy.dto.UpsellOfferDto;
import com.clenzy.dto.UpsellOfferRequest;
import com.clenzy.dto.UpsellOrderDto;
import com.clenzy.dto.UpsellTypeDto;
import com.clenzy.service.UpsellService;
import com.clenzy.service.UpsellTypeService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Gestion du catalogue d'upsells + suivi des ventes (côté hôte). */
@RestController
@RequestMapping("/api/upsells")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class UpsellController {

    private final UpsellService upsellService;
    private final UpsellTypeService upsellTypeService;
    private final TenantContext tenantContext;

    public UpsellController(UpsellService upsellService, UpsellTypeService upsellTypeService,
                            TenantContext tenantContext) {
        this.upsellTypeService = upsellTypeService;
        this.upsellService = upsellService;
        this.tenantContext = tenantContext;
    }

    // ─── Referentiel des types ───────────────────────────────────────────────

    /**
     * Types disponibles : ceux de la plateforme et ceux de l'organisation.
     *
     * <p>Remplace l'ancien enum de neuf valeurs. Le referentiel s'enrichit sans
     * deploiement, et embarque les soixante-neuf prestations du catalogue place
     * de marche vendables au voyageur.</p>
     */
    @GetMapping("/types")
    public ResponseEntity<List<UpsellTypeDto>> listTypes() {
        return ResponseEntity.ok(upsellTypeService.list());
    }

    @PostMapping("/types")
    public ResponseEntity<UpsellTypeDto> createType(@Valid @RequestBody UpsellTypeRequest request) {
        return ResponseEntity.ok(upsellTypeService.create(
            request.code(), request.label(), request.description(), request.iconKey()));
    }

    /** Retire le type du choix sans le supprimer : les offres existantes le portent encore. */
    @DeleteMapping("/types/{id}")
    public ResponseEntity<Void> deactivateType(@PathVariable Long id) {
        upsellTypeService.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    /** @param code identifiant stable ; derive du libelle s'il est absent */
    public record UpsellTypeRequest(
        @jakarta.validation.constraints.Size(max = 60) String code,
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 120) String label,
        @jakarta.validation.constraints.Size(max = 300) String description,
        @jakarta.validation.constraints.Size(max = 40) String iconKey
    ) {}

    // ─── Offres ──────────────────────────────────────────────────────────────

    @GetMapping("/offers")
    public ResponseEntity<List<UpsellOfferDto>> listOffers() {
        return ResponseEntity.ok(upsellService.listOffers(tenantContext.getOrganizationId()));
    }

    @PostMapping("/offers")
    public ResponseEntity<UpsellOfferDto> createOffer(@Valid @RequestBody UpsellOfferRequest request) {
        return ResponseEntity.ok(upsellService.createOffer(tenantContext.getOrganizationId(), request));
    }

    @PutMapping("/offers/{id}")
    public ResponseEntity<UpsellOfferDto> updateOffer(@PathVariable Long id,
                                                      @Valid @RequestBody UpsellOfferRequest request) {
        return ResponseEntity.ok(upsellService.updateOffer(tenantContext.getOrganizationId(), id, request));
    }

    @DeleteMapping("/offers/{id}")
    public ResponseEntity<Void> deleteOffer(@PathVariable Long id) {
        upsellService.deleteOffer(tenantContext.getOrganizationId(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/orders")
    public ResponseEntity<List<UpsellOrderDto>> listOrders() {
        return ResponseEntity.ok(upsellService.listOrders(tenantContext.getOrganizationId()));
    }
}
