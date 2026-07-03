package com.clenzy.controller;

import com.clenzy.model.AgentTrustRule;
import com.clenzy.service.agent.AgentTrustRuleService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * Regles de Confiance (campagne X2) : liste, acceptation, rejet, revocation.
 *
 * <p>Controller mince ; ownership org valide dans le service (les regles n'ont
 * pas de filtre tenant Hibernate). Toute transition porte le keycloakId du
 * decideur — jamais de bascule anonyme.</p>
 */
@RestController
@RequestMapping("/api/ai/autonomy/trust-rules")
@PreAuthorize("isAuthenticated()")
public class AgentTrustRuleController {

    /** Vue API d'une regle (pas d'entite JPA exposee — regle n°5). */
    public record TrustRuleDto(Long id, String toolName, String status,
                               int confirmationsSeen, Instant suggestedAt,
                               Instant decidedAt, String decidedBy) {
        static TrustRuleDto from(AgentTrustRule rule) {
            return new TrustRuleDto(rule.getId(), rule.getToolName(), rule.getStatus(),
                    rule.getConfirmationsSeen(), rule.getSuggestedAt(),
                    rule.getDecidedAt(), rule.getDecidedBy());
        }
    }

    private final AgentTrustRuleService trustRuleService;
    private final TenantContext tenantContext;

    public AgentTrustRuleController(AgentTrustRuleService trustRuleService,
                                    TenantContext tenantContext) {
        this.trustRuleService = trustRuleService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<TrustRuleDto> list() {
        return trustRuleService.listForOrganization(tenantContext.getRequiredOrganizationId())
                .stream().map(TrustRuleDto::from).toList();
    }

    @PostMapping("/{id}/accept")
    public TrustRuleDto accept(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return TrustRuleDto.from(trustRuleService.accept(
                id, tenantContext.getRequiredOrganizationId(), jwt.getSubject()));
    }

    @PostMapping("/{id}/dismiss")
    public TrustRuleDto dismiss(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return TrustRuleDto.from(trustRuleService.dismiss(
                id, tenantContext.getRequiredOrganizationId(), jwt.getSubject()));
    }

    @PostMapping("/{id}/revoke")
    public TrustRuleDto revoke(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return TrustRuleDto.from(trustRuleService.revoke(
                id, tenantContext.getRequiredOrganizationId(), jwt.getSubject()));
    }
}
