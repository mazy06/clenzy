package com.clenzy.controller;

import com.clenzy.dto.DashboardOverviewSummaryDto;
import com.clenzy.model.UserRole;
import com.clenzy.service.DashboardOverviewSummaryService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint agrégé de l'écran Dashboard « Vue d'ensemble ».
 *
 * <p>Org-scope strict : l'organisation vient du contexte tenant (jamais d'ID en
 * paramètre) ; le rôle vient du JWT et restreint le périmètre dans le service
 * (HOST → ses logements, opérationnels → leurs interventions). Controller
 * mince : validation du paramètre + délégation + DTO.</p>
 */
@RestController
@RequestMapping("/api/dashboard")
@PreAuthorize("isAuthenticated()")
public class DashboardOverviewController {

    private final DashboardOverviewSummaryService summaryService;
    private final TenantContext tenantContext;

    public DashboardOverviewController(DashboardOverviewSummaryService summaryService,
                                       TenantContext tenantContext) {
        this.summaryService = summaryService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/overview-summary")
    public DashboardOverviewSummaryDto getOverviewSummary(
            @RequestParam(name = "period", defaultValue = "month") String period,
            @AuthenticationPrincipal Jwt jwt) {
        final int days = switch (period) {
            case "week" -> 7;
            case "month" -> 30;
            case "quarter" -> 90;
            case "year" -> 365;
            default -> throw new IllegalArgumentException("Période invalide: " + period);
        };
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        return summaryService.getSummary(
                tenantContext.getRequiredOrganizationId(), days, role, jwt.getSubject());
    }
}
