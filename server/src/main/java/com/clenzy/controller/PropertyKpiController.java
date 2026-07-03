package com.clenzy.controller;

import com.clenzy.dto.PropertyKpiSummaryDto;
import com.clenzy.dto.PropertyPerformanceDto;
import com.clenzy.service.PropertyKpiSummaryService;
import com.clenzy.service.PropertyPerformanceService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * KPI operationnels batches des proprietes (cartes de la liste). Org-scope
 * strict via le contexte tenant. Controller mince : delegation + DTO.
 */
@RestController
@RequestMapping("/api/properties")
@PreAuthorize("isAuthenticated()")
public class PropertyKpiController {

    private final PropertyKpiSummaryService propertyKpiSummaryService;
    private final PropertyPerformanceService propertyPerformanceService;
    private final TenantContext tenantContext;

    public PropertyKpiController(PropertyKpiSummaryService propertyKpiSummaryService,
                                 PropertyPerformanceService propertyPerformanceService,
                                 TenantContext tenantContext) {
        this.propertyKpiSummaryService = propertyKpiSummaryService;
        this.propertyPerformanceService = propertyPerformanceService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/kpi-summaries")
    public List<PropertyKpiSummaryDto> getKpiSummaries(@RequestParam("ids") List<Long> ids) {
        return propertyKpiSummaryService.getSummaries(
            tenantContext.getRequiredOrganizationId(), ids, LocalDate.now());
    }

    /**
     * Classement de performance des logements ACTIFS de l'org (score /100 + sous-métriques),
     * sur une fenêtre glissante. Alimente la carte « Performance par logement » du dashboard.
     */
    @GetMapping("/performance-summaries")
    public List<PropertyPerformanceDto> getPerformanceSummaries(
            @RequestParam(name = "days", required = false, defaultValue = "90") int days) {
        return propertyPerformanceService.computeSummaries(
            tenantContext.getRequiredOrganizationId(), days);
    }
}
