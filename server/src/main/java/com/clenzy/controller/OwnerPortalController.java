package com.clenzy.controller;

import com.clenzy.dto.OwnerDashboardDto;
import com.clenzy.dto.OwnerStatementDto;
import com.clenzy.service.OwnerPortalService;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/owner-portal")
public class OwnerPortalController {

    private final OwnerPortalService ownerPortalService;
    private final TenantContext tenantContext;

    public OwnerPortalController(OwnerPortalService ownerPortalService,
                                  TenantContext tenantContext) {
        this.ownerPortalService = ownerPortalService;
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
}
