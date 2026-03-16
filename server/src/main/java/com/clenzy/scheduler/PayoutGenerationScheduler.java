package com.clenzy.scheduler;

import com.clenzy.model.ManagementContract;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayout.PayoutGenerationType;
import com.clenzy.model.PayoutScheduleConfig;
import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PayoutScheduleConfigRepository;
import com.clenzy.service.AccountingService;
import com.clenzy.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Job planifie pour generer automatiquement les reversements proprietaires.
 *
 * Frequence : tous les jours a 2h du matin.
 * Ne genere que si la date du jour correspond a un des jours configures
 * dans payout_schedule_config.payout_days_of_month.
 *
 * Pattern multi-tenant : itere par orgId via ManagementContract,
 * pas de TenantContext (hors web request).
 */
@Service
public class PayoutGenerationScheduler {

    private static final Logger log = LoggerFactory.getLogger(PayoutGenerationScheduler.class);

    private final PayoutScheduleConfigRepository scheduleConfigRepository;
    private final ManagementContractRepository contractRepository;
    private final OwnerPayoutRepository payoutRepository;
    private final AccountingService accountingService;
    private final NotificationService notificationService;

    public PayoutGenerationScheduler(PayoutScheduleConfigRepository scheduleConfigRepository,
                                     ManagementContractRepository contractRepository,
                                     OwnerPayoutRepository payoutRepository,
                                     AccountingService accountingService,
                                     NotificationService notificationService) {
        this.scheduleConfigRepository = scheduleConfigRepository;
        this.contractRepository = contractRepository;
        this.payoutRepository = payoutRepository;
        this.accountingService = accountingService;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "0 0 2 * * *") // Tous les jours a 2h
    public void generateScheduledPayouts() {
        PayoutScheduleConfig config = scheduleConfigRepository.findAll().stream()
                .findFirst().orElse(null);

        if (config == null || !config.isAutoGenerateEnabled()) {
            log.debug("PayoutGenerationScheduler: auto-generation desactivee ou config absente");
            return;
        }

        int today = LocalDate.now().getDayOfMonth();
        if (!config.getPayoutDaysOfMonth().contains(today)) {
            log.debug("PayoutGenerationScheduler: jour {} non configure pour generation", today);
            return;
        }

        log.info("PayoutGenerationScheduler: demarrage de la generation automatique (jour {})", today);

        LocalDate periodEnd = LocalDate.now();
        List<Long> orgIds = payoutRepository.findDistinctOrganizationIds();

        int totalGenerated = 0;
        int totalSkipped = 0;
        int totalErrors = 0;

        for (Long orgId : orgIds) {
            try {
                int generated = generatePayoutsForOrg(orgId, periodEnd);
                totalGenerated += generated;
            } catch (Exception e) {
                totalErrors++;
                log.error("PayoutGenerationScheduler: erreur pour org={}: {}", orgId, e.getMessage());
            }
        }

        log.info("PayoutGenerationScheduler: termine - {} generes, {} erreurs sur {} organisations",
                totalGenerated, totalErrors, orgIds.size());

        if (totalGenerated > 0) {
            notifyAdminsOfGeneration(orgIds, totalGenerated);
        }
    }

    private int generatePayoutsForOrg(Long orgId, LocalDate periodEnd) {
        // Trouver les owners avec un contrat actif dans cette org
        List<ManagementContract> activeContracts = contractRepository.findByStatus(
                ManagementContract.ContractStatus.ACTIVE, orgId);

        Set<Long> ownerIds = activeContracts.stream()
                .map(ManagementContract::getOwnerId)
                .collect(Collectors.toSet());

        int generated = 0;

        for (Long ownerId : ownerIds) {
            try {
                // Determiner la date de debut : fin du dernier payout ou debut du mois
                LocalDate periodStart = findLastPayoutEnd(ownerId, orgId, periodEnd);
                if (!periodStart.isBefore(periodEnd)) {
                    continue; // Pas de periode a couvrir
                }

                OwnerPayout payout = accountingService.generatePayout(ownerId, orgId, periodStart, periodEnd);
                payout.setGenerationType(PayoutGenerationType.AUTO);
                generated++;
            } catch (Exception e) {
                log.warn("PayoutGenerationScheduler: erreur generation pour owner={} org={}: {}",
                        ownerId, orgId, e.getMessage());
            }
        }

        return generated;
    }

    /**
     * Trouve la fin du dernier payout pour cet owner, ou le premier jour du mois courant.
     */
    private LocalDate findLastPayoutEnd(Long ownerId, Long orgId, LocalDate now) {
        List<OwnerPayout> payouts = payoutRepository.findByOwnerId(ownerId, orgId);
        return payouts.stream()
                .map(OwnerPayout::getPeriodEnd)
                .max(LocalDate::compareTo)
                .map(end -> end.plusDays(1)) // Jour suivant la fin du dernier payout
                .orElse(now.withDayOfMonth(1)); // Par defaut : debut du mois
    }

    private void notifyAdminsOfGeneration(List<Long> orgIds, int totalGenerated) {
        for (Long orgId : orgIds) {
            try {
                notificationService.notifyAdminsAndManagersByOrgId(
                        orgId,
                        NotificationKey.PAYOUT_BATCH_GENERATED,
                        "Reversements generes automatiquement",
                        totalGenerated + " reversement(s) ont ete genere(s) et sont en attente d'approbation.",
                        "/billing"
                );
            } catch (Exception e) {
                log.warn("PayoutGenerationScheduler: erreur notification pour org={}: {}", orgId, e.getMessage());
            }
        }
    }
}
