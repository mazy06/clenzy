package com.clenzy.controller;

import com.clenzy.dto.IntegrationPartnerDto;
import com.clenzy.model.IntegrationPartner.IntegrationCategory;
import com.clenzy.service.MarketplaceService;
import com.clenzy.tenant.TenantContext;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/marketplace")
public class MarketplaceController {

    private final MarketplaceService marketplaceService;
    private final TenantContext tenantContext;

    public MarketplaceController(MarketplaceService marketplaceService,
                                  TenantContext tenantContext) {
        this.marketplaceService = marketplaceService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/catalog")
    public List<Map<String, String>> getCatalog() {
        return marketplaceService.getCatalog();
    }

    @GetMapping
    public List<IntegrationPartnerDto> getAll(
            @RequestParam(required = false) IntegrationCategory category) {
        Long orgId = tenantContext.getOrganizationId();
        if (category != null) return marketplaceService.getByCategory(category, orgId);
        return marketplaceService.getAllIntegrations(orgId);
    }

    @GetMapping("/connected")
    public List<IntegrationPartnerDto> getConnected() {
        return marketplaceService.getConnected(tenantContext.getOrganizationId());
    }

    @PostMapping("/initialize")
    public Map<String, Integer> initializeCatalog() {
        int count = marketplaceService.initializeCatalog(tenantContext.getOrganizationId());
        return Map.of("created", count);
    }

    @PutMapping("/{id}/connect")
    public IntegrationPartnerDto connect(@PathVariable Long id,
                                          @RequestBody Map<String, String> body) {
        String apiKey = body.get("apiKey");
        String config = body.get("config");
        return marketplaceService.connectIntegration(id, tenantContext.getOrganizationId(), apiKey, config);
    }

    @PutMapping("/{id}/disconnect")
    public IntegrationPartnerDto disconnect(@PathVariable Long id) {
        return marketplaceService.disconnectIntegration(id, tenantContext.getOrganizationId());
    }
}
