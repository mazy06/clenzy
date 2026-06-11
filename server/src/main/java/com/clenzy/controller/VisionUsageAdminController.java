package com.clenzy.controller;

import com.clenzy.model.OrgVisionAlert;
import com.clenzy.service.agent.vision.VisionTokenUsageService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Endpoints admin pour visualiser et configurer l'usage vision IA.
 *
 * <p>Reserve aux ADMIN / SUPER_ADMIN de l'org : la consommation est sensible
 * (impacte le cout). Tous les endpoints sont scopes sur l'org courante via
 * {@link TenantContext}.</p>
 */
@RestController
@RequestMapping("/api/admin/vision-usage")
@Tag(name = "Vision Usage", description = "Suivi et alertes de la consommation vision IA")
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN', 'SUPER_MANAGER')")
public class VisionUsageAdminController {

    private final VisionTokenUsageService usageService;
    private final TenantContext tenantContext;

    public VisionUsageAdminController(VisionTokenUsageService usageService,
                                        TenantContext tenantContext) {
        this.usageService = usageService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    @Operation(summary = "Usage vision IA (tokens) sur les 30 derniers jours pour l'org courante",
            description = "Retourne le total tokens vision + la config d'alerte si elle existe.")
    public ResponseEntity<Map<String, Object>> getUsage() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        VisionTokenUsageService.UsageSnapshot snap = usageService.snapshot(orgId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("organizationId", snap.organizationId());
        body.put("tokensLast30Days", snap.tokensLast30Days());
        body.put("windowDays", snap.windowDays());
        body.put("computedAt", snap.computedAt());

        usageService.getAlertConfig(orgId).ifPresent(cfg -> {
            Map<String, Object> alertCfg = new LinkedHashMap<>();
            alertCfg.put("thresholdTokens", cfg.getThresholdTokens());
            alertCfg.put("lastAlertedAt", cfg.getLastAlertedAt());
            alertCfg.put("exceeded", snap.tokensLast30Days() >= cfg.getThresholdTokens());
            body.put("alertConfig", alertCfg);
        });

        return ResponseEntity.ok(body);
    }

    @PutMapping("/threshold")
    @Operation(summary = "Configure ou met a jour le seuil d'alerte vision",
            description = "Upsert d'une ligne org_vision_alerts pour l'org courante. Threshold en tokens 30j.")
    public ResponseEntity<Map<String, Object>> setThreshold(@RequestBody Map<String, Object> body) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Object raw = body.get("thresholdTokens");
        if (!(raw instanceof Number n) || n.longValue() <= 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "thresholdTokens doit etre un entier > 0"));
        }
        long threshold = n.longValue();

        OrgVisionAlert saved = usageService.upsertThreshold(orgId, threshold);

        return ResponseEntity.ok(Map.of(
                "organizationId", saved.getOrganizationId(),
                "thresholdTokens", saved.getThresholdTokens(),
                "lastAlertedAt", saved.getLastAlertedAt()));
    }
}
