package com.clenzy.controller;

import com.clenzy.dto.AnomalyDto;
import com.clenzy.service.AnomalyDetectionService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Détection d'anomalies (Phase 4) — controller mince (audit #4) : délègue au
 * {@link AnomalyDetectionService} (requête org-scopée, pas de repo ici).
 */
@RestController
@RequestMapping("/api/anomalies")
@PreAuthorize("isAuthenticated()")
public class AnomalyController {

    private final AnomalyDetectionService service;
    private final TenantContext tenantContext;

    public AnomalyController(AnomalyDetectionService service, TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<List<AnomalyDto>> detect(@RequestParam Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(service.detectForProperty(orgId, propertyId));
    }
}
