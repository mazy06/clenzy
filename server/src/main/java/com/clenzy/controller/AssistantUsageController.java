package com.clenzy.controller;

import com.clenzy.dto.AssistantUsageDto;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.service.ai.AssistantUsageService;
import com.clenzy.tenant.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints de consultation de la consommation tokens + cout USD de l'assistant
 * conversationnel (chat + briefings).
 *
 * <p>Alimente le badge frontend "$0.12 ce mois · 1.2k tokens" affiche dans le
 * header du chat, et le detail par conversation.</p>
 *
 * <p><b>Securite</b> :</p>
 * <ul>
 *   <li>{@code @PreAuthorize("isAuthenticated()")} : seul l'utilisateur connecte
 *       peut lire la consommation de son organisation</li>
 *   <li>Pour {@code /conversations/{id}/usage} : verification d'ownership via
 *       {@link AssistantConversationRepository#findByIdAndUser} pour eviter
 *       qu'un user lise la conso d'un autre user de la meme org</li>
 *   <li>Tenant isolation via {@link TenantContext#getRequiredOrganizationId()}</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/assistant/usage")
@PreAuthorize("isAuthenticated()")
public class AssistantUsageController {

    private final AssistantUsageService usageService;
    private final AssistantConversationRepository conversationRepository;
    private final TenantContext tenantContext;

    public AssistantUsageController(AssistantUsageService usageService,
                                      AssistantConversationRepository conversationRepository,
                                      TenantContext tenantContext) {
        this.usageService = usageService;
        this.conversationRepository = conversationRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Consommation cumulee de l'organisation sur une periode.
     *
     * @param period {@code today} (defaut si manquant), {@code month} ou {@code all}
     */
    @GetMapping
    public AssistantUsageDto getUsage(@RequestParam(defaultValue = "month") String period) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return usageService.getUsage(orgId, period);
    }

    /**
     * Consommation cumulee d'une conversation specifique.
     * Verifie l'ownership avant agregation (404 si conv inconnue ou non-owner).
     */
    @GetMapping("/conversations/{conversationId}")
    public ResponseEntity<AssistantUsageDto> getConversationUsage(
            @PathVariable Long conversationId,
            @AuthenticationPrincipal Jwt jwt) {
        String keycloakId = jwt != null ? jwt.getSubject() : null;
        if (keycloakId == null) {
            return ResponseEntity.status(401).build();
        }
        // Ownership check : la conv doit appartenir au caller (defense en
        // profondeur, en plus du tenant filter sur l'org).
        return conversationRepository.findByIdAndUser(conversationId, keycloakId)
                .map(conv -> ResponseEntity.ok(
                        usageService.getConversationUsage(conversationId, keycloakId)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
