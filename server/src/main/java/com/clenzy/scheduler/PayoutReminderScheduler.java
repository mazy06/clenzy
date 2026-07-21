package com.clenzy.scheduler;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.OwnerPayout;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PayoutScheduleConfigRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.NotifyStaffExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Capteur temporel de la relance des reversements en attente d'approbation
 * (flux deterministe F9b, Vague 1).
 *
 * <p>Scheduler quotidien : pour chaque payout genere par
 * {@code PayoutGenerationScheduler} reste PENDING au-dela du delai de grace
 * ({@code PayoutScheduleConfig.gracePeriodDays}, repli
 * {@value #DEFAULT_GRACE_DAYS} jours sans config), declenche
 * {@link AutomationTrigger#PAYOUT_PENDING_REMINDER} avec le payout en sujet.</p>
 *
 * <p>Le capteur n'envoie AUCUNE notification lui-meme : l'action (NOTIFY_STAFF)
 * est executee par le moteur AutomationRule si l'org a une regle active
 * (l'opt-in EST la regle). L'idempotence « une seule relance par payout » est
 * portee par la cle metier de l'executeur (CAS sur
 * {@code approval_reminder_sent_at}) ; le capteur pre-filtre les payouts deja
 * relances pour ne pas re-declencher chaque jour a vide.</p>
 */
@Service
public class PayoutReminderScheduler {

    /** Delai de grace par defaut (jours) quand aucune PayoutScheduleConfig n'existe. */
    static final int DEFAULT_GRACE_DAYS = 7;

    private static final Logger log = LoggerFactory.getLogger(PayoutReminderScheduler.class);

    private final PayoutScheduleConfigRepository scheduleConfigRepository;
    private final OwnerPayoutRepository payoutRepository;
    private final AutomationEngine automationEngine;

    public PayoutReminderScheduler(PayoutScheduleConfigRepository scheduleConfigRepository,
                                   OwnerPayoutRepository payoutRepository,
                                   AutomationEngine automationEngine) {
        this.scheduleConfigRepository = scheduleConfigRepository;
        this.payoutRepository = payoutRepository;
        this.automationEngine = automationEngine;
    }

    @Scheduled(cron = "0 0 9 * * *") // Tous les jours a 9h
    @SchedulerLock(name = "payout-reminders", lockAtMostFor = "PT10M")
    public void firePendingPayoutReminders() {
        int graceDays = scheduleConfigRepository.findAll().stream()
                .findFirst()
                .map(config -> config.getGracePeriodDays())
                .orElse(DEFAULT_GRACE_DAYS);

        Instant threshold = Instant.now().minus(graceDays, ChronoUnit.DAYS);

        List<Long> orgIds = payoutRepository.findOrganizationIdsWithPendingPayouts();
        int totalFired = 0;

        for (Long orgId : orgIds) {
            try {
                totalFired += fireForOrganization(orgId, threshold, graceDays);
            } catch (Exception e) {
                // Isolation par org : erreur logguee (stacktrace), les autres orgs continuent.
                log.error("PayoutReminderScheduler: erreur pour org={}", orgId, e);
            }
        }

        if (totalFired > 0) {
            log.info("PayoutReminderScheduler: {} declenchement(s) sur {} organisation(s)",
                    totalFired, orgIds.size());
        }
    }

    private int fireForOrganization(Long orgId, Instant threshold, int graceDays) {
        // Pre-filtre : les payouts deja relances (approvalReminderSentAt pose par
        // l'executeur) ne sont pas re-declenches — la garantie forte reste le CAS.
        List<OwnerPayout> overduePending = payoutRepository.findPendingOlderThan(orgId, threshold)
                .stream()
                .filter(payout -> payout.getApprovalReminderSentAt() == null)
                .toList();
        for (OwnerPayout payout : overduePending) {
            Map<String, Object> data = new HashMap<>();
            data.put(NotifyStaffExecutor.DATA_GRACE_DAYS, graceDays);
            if (payout.getNetAmount() != null) {
                data.put(NotifyStaffExecutor.DATA_NET_AMOUNT, payout.getNetAmount().toPlainString());
            }
            if (payout.getCurrency() != null) {
                data.put(NotifyStaffExecutor.DATA_CURRENCY, payout.getCurrency());
            }
            automationEngine.fireTrigger(
                    AutomationTrigger.PAYOUT_PENDING_REMINDER,
                    orgId,
                    new AutomationSubject(NotifyStaffExecutor.SUBJECT_PAYOUT, payout.getId(), data));
        }
        return overduePending.size();
    }
}
