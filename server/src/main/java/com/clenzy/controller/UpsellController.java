package com.clenzy.controller;

import com.clenzy.dto.UpsellOfferDto;
import com.clenzy.dto.UpsellOfferRequest;
import com.clenzy.dto.UpsellOrderDto;
import com.clenzy.service.UpsellService;
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
    private final TenantContext tenantContext;

    public UpsellController(UpsellService upsellService, TenantContext tenantContext) {
        this.upsellService = upsellService;
        this.tenantContext = tenantContext;
    }

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
