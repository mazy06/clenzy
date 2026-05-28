package com.clenzy.controller;

import com.clenzy.dto.AiFeatureUsageBreakdownDto;
import com.clenzy.dto.AiUsageStatsDto;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/usage")
@PreAuthorize("isAuthenticated()")
public class AiTokenUsageController {

    private final AiTokenBudgetService aiTokenBudgetService;
    private final TenantContext tenantContext;

    public AiTokenUsageController(AiTokenBudgetService aiTokenBudgetService,
                                   TenantContext tenantContext) {
        this.aiTokenBudgetService = aiTokenBudgetService;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/stats")
    public AiUsageStatsDto getUsageStats() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return aiTokenBudgetService.getUsageStats(orgId);
    }

    /**
     * Breakdown detaille tokens + cout USD par (provider, model) au sein de
     * chaque feature. Sert au tooltip "decomposition par modele" en hover sur
     * le compteur de Settings &gt; IA. Resout l'agregation aveugle qui
     * masquait que 100k Sonnet et 100k Haiku ont des couts tres differents.
     */
    @GetMapping("/breakdown")
    public AiFeatureUsageBreakdownDto getUsageBreakdown() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return aiTokenBudgetService.getUsageBreakdown(orgId);
    }
}
