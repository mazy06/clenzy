package com.clenzy.controller;

import com.clenzy.dto.MonetizationConfigDto;
import com.clenzy.service.MonetizationConfigService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Taux de monétisation par org (part plateforme upsells / part hôte commissions
 * activités), édités dans Paramètres › Paiement. Réservé au staff plateforme,
 * comme la répartition des revenus ({@code SplitConfigurationController}).
 */
@RestController
@RequestMapping("/api/monetization-config")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class MonetizationConfigController {

    private final MonetizationConfigService service;
    private final TenantContext tenantContext;

    public MonetizationConfigController(MonetizationConfigService service, TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public ResponseEntity<MonetizationConfigDto> get() {
        return ResponseEntity.ok(service.getSettings(tenantContext.getRequiredOrganizationId()));
    }

    @PutMapping
    public ResponseEntity<MonetizationConfigDto> update(@RequestBody MonetizationConfigDto request) {
        return ResponseEntity.ok(service.updateSettings(
            tenantContext.getRequiredOrganizationId(),
            request.upsellPlatformFeePct(), request.activityHostSharePct()));
    }
}
