package com.clenzy.controller;

import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.dto.TouristTaxConfigDto;
import com.clenzy.dto.TouristTaxConfigRequest;
import com.clenzy.service.TouristTaxService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/tourist-tax")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class TouristTaxController {

    private final TouristTaxService taxService;
    private final TenantContext tenantContext;

    public TouristTaxController(TouristTaxService taxService, TenantContext tenantContext) {
        this.taxService = taxService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<TouristTaxConfigDto> getConfigs() {
        return taxService.getAllConfigs(tenantContext.getOrganizationId()).stream()
            .map(TouristTaxConfigDto::from)
            .toList();
    }

    @GetMapping("/{propertyId}")
    public TouristTaxConfigDto getConfig(@PathVariable Long propertyId) {
        return taxService.getConfigForProperty(propertyId, tenantContext.getOrganizationId())
            .map(TouristTaxConfigDto::from)
            .orElseThrow(() -> new IllegalArgumentException("No tax config for property: " + propertyId));
    }

    @PutMapping
    public TouristTaxConfigDto saveConfig(@RequestBody TouristTaxConfigRequest request) {
        return TouristTaxConfigDto.from(
            taxService.upsertConfig(request, tenantContext.getOrganizationId()));
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
