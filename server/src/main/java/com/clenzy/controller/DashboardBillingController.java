package com.clenzy.controller;

import com.clenzy.dto.BillingOverviewDto;
import com.clenzy.service.BillingOverviewService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Endpoint du widget dashboard « Versement + Revenus par canal ».
 *
 * <p>Org-scope strict : l'organisation et la devise sont resolues depuis le
 * contexte tenant (jamais d'ID en parametre), donc un utilisateur ne voit que
 * sa propre organisation. Controller mince : validation + delegation + DTO.</p>
 */
@RestController
@RequestMapping("/api/dashboard")
@PreAuthorize("isAuthenticated()")
public class DashboardBillingController {

    private final BillingOverviewService billingOverviewService;
    private final TenantContext tenantContext;

    public DashboardBillingController(BillingOverviewService billingOverviewService,
                                      TenantContext tenantContext) {
        this.billingOverviewService = billingOverviewService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/billing-overview")
    public BillingOverviewDto getBillingOverview(
            @RequestParam(name = "scope", defaultValue = "month") String scope) {
        return billingOverviewService.getBillingOverview(
            tenantContext.getRequiredOrganizationId(),
            tenantContext.getDefaultCurrency(),
            LocalDate.now(),
            scope);
    }
}
