package com.clenzy.service.agent;

import com.clenzy.model.AgentPendingAction;
import com.clenzy.model.AgentTrustRule;
import com.clenzy.repository.AgentPendingActionRepository;
import com.clenzy.repository.AgentTrustRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/**
 * Regles de Confiance (campagne X2, ADR-007 / signature feature Phase 6 n°2) :
 * l'autonomie qui s'apprend, jamais en silence.
 *
 * <ul>
 *   <li><b>Evaluation</b> (scheduler quotidien) : un couple (org, outil) dont
 *       les {@code threshold} DERNIERES pauses HITL sont toutes CONFIRMED —
 *       sans refus ni expiration dans la fenetre — genere une regle SUGGESTED,
 *       inerte tant qu'un humain ne l'accepte pas ;</li>
 *   <li><b>Gate</b> ({@link #isAutoApproved}) : une regle ACTIVE fait passer
 *       l'outil de « confirmer » a « notifier » (execution sans pause, toujours
 *       tracee : audit, agent_step, ledger, SSE) ;</li>
 *   <li><b>Invariant argent</b> : les outils de paiement/remboursement ne sont
 *       JAMAIS suggeres ni auto-approuves ({@link #MONEY_TOOLS}) — quelle que
 *       soit la donnee.</li>
 * </ul>
 */
@Service
public class AgentTrustRuleService {

    private static final Logger log = LoggerFactory.getLogger(AgentTrustRuleService.class);

    /**
     * Outils argent : exclus de l'apprentissage (invariant securite — un
     * mouvement d'argent reste TOUJOURS sous confirmation explicite).
     */
    static final Set<String> MONEY_TOOLS = Set.of(
            "initiate_refund",
            "settle_intervention_payment");

    private final AgentTrustRuleRepository ruleRepository;
    private final AgentPendingActionRepository pendingActionRepository;
    private final int threshold;
    private final boolean enabled;

    public AgentTrustRuleService(AgentTrustRuleRepository ruleRepository,
                                 AgentPendingActionRepository pendingActionRepository,
                                 @Value("${clenzy.assistant.trust-rules.threshold:5}") int threshold,
                                 @Value("${clenzy.assistant.trust-rules.enabled:true}") boolean enabled) {
        this.ruleRepository = ruleRepository;
        this.pendingActionRepository = pendingActionRepository;
        this.threshold = threshold;
        this.enabled = enabled;
    }

    /**
     * True si l'outil peut s'executer SANS pause de confirmation pour cette org
     * (regle ACTIVE — donc explicitement acceptee par un humain). Les outils
     * argent retournent toujours false. Best-effort : une erreur DB retombe sur
     * false (= confirmation demandee, comportement le plus sur).
     */
    public boolean isAutoApproved(Long organizationId, String toolName) {
        if (!enabled || organizationId == null || toolName == null
                || MONEY_TOOLS.contains(toolName)) {
            return false;
        }
        try {
            return ruleRepository.existsByOrganizationIdAndToolNameAndStatus(
                    organizationId, toolName, AgentTrustRule.STATUS_ACTIVE);
        } catch (Exception e) {
            log.warn("TrustRules: verification impossible pour {} (org={}) → confirmation demandee : {}",
                    toolName, organizationId, e.getMessage());
            return false;
        }
    }

    /**
     * Evaluation des suggestions (scheduler quotidien) : cree les regles
     * SUGGESTED pour les couples eligibles sans regle existante (une regle
     * DISMISSED/REVOKED n'est jamais re-suggeree — on respecte la decision).
     *
     * @return nombre de suggestions creees
     */
    @Transactional
    public int evaluateSuggestions() {
        if (!enabled) {
            return 0;
        }
        int created = 0;
        for (Object[] candidate : pendingActionRepository.findTrustRuleCandidates(threshold)) {
            Long orgId = (Long) candidate[0];
            String toolName = (String) candidate[1];
            if (MONEY_TOOLS.contains(toolName)
                    || ruleRepository.existsByOrganizationIdAndToolName(orgId, toolName)) {
                continue;
            }
            List<AgentPendingAction> lastResolutions = pendingActionRepository
                    .findByOrganizationIdAndToolNameAndStatusNotOrderByResolvedAtDesc(
                            orgId, toolName, AgentPendingAction.STATUS_PENDING,
                            PageRequest.ofSize(threshold));
            boolean allConfirmed = lastResolutions.size() >= threshold
                    && lastResolutions.stream()
                            .allMatch(a -> AgentPendingAction.STATUS_CONFIRMED.equals(a.getStatus()));
            if (!allConfirmed) {
                continue; // un refus/timeout recent invalide le pattern
            }
            ruleRepository.save(new AgentTrustRule(orgId, toolName, lastResolutions.size()));
            created++;
            log.info("TrustRules: suggestion creee — org={} outil={} ({} confirmations consecutives)",
                    orgId, toolName, threshold);
        }
        return created;
    }

    /** Regles de l'org (panneau d'autonomie). */
    @Transactional(readOnly = true)
    public List<AgentTrustRule> listForOrganization(Long organizationId) {
        return ruleRepository.findByOrganizationIdOrderBySuggestedAtDesc(organizationId);
    }

    /** Accepte une regle (SUGGESTED/REVOKED/DISMISSED → ACTIVE). Decision humaine explicite. */
    @Transactional
    public AgentTrustRule accept(Long ruleId, Long organizationId, String decidedBy) {
        AgentTrustRule rule = requireOwnedRule(ruleId, organizationId);
        if (MONEY_TOOLS.contains(rule.getToolName())) {
            throw new IllegalStateException("Les outils de paiement ne sont jamais auto-approuves.");
        }
        rule.decide(AgentTrustRule.STATUS_ACTIVE, decidedBy);
        return ruleRepository.save(rule);
    }

    /** Ecarte une suggestion (ne sera pas re-proposee). */
    @Transactional
    public AgentTrustRule dismiss(Long ruleId, Long organizationId, String decidedBy) {
        AgentTrustRule rule = requireOwnedRule(ruleId, organizationId);
        rule.decide(AgentTrustRule.STATUS_DISMISSED, decidedBy);
        return ruleRepository.save(rule);
    }

    /** Revoque une regle ACTIVE : l'outil repasse immediatement en « confirmer ». */
    @Transactional
    public AgentTrustRule revoke(Long ruleId, Long organizationId, String decidedBy) {
        AgentTrustRule rule = requireOwnedRule(ruleId, organizationId);
        rule.decide(AgentTrustRule.STATUS_REVOKED, decidedBy);
        return ruleRepository.save(rule);
    }

    private AgentTrustRule requireOwnedRule(Long ruleId, Long organizationId) {
        return ruleRepository.findByIdAndOrganizationId(ruleId, organizationId)
                .orElseThrow(() -> new AccessDeniedException(
                        "Regle " + ruleId + " introuvable pour cette organisation"));
    }
}
