package com.clenzy.controller;

import com.clenzy.dto.MarketPositioningDto;
import com.clenzy.service.marketdata.MarketPositioningService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Positionnement marché d'un bien (double signal réseau/marché) — consommé par le
 * panneau yield. Org via TenantContext ; l'ownership du bien est validé dans le
 * service (fail-closed). Controller mince.
 */
@RestController
@RequestMapping("/api/analytics/market-positioning")
@PreAuthorize("isAuthenticated()")
public class MarketPositioningController {

    private final MarketPositioningService positioningService;
    private final TenantContext tenantContext;

    public MarketPositioningController(MarketPositioningService positioningService,
                                       TenantContext tenantContext) {
        this.positioningService = positioningService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/{propertyId}")
    public MarketPositioningDto position(@PathVariable Long propertyId) {
        return positioningService.position(propertyId, tenantContext.getRequiredOrganizationId());
    }
}
