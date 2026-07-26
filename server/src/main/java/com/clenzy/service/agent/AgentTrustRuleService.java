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
 *   <li><b>Invariant irreversibilite</b> : les outils de paiement/remboursement, de
 *       communication reelle, de publication publique et d'annulation ne sont JAMAIS
 *       suggeres ni auto-approuves ({@link #NEVER_AUTO_APPROVE}) — quelle que soit la
 *       donnee.</li>
 * </ul>
 */
@Service
public class AgentTrustRuleService {

    private static final Logger log = LoggerFactory.getLogger(AgentTrustRuleService.class);

    /**
     * Outils exclus de l'apprentissage ET de l'auto-approbation (invariant securite).
     *
     * <p>Deux familles, toutes deux irreversibles :</p>
     * <ul>
     *   <li><b>Argent</b> — un mouvement d'argent reste TOUJOURS sous confirmation
     *       explicite ({@code initiate_refund}, {@code settle_intervention_payment}) ;</li>
     *   <li><b>Effet externe irreversible</b> (audit 2026-07, P7-03) — communication reelle
     *       vers un voyageur ou un proprietaire, publication publique au nom de l'hote,
     *       annulation, ecriture fiscale, fermeture de ventes sur les OTA. La liste ne
     *       couvrait auparavant que l'argent : sur 19 outils d'ecriture, 17 restaient
     *       auto-approuvables des qu'une regle de confiance etait acceptee — alors que
     *       {@code cancel_reservation} ou {@code reply_to_review} ont un impact metier et
     *       reputationnel superieur a {@code settle_intervention_payment}.</li>
     * </ul>
     *
     * <p>Critere d'ajout : l'action est-elle rattrapable par l'operateur apres coup ?
     * Un message envoye, un avis publie, une reservation annulee et une facture emise ne
     * le sont pas. Un blocage de calendrier a l'unite, si.</p>
     */
    static final Set<String> NEVER_AUTO_APPROVE = Set.of(
            // Argent (invariant historique)
            "initiate_refund",
            "settle_intervention_payment",
            // Communication reelle / publication publique
            "send_guest_message",
            "send_owner_statement",
            "reply_to_review",
            // Annulation et ecritures metier irreversibles
            "cancel_reservation",
            "create_reservation",
            "create_invoice",
            "update_property_status",
            // Effet de masse sur la distribution
            "open_close_channel_availability",
            "batch_block_calendar");

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
     * (regle ACTIVE — donc explicitement acceptee par un humain). Les outils de
     * {@link #NEVER_AUTO_APPROVE} retournent toujours false, sans meme consulter la
     * base. Best-effort : une erreur DB retombe sur false (= confirmation demandee,
     * comportement le plus sur).
     */
    public boolean isAutoApproved(Long organizationId, String toolName) {
        if (!enabled || organizationId == null || toolName == null
                || NEVER_AUTO_APPROVE.contains(toolName)) {
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
            if (NEVER_AUTO_APPROVE.contains(toolName)
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
        if (NEVER_AUTO_APPROVE.contains(rule.getToolName())) {
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
