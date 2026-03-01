package com.clenzy.controller;

import com.clenzy.dto.RegulatoryComplianceDto;
import com.clenzy.model.RegulatoryConfig;
import com.clenzy.service.RegulatoryComplianceService;
import com.clenzy.tenant.TenantContext;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.Year;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/regulatory")
public class RegulatoryController {

    private final RegulatoryComplianceService complianceService;
    private final TenantContext tenantContext;

    public RegulatoryController(RegulatoryComplianceService complianceService,
                                 TenantContext tenantContext) {
        this.complianceService = complianceService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/configs")
    public List<RegulatoryConfig> getAllConfigs() {
        return complianceService.getAllConfigs(tenantContext.getOrganizationId());
    }

    @GetMapping("/configs/{propertyId}")
    public List<RegulatoryConfig> getPropertyConfigs(@PathVariable Long propertyId) {
        return complianceService.getConfigs(propertyId, tenantContext.getOrganizationId());
    }

    @PutMapping("/configs")
    public RegulatoryConfig saveConfig(@RequestBody RegulatoryConfig config) {
        config.setOrganizationId(tenantContext.getOrganizationId());
        return complianceService.saveConfig(config);
    }

    @GetMapping("/alur/{propertyId}")
    public RegulatoryComplianceDto checkAlur(
            @PathVariable Long propertyId,
            @RequestParam(defaultValue = "0") int year) {
        if (year == 0) year = Year.now().getValue();
        return complianceService.checkAlurCompliance(
            propertyId, tenantContext.getOrganizationId(), year);
    }

    @GetMapping("/alur")
    public List<RegulatoryComplianceDto> checkAllAlur(
            @RequestParam(defaultValue = "0") int year) {
        if (year == 0) year = Year.now().getValue();
        return complianceService.checkAllAlurCompliance(
            tenantContext.getOrganizationId(), year);
    }

    @GetMapping("/alur/check")
    public Map<String, Object> wouldExceedLimit(
            @RequestParam Long propertyId,
            @RequestParam LocalDate checkIn,
            @RequestParam LocalDate checkOut) {
        boolean exceeds = complianceService.wouldExceedAlurLimit(
            propertyId, tenantContext.getOrganizationId(), checkIn, checkOut);
        return Map.of("wouldExceed", exceeds);
    }
}
