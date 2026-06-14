package com.clenzy.controller;

import com.clenzy.dto.PriceRecommendationDto;
import com.clenzy.service.PriceRecommendationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Recommandations de prix (CLZ-P0-17) — controller mince (audit #4) : délègue au
 * {@link PriceRecommendationService} qui valide l'ownership et applique les transitions par CAS.
 */
@RestController
@RequestMapping("/api/pricing/recommendations")
@PreAuthorize("isAuthenticated()")
public class PriceRecommendationController {

    private final PriceRecommendationService service;
    private final TenantContext tenantContext;

    public PriceRecommendationController(PriceRecommendationService service,
                                         TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<List<PriceRecommendationDto>> list(
            @RequestParam Long propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(service.list(orgId, propertyId, from, to));
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<Void> accept(@PathVariable Long id) {
        service.accept(tenantContext.getRequiredOrganizationId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<Void> reject(@PathVariable Long id) {
        service.reject(tenantContext.getRequiredOrganizationId(), id);
        return ResponseEntity.noContent().build();
    }
}
