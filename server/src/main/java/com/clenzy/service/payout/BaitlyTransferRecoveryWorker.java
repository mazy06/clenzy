package com.clenzy.service.payout;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.payment.payout.BaitlyStripeTransferRecovery;
import com.clenzy.service.dashboard.ActionItemWriter;
import com.clenzy.tenant.TenantScopedExecutor;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** File durable : un incident de récupération ne réécrit jamais le remboursement client confirmé. */
@Service
public class BaitlyTransferRecoveryWorker {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(BaitlyTransferRecoveryWorker.class);
    private final BaitlyTransferRecoveryStore store;
    private final BaitlyStripeTransferRecovery stripe;
    private final TenantScopedExecutor tenants;
    private final ActionItemWriter actions;
    public BaitlyTransferRecoveryWorker(BaitlyTransferRecoveryStore store, BaitlyStripeTransferRecovery stripe,
            TenantScopedExecutor tenants, ActionItemWriter actions) {
        this.store = store; this.stripe = stripe; this.tenants = tenants; this.actions = actions;
    }
    @Scheduled(initialDelayString = "${baitly.payments.transfer-recovery-ms:60000}", fixedDelayString = "${baitly.payments.transfer-recovery-ms:60000}")
    @SchedulerLock(name = "baitly-transfer-recoveries", lockAtMostFor = "PT10M")
    public void resume() {
        for (var candidate : store.candidates()) {
            try { tenants.runAsOrganization(candidate.org(), () -> process(candidate)); }
            catch (RuntimeException failure) { log.warn("Reprise de récupération Baitly {} différée", candidate.id()); }
        }
    }
    void process(BaitlyTransferRecoveryStore.Candidate candidate) {
        var claimed = store.claim(candidate.org(), candidate.id());
        if (claimed.isEmpty()) return;
        var instruction = claimed.get();
        String incident = "TRANSFER-RECOVERY-" + candidate.id();
        try {
            var reference = stripe.recover(instruction);
            store.confirm(candidate.org(), candidate.id(), reference);
        } catch (Exception failure) {
            // Aucun message Stripe brut (potentiellement confidentiel) dans l'interface.
            String code = failure instanceof IllegalStateException && failure.getMessage() != null
                    && failure.getMessage().matches("[A-Z_]{1,80}") ? failure.getMessage() : "STRIPE_RECOVERY_UNCONFIRMED";
            store.review(candidate.org(), candidate.id(), code);
            actions.record(new ActionItemWriter.EventAction(candidate.org(), ActionItemKind.PAYMENT_INCIDENT,
                    incident, "warning", "Fonds prestataire à récupérer",
                    "Le client est remboursé. La récupération du transfert prestataire reste à confirmer dans le suivi des versements.",
                    null, instruction.amount(), instruction.currency(), null, "TRANSFER_RECOVERY"));
            return;
        }
        // La notification est secondaire : son échec ne transforme pas une preuve confirmée en incident financier.
        try {
            actions.resolve(candidate.org(), ActionItemKind.PAYMENT_INCIDENT, incident, "stripe:recovered");
        } catch (RuntimeException notificationFailure) {
            log.warn("Notification de récupération Baitly {} différée", candidate.id());
        }
    }
}
