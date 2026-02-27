package com.clenzy.controller;

import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.model.TouristTaxConfig;
import com.clenzy.service.TouristTaxService;
import com.clenzy.tenant.TenantContext;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/tourist-tax")
public class TouristTaxController {

    private final TouristTaxService taxService;
    private final TenantContext tenantContext;

    public TouristTaxController(TouristTaxService taxService, TenantContext tenantContext) {
        this.taxService = taxService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<TouristTaxConfig> getConfigs() {
        return taxService.getAllConfigs(tenantContext.getOrganizationId());
    }

    @GetMapping("/{propertyId}")
    public TouristTaxConfig getConfig(@PathVariable Long propertyId) {
        return taxService.getConfigForProperty(propertyId, tenantContext.getOrganizationId())
            .orElseThrow(() -> new IllegalArgumentException("No tax config for property: " + propertyId));
    }

    @PutMapping
    public TouristTaxConfig saveConfig(@RequestBody TouristTaxConfig config) {
        config.setOrganizationId(tenantContext.getOrganizationId());
        return taxService.saveConfig(config);
    }

    @GetMapping("/calculate/{propertyId}")
    public TouristTaxCalculationDto calculate(
            @PathVariable Long propertyId,
            @RequestParam int nights,
            @RequestParam int guests,
            @RequestParam(defaultValue = "100") BigDecimal nightlyRate) {
        return taxService.calculate(propertyId, tenantContext.getOrganizationId(),
            nights, guests, nightlyRate);
    }
}
