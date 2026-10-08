package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.clenzy.tenant.TenantContext;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.HashSet;

/** Rattrapage Baitly en lecture seule chez Stripe, y compris lorsqu'aucun webhook local n'existe. */
@Service
public class BaitlyDisputeRecovery {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(BaitlyDisputeRecovery.class);
    private final StripeGateway stripe;
    private final BaitlyDisputeReconciliation reconciliation;
    private final TenantContext tenant;
    // Une interruption repart de la première page : les preuves persistées rendent le rejeu idempotent.
    private String after;

    public BaitlyDisputeRecovery(StripeGateway stripe, BaitlyDisputeReconciliation reconciliation, TenantContext tenant) {
        this.stripe = stripe; this.reconciliation = reconciliation; this.tenant = tenant;
    }

    @Scheduled(initialDelayString = "${baitly.payments.dispute-check-ms:300000}",
            fixedDelayString = "${baitly.payments.dispute-check-ms:300000}")
    @SchedulerLock(name = "baitly-dispute-recovery", lockAtMostFor = "PT10M")
    public void sweep() {
        if (TransactionSynchronizationManager.isActualTransactionActive() || tenant.getOrganizationId() != null)
            throw new IllegalStateException("Rattrapage des litiges réservé au worker hors transaction et hors requête tenant.");
        if (!stripe.isConfigured()) return;
        try {
            var page = stripe.listDisputePage(after);
            if (page == null || page.getData() == null || page.getHasMore() == null || page.getData().size() > 25
                    || (page.getHasMore() && page.getData().isEmpty())) throw new IllegalStateException("Page Stripe incomplète.");
            var seen = new HashSet<String>();
            if (after != null) seen.add(after);
            for (var dispute : page.getData()) {
                if (dispute == null || dispute.getId() == null || !seen.add(dispute.getId()))
                    throw new IllegalStateException("Pagination Stripe incohérente.");
            }
            for (var dispute : page.getData()) {
                try { reconciliation.reconcile(dispute.getId()); }
                catch (RuntimeException failure) {
                    // Le cas reste visible dans les logs ; un dossier défectueux ne prive pas les suivants du contrôle.
                    // Il sera revu au prochain cycle complet, y compris s'il est ancien ou déjà clôturé.
                    log.warn("Baitly : litige {} à reprendre, cause={}", dispute.getId(), failure.getClass().getSimpleName());
                }
            }
            after = page.getHasMore() ? page.getData().getLast().getId() : null;
        } catch (Exception failure) {
            // Aucun avancement sur erreur de page ; une panne Stripe n'acquitte aucun dossier.
            log.warn("Baitly : lecture des litiges différée, cause={}", failure.getClass().getSimpleName());
        }
    }
}
