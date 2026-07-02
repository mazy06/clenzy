package com.clenzy.controller;

import com.clenzy.model.AiAutonomyBudget;
import com.clenzy.service.ai.AutonomyBudgetService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sous-budget d'autonomie premium (campagne X4) : lecture/ecriture de la config
 * (plafond, comportement au plafond, toggles) + jauge de consommation du cycle.
 *
 * <p>Controller mince ; ownership org via TenantContext (pas d'ID en path).
 * La config est reservee aux gestionnaires (ADMIN).</p>
 */
@RestController
@RequestMapping("/api/ai/autonomy/budget")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class AiAutonomyBudgetController {

    /** Vue API de la config + jauge (pas d'entite exposee — regle n°5). */
    public record AutonomyBudgetDto(long premiumCapMillicredits, String onCapBehavior,
                                    String behaviors, long consumedMillicredits) {}

    /** Corps du PUT — montants/toggles serveur-valides. */
    public record UpdateRequest(long premiumCapMillicredits, String onCapBehavior, String behaviors) {}

    private final AutonomyBudgetService budgetService;
    private final TenantContext tenantContext;

    public AiAutonomyBudgetController(AutonomyBudgetService budgetService, TenantContext tenantContext) {
        this.budgetService = budgetService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public AutonomyBudgetDto get() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        AiAutonomyBudget config = budgetService.getConfig(orgId);
        return new AutonomyBudgetDto(config.getPremiumCapMillicredits(), config.getOnCapBehavior(),
                config.getBehaviors(), budgetService.currentPremiumConsumption(orgId));
    }

    @PutMapping
    public AutonomyBudgetDto update(@RequestBody UpdateRequest request,
                                    @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        AiAutonomyBudget saved = budgetService.updateConfig(orgId,
                request.premiumCapMillicredits(), request.onCapBehavior(),
                request.behaviors(), jwt.getSubject());
        return new AutonomyBudgetDto(saved.getPremiumCapMillicredits(), saved.getOnCapBehavior(),
                saved.getBehaviors(), budgetService.currentPremiumConsumption(orgId));
    }
}
