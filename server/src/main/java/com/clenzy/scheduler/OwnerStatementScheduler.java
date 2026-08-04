package com.clenzy.scheduler;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.SendOwnerStatementExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/**
 * Capteur temporel du releve proprietaire mensuel automatique
 * (flux deterministe F9a, Vague 1).
 *
 * <p>Le 1er de chaque mois, tot le matin, declenche
 * {@link AutomationTrigger#OWNER_MONTHLY_STATEMENT} pour chaque proprietaire
 * ayant des biens dans une org disposant d'une regle ACTIVE sur ce trigger
 * (l'opt-in EST l'existence de la regle — pas de flag serveur). Le capteur ne
 * fait AUCUN envoi lui-meme : l'action (SEND_OWNER_STATEMENT) est executee
 * par le moteur AutomationRule, l'idempotence metier (un seul releve par mois)
 * par l'executeur.</p>
 *
 * <p>Le sujet porte la periode (mois civil precedent, calcule en Europe/Paris
 * comme le cron) pour que l'executeur envoie le bon mois meme en cas
 * d'execution differee.</p>
 */
@Service
public class OwnerStatementScheduler {

    private static final Logger log = LoggerFactory.getLogger(OwnerStatementScheduler.class);

    private static final ZoneId STATEMENT_ZONE = ZoneId.of("Europe/Paris");

    private final AutomationRuleRepository automationRuleRepository;
    private final PropertyRepository propertyRepository;
    private final AutomationEngine automationEngine;
    private final com.clenzy.repository.OrganizationRepository organizationRepository;
    private final com.clenzy.service.agent.supervision.SupervisionSuggestionService supervisionSuggestionService;

    public OwnerStatementScheduler(AutomationRuleRepository automationRuleRepository,
                                   PropertyRepository propertyRepository,
                                   AutomationEngine automationEngine,
                                   com.clenzy.repository.OrganizationRepository organizationRepository,
                                   com.clenzy.service.agent.supervision.SupervisionSuggestionService supervisionSuggestionService) {
        this.automationRuleRepository = automationRuleRepository;
        this.propertyRepository = propertyRepository;
        this.automationEngine = automationEngine;
        this.organizationRepository = organizationRepository;
        this.supervisionSuggestionService = supervisionSuggestionService;
    }

    /** Le 1er du mois a 05:30 (Europe/Paris) : releve du mois ecoule. */
    @Scheduled(cron = "0 30 5 1 * *", zone = "Europe/Paris")
    @SchedulerLock(name = "owner-monthly-statements", lockAtMostFor = "PT30M")
    public void fireMonthlyOwnerStatements() {
        List<Long> orgIds = automationRuleRepository.findByEnabledTrue().stream()
                .filter(rule -> rule.getTriggerType() == AutomationTrigger.OWNER_MONTHLY_STATEMENT)
                .map(AutomationRule::getOrganizationId)
                .distinct()
                .toList();

        LocalDate today = LocalDate.now(STATEMENT_ZONE);
        LocalDate from = today.minusMonths(1).withDayOfMonth(1);
        LocalDate to = from.plusMonths(1).minusDays(1);

        log.info("OwnerStatementScheduler: {} org(s) avec regle active, periode {} -> {}",
                orgIds.size(), from, to);

        for (Long orgId : orgIds) {
            try {
                fireForOrganization(orgId, from, to);
            } catch (Exception e) {
                // Isolation par org : erreur logguee (stacktrace), les autres orgs continuent.
                log.error("OwnerStatementScheduler: echec pour org={}", orgId, e);
            }
        }

        // Constellation métiers Phase 2 : les orgs SANS automatisation reçoivent une
        // carte HITL par propriétaire (« Envoyer », OWNER_STATEMENT_SEND) — l'agent
        // Propriétaire propose, rien ne part sans validation.
        for (Long orgId : organizationRepository.findAllIds()) {
            if (orgIds.contains(orgId)) {
                continue; // automatisation active : l'envoi part par le moteur de règles
            }
            try {
                suggestStatementCards(orgId, from, to);
            } catch (Exception e) {
                log.debug("OwnerStatementScheduler: cartes HITL non emises pour org={}: {}",
                        orgId, e.getMessage());
            }
        }
    }

    /**
     * Une carte par propriétaire de l'org, ancrée sur l'un de ses logements (la carte
     * de supervision est per-property). Montants NON portés par la carte : l'apply
     * re-calcule tout depuis les reversements PAID ({@code sendStatement}, règle n°1).
     */
    private void suggestStatementCards(Long orgId, LocalDate from, LocalDate to) {
        for (Long ownerId : propertyRepository.findDistinctOwnerIdsByOrgId(orgId)) {
            Long anchorPropertyId = propertyRepository.findFirstPropertyIdByOwnerAndOrg(ownerId, orgId);
            if (anchorPropertyId == null) {
                continue;
            }
            supervisionSuggestionService.recordActionable(
                    orgId, anchorPropertyId, "own",
                    "Relevé mensuel à envoyer (propriétaire #" + ownerId + ", " + from + ")",
                    "Le relevé " + from + " → " + to + " est prêt : reversements versés, commission "
                            + "et détail par séjour. « Envoyer » le génère et l'adresse par email "
                            + "au propriétaire.",
                    com.clenzy.service.agent.supervision.SupervisionActionType.OWNER_STATEMENT_SEND,
                    "{\"ownerId\":" + ownerId + ",\"from\":\"" + from + "\",\"to\":\"" + to + "\"}",
                    null, "info");
        }
    }

    private void fireForOrganization(Long orgId, LocalDate from, LocalDate to) {
        List<Long> ownerIds = propertyRepository.findDistinctOwnerIdsByOrgId(orgId);
        for (Long ownerId : ownerIds) {
            // Declencheur recurrent (dedupePerSubject=false) : l'idempotence par mois
            // est portee par l'executeur (claim owner_statement_dispatch).
            automationEngine.fireTrigger(
                    AutomationTrigger.OWNER_MONTHLY_STATEMENT,
                    orgId,
                    new AutomationSubject(
                            SendOwnerStatementExecutor.SUBJECT_OWNER,
                            ownerId,
                            Map.of(
                                    SendOwnerStatementExecutor.DATA_PERIOD_START, from.toString(),
                                    SendOwnerStatementExecutor.DATA_PERIOD_END, to.toString())));
        }
        if (!ownerIds.isEmpty()) {
            log.info("OwnerStatementScheduler: {} declenchement(s) pour org={}", ownerIds.size(), orgId);
        }
    }
}
