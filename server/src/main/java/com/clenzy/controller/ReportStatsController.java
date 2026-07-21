package com.clenzy.controller;

import com.clenzy.dto.ReportFinancialStatsDto;
import com.clenzy.dto.ReportInterventionStatsDto;
import com.clenzy.dto.ReportPropertyStatsDto;
import com.clenzy.dto.ReportTeamStatsDto;
import com.clenzy.service.ReportStatsService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints agrégés de l'écran Rapports Baitly — un fetch léger par onglet,
 * en remplacement du téléchargement de listes {@code size=1000} côté client.
 *
 * <p>Org-scope strict : l'organisation vient du contexte tenant (jamais d'ID
 * en paramètre) ; le rôle vient du JWT et restreint le périmètre dans le
 * service (HOST → ses logements, opérationnels → leurs interventions).
 * Controller mince : délégation + DTO, aucune logique métier.</p>
 */
@RestController
@RequestMapping("/api/reports/stats")
@Tag(name = "Report stats", description = "Agrégats des rapports Baitly")
@PreAuthorize("isAuthenticated()")
public class ReportStatsController {

    private final ReportStatsService reportStatsService;
    private final TenantContext tenantContext;

    public ReportStatsController(ReportStatsService reportStatsService, TenantContext tenantContext) {
        this.reportStatsService = reportStatsService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/interventions")
    @Operation(summary = "Agrégats interventions (statut, type, mois, priorité)")
    public ReportInterventionStatsDto getInterventionStats(@AuthenticationPrincipal Jwt jwt) {
        return reportStatsService.getInterventionStats(
                tenantContext.getRequiredOrganizationId(), JwtRoleExtractor.extractUserRole(jwt), jwt.getSubject());
    }

    @GetMapping("/properties")
    @Operation(summary = "Top logements par volume d'interventions et coût")
    public ReportPropertyStatsDto getPropertyStats(@AuthenticationPrincipal Jwt jwt) {
        return reportStatsService.getPropertyStats(
                tenantContext.getRequiredOrganizationId(), JwtRoleExtractor.extractUserRole(jwt), jwt.getSubject());
    }

    @GetMapping("/teams")
    @Operation(summary = "Performance des équipes (terminées / en cours / en attente)")
    public ReportTeamStatsDto getTeamStats(@AuthenticationPrincipal Jwt jwt) {
        return reportStatsService.getTeamStats(
                tenantContext.getRequiredOrganizationId(), JwtRoleExtractor.extractUserRole(jwt), jwt.getSubject());
    }

    @GetMapping("/financial")
    @Operation(summary = "Finances mensuelles et ventilation des coûts")
    public ReportFinancialStatsDto getFinancialStats(@AuthenticationPrincipal Jwt jwt) {
        return reportStatsService.getFinancialStats(
                tenantContext.getRequiredOrganizationId(), JwtRoleExtractor.extractUserRole(jwt), jwt.getSubject());
    }
}
