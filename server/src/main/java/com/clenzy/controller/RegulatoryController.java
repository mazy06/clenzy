package com.clenzy.controller;

import com.clenzy.dto.FrRegulatoryProfileDto;
import com.clenzy.dto.RegulatoryComplianceDto;
import com.clenzy.dto.RegulatoryConfigDto;
import com.clenzy.dto.RegulatoryConfigRequest;
import com.clenzy.service.RegulatoryComplianceService;
import com.clenzy.service.regulatory.FrRegulatoryProfileService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.Year;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/regulatory")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class RegulatoryController {

    private final RegulatoryComplianceService complianceService;
    private final FrRegulatoryProfileService frProfileService;
    private final TenantContext tenantContext;

    public RegulatoryController(RegulatoryComplianceService complianceService,
                                 FrRegulatoryProfileService frProfileService,
                                 TenantContext tenantContext) {
        this.complianceService = complianceService;
        this.frProfileService = frProfileService;
        this.tenantContext = tenantContext;
    }

    /** Profil reglementaire France du logement (logement charge borne a l'organisation). */
    @GetMapping("/properties/{propertyId}/fr-profile")
    public FrRegulatoryProfileDto getFrProfile(@PathVariable Long propertyId) {
        return frProfileService.get(propertyId, tenantContext.getRequiredOrganizationId());
    }

    /** Synthèse « Conformité France » de tous les logements situés en France. */
    @GetMapping("/fr/overview")
    public List<FrRegulatoryProfileService.OverviewRow> frOverview() {
        return frProfileService.overview(tenantContext.getRequiredOrganizationId());
    }

    @PutMapping("/properties/{propertyId}/fr-profile")
    public FrRegulatoryProfileDto updateFrProfile(@PathVariable Long propertyId,
                                                  @RequestBody FrRegulatoryProfileDto.Update request) {
        return frProfileService.update(propertyId, tenantContext.getRequiredOrganizationId(), request);
    }

    @GetMapping("/configs")
    public List<RegulatoryConfigDto> getAllConfigs() {
        return complianceService.getAllConfigs(tenantContext.getOrganizationId()).stream()
            .map(RegulatoryConfigDto::from)
            .toList();
    }

    @GetMapping("/configs/{propertyId}")
    public List<RegulatoryConfigDto> getPropertyConfigs(@PathVariable Long propertyId) {
        return complianceService.getConfigs(propertyId, tenantContext.getOrganizationId()).stream()
            .map(RegulatoryConfigDto::from)
            .toList();
    }

    @PutMapping("/configs")
    public RegulatoryConfigDto saveConfig(@RequestBody RegulatoryConfigRequest request) {
        return RegulatoryConfigDto.from(
            complianceService.upsertConfig(request, tenantContext.getOrganizationId()));
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
