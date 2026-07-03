package com.clenzy.scheduler;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.InvoiceReminderExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/**
 * Scheduler quotidien des factures en retard (fiche 08, F5a).
 *
 * <p>Deux passes :</p>
 * <ol>
 *   <li><b>Marquage</b> : les factures SENT/ISSUED echues passent OVERDUE, puis le
 *       trigger INVOICE_OVERDUE est tire vers le moteur AutomationRule (regles org :
 *       NOTIFY_STAFF, SEND_INVOICE_REMINDER…) ;</li>
 *   <li><b>Relances</b> : re-tire INVOICE_OVERDUE pour les factures encore OVERDUE
 *       avec budget de relance restant, avec {@code daysOverdue} dans les donnees du
 *       sujet — l'executeur SEND_INVOICE_REMINDER applique la cadence J+3/J+7 et le
 *       maximum de 2 relances (idempotence en base : {@code overdue_reminder_count}).</li>
 * </ol>
 *
 * <p>Volontairement non transactionnel : chaque save est court, et les triggers
 * (dont les executeurs envoient des emails) partent hors transaction DB. Un echec
 * sur une facture est logue et n'empeche pas les suivantes (le scheduler repasse
 * chaque jour — statut explicite par facture, pas d'avalement global).</p>
 */
@Component
public class InvoiceOverdueScheduler {

    private static final Logger log = LoggerFactory.getLogger(InvoiceOverdueScheduler.class);

    private static final List<InvoiceStatus> OVERDUE_CANDIDATE_STATUSES =
        List.of(InvoiceStatus.SENT, InvoiceStatus.ISSUED);

    private final InvoiceRepository invoiceRepository;
    private final AutomationEngine automationEngine;

    public InvoiceOverdueScheduler(InvoiceRepository invoiceRepository,
                                   AutomationEngine automationEngine) {
        this.invoiceRepository = invoiceRepository;
        this.automationEngine = automationEngine;
    }

    @Scheduled(cron = "0 0 8 * * *")  // Daily at 8:00 AM
    public void checkOverdueInvoices() {
        log.debug("Checking for overdue invoices...");
        LocalDate today = LocalDate.now();

        // Query DB directement pour eviter le full table scan cross-tenant
        List<Invoice> candidates = invoiceRepository.findOverdueCandidates(
            OVERDUE_CANDIDATE_STATUSES, today);

        int overdueCount = 0;
        for (Invoice invoice : candidates) {
            try {
                invoice.setStatus(InvoiceStatus.OVERDUE);
                invoice.setOverdueNotifiedAt(LocalDateTime.now());
                invoiceRepository.save(invoice);
                overdueCount++;
                log.info("Invoice {} marked as OVERDUE (due date: {})",
                    invoice.getInvoiceNumber(), invoice.getDueDate());

                fireInvoiceOverdueTrigger(invoice);
            } catch (Exception e) {
                log.error("Failed to mark invoice {} as overdue: {}",
                    invoice.getId(), e.getMessage());
            }
        }

        if (overdueCount > 0) {
            log.info("Marked {} invoices as OVERDUE", overdueCount);
        }
    }

    /**
     * Passe de relance : re-tire le trigger INVOICE_OVERDUE pour les factures
     * toujours en retard avec budget de relance restant. C'est l'executeur
     * SEND_INVOICE_REMINDER qui decide (J+3/J+7, max 2) — ici on ne fait que
     * re-presenter le sujet au moteur avec le retard du jour.
     */
    @Scheduled(cron = "0 15 8 * * *")  // Daily at 8:15 AM, apres la passe de marquage
    public void fireOverdueReminders() {
        List<Invoice> overdue = invoiceRepository.findByStatusAndOverdueReminderCountLessThan(
            InvoiceStatus.OVERDUE, InvoiceReminderExecutor.MAX_REMINDERS);
        if (overdue.isEmpty()) {
            return;
        }

        int fired = 0;
        for (Invoice invoice : overdue) {
            try {
                fireInvoiceOverdueTrigger(invoice);
                fired++;
            } catch (Exception e) {
                log.error("Failed to fire INVOICE_OVERDUE for invoice {}: {}",
                    invoice.getId(), e.getMessage());
            }
        }
        log.info("Relances factures : trigger INVOICE_OVERDUE tire pour {}/{} facture(s) en retard",
            fired, overdue.size());
    }

    private void fireInvoiceOverdueTrigger(Invoice invoice) {
        automationEngine.fireTrigger(AutomationTrigger.INVOICE_OVERDUE,
            invoice.getOrganizationId(),
            new AutomationSubject(AutomationSubject.TYPE_INVOICE, invoice.getId(),
                Map.of(AutomationSubject.DATA_DAYS_OVERDUE, daysOverdue(invoice))));
    }

    /** Jours de retard : depuis le passage OVERDUE, repli sur la date d'echeance. */
    private static long daysOverdue(Invoice invoice) {
        LocalDate since = invoice.getOverdueNotifiedAt() != null
            ? invoice.getOverdueNotifiedAt().toLocalDate()
            : invoice.getDueDate();
        return since != null ? Math.max(0, ChronoUnit.DAYS.between(since, LocalDate.now())) : 0;
    }
}
