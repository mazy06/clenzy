package com.clenzy.scheduler;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.PayoutScheduleConfig;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PayoutScheduleConfigRepository;
import com.clenzy.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Job planifie pour envoyer des rappels lorsque des reversements sont
 * en attente d'approbation depuis plus de gracePeriodDays.
 *
 * Frequence : tous les jours a 9h.
 */
@Service
public class PayoutReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(PayoutReminderScheduler.class);

    private final PayoutScheduleConfigRepository scheduleConfigRepository;
    private final OwnerPayoutRepository payoutRepository;
    private final NotificationService notificationService;

    public PayoutReminderScheduler(PayoutScheduleConfigRepository scheduleConfigRepository,
                                   OwnerPayoutRepository payoutRepository,
                                   NotificationService notificationService) {
        this.scheduleConfigRepository = scheduleConfigRepository;
        this.payoutRepository = payoutRepository;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "0 0 9 * * *") // Tous les jours a 9h
    public void sendPendingPayoutReminders() {
        PayoutScheduleConfig config = scheduleConfigRepository.findAll().stream()
                .findFirst().orElse(null);

        if (config == null) {
            return;
        }

        int graceDays = config.getGracePeriodDays();
        Instant threshold = Instant.now().minus(graceDays, ChronoUnit.DAYS);

        List<Long> orgIds = payoutRepository.findOrganizationIdsWithPendingPayouts();
        int totalReminders = 0;

        for (Long orgId : orgIds) {
            try {
                List<OwnerPayout> overduePending = payoutRepository.findPendingOlderThan(orgId, threshold);
                if (overduePending.isEmpty()) {
                    continue;
                }

                int count = overduePending.size();
                notificationService.notifyAdminsAndManagersByOrgId(
                        orgId,
                        NotificationKey.PAYOUT_PENDING_APPROVAL,
                        "Reversements en attente d'approbation",
                        count + " reversement(s) en attente d'approbation depuis plus de " + graceDays + " jour(s).",
                        "/billing?tab=3"
                );
                totalReminders += count;
            } catch (Exception e) {
                log.error("PayoutReminderScheduler: erreur pour org={}: {}", orgId, e.getMessage());
            }
        }

        if (totalReminders > 0) {
            log.info("PayoutReminderScheduler: {} rappel(s) envoye(s) pour {} organisation(s)",
                    totalReminders, orgIds.size());
        }
    }
}
