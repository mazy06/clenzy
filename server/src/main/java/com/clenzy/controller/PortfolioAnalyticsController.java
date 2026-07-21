package com.clenzy.controller;

import com.clenzy.dto.analytics.PortfolioAnalyticsDto;
import com.clenzy.service.PortfolioAnalyticsService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Analytics agrégées du portefeuille (org) — rapatriement serveur des slices
 * global / revenue / occupancy du dashboard. Org résolue via {@code TenantContext}
 * (jamais d'ID en paramètre). Même mapping {@code period -> days} que
 * {@code DashboardOverviewController}. Controller mince : validation + délégation.
 */
@RestController
@RequestMapping("/api/analytics/portfolio")
@PreAuthorize("isAuthenticated()")
public class PortfolioAnalyticsController {

    private final PortfolioAnalyticsService portfolioAnalyticsService;
    private final TenantContext tenantContext;

    public PortfolioAnalyticsController(PortfolioAnalyticsService portfolioAnalyticsService,
                                        TenantContext tenantContext) {
        this.portfolioAnalyticsService = portfolioAnalyticsService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public PortfolioAnalyticsDto getPortfolio(
            @RequestParam(name = "period", defaultValue = "month") String period) {
        final int days = switch (period) {
            case "week" -> 7;
            case "month" -> 30;
            case "quarter" -> 90;
            case "year" -> 365;
            default -> throw new IllegalArgumentException("Période invalide: " + period);
        };
        return portfolioAnalyticsService.getPortfolio(tenantContext.getRequiredOrganizationId(), days);
    }
}
