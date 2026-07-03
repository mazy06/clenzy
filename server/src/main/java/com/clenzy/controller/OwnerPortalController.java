package com.clenzy.controller;

import com.clenzy.dto.OwnerDashboardDto;
import com.clenzy.dto.OwnerPortalLinkDto;
import com.clenzy.dto.OwnerStatementDto;
import com.clenzy.service.OwnerConstellationService;
import com.clenzy.service.OwnerPortalService;
import com.clenzy.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/owner-portal")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class OwnerPortalController {

    private final OwnerPortalService ownerPortalService;
    private final OwnerConstellationService ownerConstellationService;
    private final TenantContext tenantContext;

    @Value("${FRONTEND_URL:http://localhost:3000}")
    private String frontendUrl;

    public OwnerPortalController(OwnerPortalService ownerPortalService,
                                  OwnerConstellationService ownerConstellationService,
                                  TenantContext tenantContext) {
        this.ownerPortalService = ownerPortalService;
        this.ownerConstellationService = ownerConstellationService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/dashboard/{ownerId}")
    public OwnerDashboardDto getDashboard(@PathVariable Long ownerId) {
        Long orgId = tenantContext.getOrganizationId();
        return ownerPortalService.getDashboard(ownerId, orgId);
    }

    @GetMapping("/statement/{ownerId}")
    public OwnerStatementDto getStatement(
            @PathVariable Long ownerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "") String ownerName) {
        Long orgId = tenantContext.getOrganizationId();
        return ownerPortalService.getStatement(ownerId, orgId, from, to, ownerName);
    }

    // ─── Constellation Proprietaire (campagne X9 v1) : liens publics ───────

    @PostMapping("/constellation-links/{ownerId}")
    public OwnerPortalLinkDto createConstellationLink(
            @PathVariable Long ownerId,
            @RequestParam(required = false) Integer validityDays) {
        Long orgId = tenantContext.getOrganizationId();
        return ownerConstellationService.createLink(orgId, ownerId, validityDays, frontendUrl);
    }

    @GetMapping("/constellation-links/{ownerId}")
    public List<OwnerPortalLinkDto> listConstellationLinks(@PathVariable Long ownerId) {
        Long orgId = tenantContext.getOrganizationId();
        return ownerConstellationService.listLinks(orgId, ownerId, frontendUrl);
    }

    @PostMapping("/constellation-links/{linkId}/revoke")
    public void revokeConstellationLink(@PathVariable Long linkId) {
        Long orgId = tenantContext.getOrganizationId();
        ownerConstellationService.revokeLink(orgId, linkId);
    }

    // ─── Branding white-label de la page proprietaire (campagne X9-b) ──────

    /** Corps du PUT branding — valide serveur (HTTPS only, hex #RRGGBB). */
    public record BrandingRequest(String logoUrl, String primaryColor) {}

    @GetMapping("/branding")
    public java.util.Map<String, String> getBranding() {
        return ownerConstellationService.getBranding(tenantContext.getOrganizationId());
    }

    @PutMapping("/branding")
    public java.util.Map<String, String> updateBranding(@RequestBody BrandingRequest request) {
        return ownerConstellationService.updateBranding(
                tenantContext.getOrganizationId(), request.logoUrl(), request.primaryColor());
    }
}
