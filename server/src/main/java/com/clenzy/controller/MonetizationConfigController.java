package com.clenzy.controller;

import com.clenzy.dto.MonetizationConfigDto;
import com.clenzy.service.MonetizationConfigService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Taux de monétisation par org (Paramètres › Paiement), sur deux niveaux d'accès :
 * <ul>
 *   <li>{@code GET} — lecture (HOST + staff) pour afficher les deux niveaux.</li>
 *   <li>{@code PUT /platform} — commission PLATEFORME, <b>staff uniquement</b>.</li>
 *   <li>{@code PUT /org} — commission ORG/conciergerie, éditable par l'org/host.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/monetization-config")
public class MonetizationConfigController {

    private final MonetizationConfigService service;
    private final TenantContext tenantContext;

    public MonetizationConfigController(MonetizationConfigService service, TenantContext tenantContext) {
        this.service = service;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<MonetizationConfigDto> get() {
        return ResponseEntity.ok(service.getSettings(tenantContext.getRequiredOrganizationId()));
    }

    /** Commission plateforme — réservé au staff plateforme. */
    @PutMapping("/platform")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<MonetizationConfigDto> updatePlatform(@RequestBody MonetizationConfigDto request) {
        return ResponseEntity.ok(service.updatePlatform(
            tenantContext.getRequiredOrganizationId(),
            request.upsellPlatformFeePct(), request.activityPlatformCommissionPct()));
    }

    /** Commission org/conciergerie — éditable par l'org/host. */
    @PutMapping("/org")
    @PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<MonetizationConfigDto> updateOrg(@RequestBody MonetizationConfigDto request) {
        return ResponseEntity.ok(service.updateOrg(
            tenantContext.getRequiredOrganizationId(),
            request.upsellOrgCommissionPct(), request.activityOrgCommissionPct()));
    }
}
