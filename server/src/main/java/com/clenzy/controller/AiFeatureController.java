package com.clenzy.controller;

import com.clenzy.dto.AiFeatureToggleDto;
import com.clenzy.model.AiFeature;
import com.clenzy.service.AiTokenBudgetService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Gestion des toggles de features IA par organisation.
 *
 * Permet aux admins d'activer/desactiver chaque module IA
 * (DESIGN, PRICING, MESSAGING, ANALYTICS, SENTIMENT).
 */
@RestController
@RequestMapping("/api/ai/features")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class AiFeatureController {

    private final AiTokenBudgetService tokenBudgetService;
    private final TenantContext tenantContext;

    public AiFeatureController(AiTokenBudgetService tokenBudgetService,
                                TenantContext tenantContext) {
        this.tokenBudgetService = tokenBudgetService;
        this.tenantContext = tenantContext;
    }

    /**
     * GET /api/ai/features/toggles — Retourne l'etat de chaque feature IA.
     */
    @GetMapping("/toggles")
    public ResponseEntity<List<AiFeatureToggleDto>> getToggles() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Map<AiFeature, Boolean> toggles = tokenBudgetService.getFeatureToggles(orgId);

        List<AiFeatureToggleDto> result = toggles.entrySet().stream()
                .map(e -> new AiFeatureToggleDto(e.getKey().name(), e.getValue()))
                .toList();

        return ResponseEntity.ok(result);
    }

    /**
     * PUT /api/ai/features/toggles — Active ou desactive une feature IA.
     */
    @PutMapping("/toggles")
    public ResponseEntity<AiFeatureToggleDto> setToggle(@RequestBody AiFeatureToggleDto request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        AiFeature feature = AiFeature.valueOf(request.feature());

        tokenBudgetService.setFeatureEnabled(orgId, feature, request.enabled());

        return ResponseEntity.ok(new AiFeatureToggleDto(feature.name(), request.enabled()));
    }
}
