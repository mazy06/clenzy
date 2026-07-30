package com.clenzy.controller;

import com.clenzy.dto.DashboardOperationsDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemsDto;
import com.clenzy.dto.DashboardOperationsDto.UpcomingArrivalDto;
import com.clenzy.model.UserRole;
import com.clenzy.service.DashboardOperationsService;
import com.clenzy.service.dashboard.ActionItemQueryService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Blocs opérationnels de l'écran Dashboard : la journée en cours, les arrivées
 * à venir, et les éléments à traiter.
 *
 * <p>Org-scope strict : l'organisation vient du contexte tenant, jamais d'un
 * paramètre. Le rôle vient du JWT et restreint le périmètre dans le service
 * (HOST → ses logements, rôles opérationnels → leurs interventions).
 * Controller mince : validation du paramètre + délégation + DTO.</p>
 */
@RestController
@RequestMapping("/api/dashboard")
@PreAuthorize("isAuthenticated()")
public class DashboardOperationsController {

    /** Fenêtre maximale des arrivées à venir — au-delà, c'est le planning. */
    private static final int MAX_UPCOMING_DAYS = 30;

    private final DashboardOperationsService operationsService;
    private final ActionItemQueryService actionItemQueryService;
    private final TenantContext tenantContext;

    public DashboardOperationsController(DashboardOperationsService operationsService,
                                         ActionItemQueryService actionItemQueryService,
                                         TenantContext tenantContext) {
        this.operationsService = operationsService;
        this.actionItemQueryService = actionItemQueryService;
        this.tenantContext = tenantContext;
    }

    /** Arrivées, départs et ménages du jour, en un seul appel. */
    @GetMapping("/operations/today")
    public DashboardOperationsDto getToday(@AuthenticationPrincipal Jwt jwt) {
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        return operationsService.getToday(
                tenantContext.getRequiredOrganizationId(), role, jwt.getSubject());
    }

    @GetMapping("/upcoming-arrivals")
    public List<UpcomingArrivalDto> getUpcomingArrivals(
            @RequestParam(name = "days", defaultValue = "7") int days,
            @AuthenticationPrincipal Jwt jwt) {
        if (days < 1 || days > MAX_UPCOMING_DAYS) {
            throw new IllegalArgumentException(
                    "Fenêtre invalide: " + days + " (attendu entre 1 et " + MAX_UPCOMING_DAYS + ")");
        }
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        return operationsService.getUpcomingArrivals(
                tenantContext.getRequiredOrganizationId(), days, role, jwt.getSubject());
    }

    /**
     * La file « à traiter ».
     *
     * <p>Lecture d'une table indexée : la découverte des anomalies se fait
     * ailleurs, par balayage périodique, hors du chemin de l'utilisateur.</p>
     */
    @GetMapping("/action-items")
    public ActionItemsDto getActionItems(@AuthenticationPrincipal Jwt jwt) {
        final UserRole role = JwtRoleExtractor.extractUserRole(jwt);
        return actionItemQueryService.getActionItems(
                tenantContext.getRequiredOrganizationId(), role, jwt.getSubject());
    }
}
