package com.clenzy.controller;

import com.clenzy.dto.SupervisionActivitySnapshotDto;
import com.clenzy.dto.SupervisionScanResultDto;
import com.clenzy.dto.SupervisionSuggestionDto;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionScanService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Données runtime de la constellation Superviseur (feed + métriques réelles).
 *
 * <p>Distinct de {@link SupervisionConfigController} (config) ; même base path,
 * mêmes rôles de lecture. Ownership de la propriété validé dans le service.</p>
 */
@RestController
@RequestMapping("/api/ai/supervision")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','SUPERVISOR')")
public class SupervisionController {

    private final SupervisionActivityService activityService;
    private final SupervisionScanService scanService;
    private final SupervisionSuggestionService suggestionService;
    private final TenantContext tenantContext;

    public SupervisionController(SupervisionActivityService activityService,
                                 SupervisionScanService scanService,
                                 SupervisionSuggestionService suggestionService,
                                 TenantContext tenantContext) {
        this.activityService = activityService;
        this.scanService = scanService;
        this.suggestionService = suggestionService;
        this.tenantContext = tenantContext;
    }

    /** GET /api/ai/supervision/activity/{propertyId} — feed + actions récentes. */
    @GetMapping("/activity/{propertyId}")
    public ResponseEntity<SupervisionActivitySnapshotDto> activity(@PathVariable Long propertyId) {
        return ResponseEntity.ok(activityService.getSnapshot(propertyId));
    }

    /**
     * POST /api/ai/supervision/scan/{propertyId} — lance un scan manuel de la
     * propriété (revue proactive multi-agent). Synchrone : renvoie le bilan
     * (actions journalisées + suggestions en attente + synthèse).
     */
    @PostMapping("/scan/{propertyId}")
    public ResponseEntity<SupervisionScanResultDto> scan(@PathVariable Long propertyId,
                                                         @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(scanService.scan(propertyId, jwt));
    }

    /** GET /api/ai/supervision/suggestions/{propertyId} — file org-scopée en attente. */
    @GetMapping("/suggestions/{propertyId}")
    public ResponseEntity<List<SupervisionSuggestionDto>> suggestions(@PathVariable Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(suggestionService.list(orgId, propertyId));
    }

    /** POST /api/ai/supervision/suggestions/{id}/dismiss — rejette une suggestion. */
    @PostMapping("/suggestions/{id}/dismiss")
    public ResponseEntity<Void> dismissSuggestion(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        suggestionService.dismiss(orgId, id);
        return ResponseEntity.noContent().build();
    }
}
