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

    public OwnerStatementScheduler(AutomationRuleRepository automationRuleRepository,
                                   PropertyRepository propertyRepository,
                                   AutomationEngine automationEngine) {
        this.automationRuleRepository = automationRuleRepository;
        this.propertyRepository = propertyRepository;
        this.automationEngine = automationEngine;
    }

    /** Le 1er du mois a 05:30 (Europe/Paris) : releve du mois ecoule. */
    @Scheduled(cron = "0 30 5 1 * *", zone = "Europe/Paris")
    public void fireMonthlyOwnerStatements() {
        List<Long> orgIds = automationRuleRepository.findByEnabledTrue().stream()
                .filter(rule -> rule.getTriggerType() == AutomationTrigger.OWNER_MONTHLY_STATEMENT)
                .map(AutomationRule::getOrganizationId)
                .distinct()
                .toList();
        if (orgIds.isEmpty()) {
            return;
        }

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
