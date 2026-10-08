package com.clenzy.scheduler;

import com.clenzy.service.RefundCreditNoteService;
import com.clenzy.tenant.TenantScopedExecutor;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Reprend les documents manquants après un échec Kafka ou une facture créée tardivement. */
@Component
public class RefundCreditNoteScheduler {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(RefundCreditNoteScheduler.class);
    private final RefundCreditNoteService notes;
    private final TenantScopedExecutor tenants;
    public RefundCreditNoteScheduler(RefundCreditNoteService notes, TenantScopedExecutor tenants) {
        this.notes = notes; this.tenants = tenants;
    }

    @Scheduled(initialDelayString = "${baitly.payments.credit-note-check-ms:60000}", fixedDelayString = "${baitly.payments.credit-note-check-ms:60000}")
    @SchedulerLock(name = "baitly-refund-credit-notes", lockAtMostFor = "PT5M")
    public void resume() {
        for (var candidate : notes.candidates()) {
            try {
                tenants.runAsOrganization(candidate.organizationId(), () -> {
                    try { notes.reconcile(candidate.refundRef()); }
                    catch (Exception error) {
                        notes.recordFailure(candidate.refundRef());
                        log.warn("Avoir du remboursement {} à rapprocher : {}", candidate.refundRef(), error.getClass().getSimpleName());
                    }
                });
            } catch (Exception error) {
                log.warn("Reprise de l'avoir {} différée : {}", candidate.refundRef(), error.getClass().getSimpleName());
            }
        }
    }
}
