package com.clenzy.controller;

import com.clenzy.dto.SupervisionAutoRuleDto;
import com.clenzy.dto.SupervisionConfigDto;
import com.clenzy.service.agent.supervision.SupervisionAutoRuleService;
import com.clenzy.service.agent.supervision.SupervisionConfigService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Config org-level de la constellation Superviseur (Settings &gt; IA).
 *
 * <p>Org-scopé via {@link TenantContext} : un opérateur ne configure QUE sa
 * propre organisation (l'ownership est inhérent au scope org). Lecture ouverte
 * aux rôles de supervision ; écriture restreinte aux admins d'org.</p>
 */
@RestController
@RequestMapping("/api/ai/supervision")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST','SUPERVISOR')")
public class SupervisionConfigController {

    private final SupervisionConfigService configService;
    private final SupervisionAutoRuleService autoRuleService;
    private final TenantContext tenantContext;

    public SupervisionConfigController(SupervisionConfigService configService,
                                       SupervisionAutoRuleService autoRuleService,
                                       TenantContext tenantContext) {
        this.configService = configService;
        this.autoRuleService = autoRuleService;
        this.tenantContext = tenantContext;
    }

    /** GET /api/ai/supervision/config — config effective de l'org. */
    @GetMapping("/config")
    public ResponseEntity<SupervisionConfigDto> getConfig() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(configService.getConfig(orgId));
    }

    /** PUT /api/ai/supervision/config — met à jour master + modules (admins d'org). */
    @PutMapping("/config")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<SupervisionConfigDto> updateConfig(@RequestBody SupervisionConfigDto request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(configService.updateConfig(orgId, request));
    }

    /** Corps de l'acceptation : version du texte d'avertissement affiché. */
    public record FullAutonomyConsentRequest(String noticeVersion) {}

    /**
     * POST /api/ai/supervision/modules/{moduleKey}/full-autonomy-consent —
     * l'organisation accepte que cet agent agisse SEUL et EN SILENCE, et en
     * assume la responsabilité. On trace l'auteur (sujet du JWT), l'instant et
     * la version du texte accepté, puis on applique le niveau dans la foulée.
     * Un PUT de config ne peut pas atteindre FULL sans cette trace.
     */
    @PostMapping("/modules/{moduleKey}/full-autonomy-consent")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<SupervisionConfigDto> acceptFullAutonomy(
            @PathVariable String moduleKey,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody(required = false) FullAutonomyConsentRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(configService.acceptFullAutonomy(
                orgId, moduleKey,
                "user:" + (jwt != null ? jwt.getSubject() : "unknown"),
                request != null ? request.noticeVersion() : null));
    }

    /**
     * GET /api/ai/supervision/auto-rules — règles d'auto-application par type
     * (Vague 1 autonomie) : catalogue V1 avec état effectif (défaut tout OFF)
     * + plafond du module porteur (lecture seule, affiché quand il bride).
     */
    @GetMapping("/auto-rules")
    public ResponseEntity<List<SupervisionAutoRuleDto>> getAutoRules() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(autoRuleService.getRules(orgId));
    }

    /** PUT /api/ai/supervision/auto-rules — upsert des toggles par type (admins d'org). */
    @PutMapping("/auto-rules")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<List<SupervisionAutoRuleDto>> updateAutoRules(
            @RequestBody List<SupervisionAutoRuleDto> request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(autoRuleService.updateRules(orgId, request));
    }

    /**
     * POST /api/ai/supervision/auto-rules/{actionType}/dismiss-suggestion —
     * « Ignorer » la suggestion d'automatisation d'un type (Règles de Confiance
     * des cartes, V3) : cooldown de re-suggestion 30 j. Admins d'org.
     */
    @org.springframework.web.bind.annotation.PostMapping("/auto-rules/{actionType}/dismiss-suggestion")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
    public ResponseEntity<List<SupervisionAutoRuleDto>> dismissAutoRuleSuggestion(
            @org.springframework.web.bind.annotation.PathVariable String actionType) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(autoRuleService.dismissSuggestion(orgId, actionType));
    }
}
