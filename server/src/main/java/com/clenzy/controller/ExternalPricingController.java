package com.clenzy.controller;

import com.clenzy.dto.ExternalPriceRecommendation;
import com.clenzy.dto.ExternalPricingConfigDto;
import com.clenzy.dto.UpdateExternalPricingConfigRequest;
import com.clenzy.model.ExternalPricingConfig;
import com.clenzy.model.PricingProvider;
import com.clenzy.service.ExternalPricingSyncService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/external-pricing")
public class ExternalPricingController {

    private final ExternalPricingSyncService syncService;
    private final TenantContext tenantContext;

    public ExternalPricingController(ExternalPricingSyncService syncService,
                                     TenantContext tenantContext) {
        this.syncService = syncService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<ExternalPricingConfigDto> getConfigs() {
        Long orgId = tenantContext.getOrganizationId();
        return syncService.getAllConfigs(orgId).stream()
            .map(ExternalPricingConfigDto::from).toList();
    }

    @PutMapping
    public ExternalPricingConfigDto updateConfig(@Valid @RequestBody UpdateExternalPricingConfigRequest request) {
        Long orgId = tenantContext.getOrganizationId();

        ExternalPricingConfig config;
        try {
            config = syncService.getConfig(orgId, request.provider());
        } catch (IllegalArgumentException e) {
            config = new ExternalPricingConfig();
            config.setOrganizationId(orgId);
            config.setProvider(request.provider());
        }

        if (request.apiKey() != null) config.setApiKey(request.apiKey());
        if (request.apiUrl() != null) config.setApiUrl(request.apiUrl());
        if (request.propertyMappings() != null) config.setPropertyMappings(request.propertyMappings());
        if (request.enabled() != null) config.setEnabled(request.enabled());
        if (request.syncIntervalHours() != null) config.setSyncIntervalHours(request.syncIntervalHours());

        return ExternalPricingConfigDto.from(syncService.saveConfig(config));
    }

    @PostMapping("/sync")
    @ResponseStatus(HttpStatus.OK)
    public int sync() {
        Long orgId = tenantContext.getOrganizationId();
        return syncService.syncPricesForOrg(orgId);
    }

    @GetMapping("/recommendations/{propertyId}")
    public List<ExternalPriceRecommendation> getRecommendations(
            @PathVariable Long propertyId,
            @RequestParam(defaultValue = "PRICELABS") PricingProvider provider) {
        Long orgId = tenantContext.getOrganizationId();
        return syncService.getRecommendations(propertyId, orgId, provider);
    }
}
