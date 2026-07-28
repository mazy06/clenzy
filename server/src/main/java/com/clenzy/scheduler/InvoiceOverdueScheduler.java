package com.clenzy.scheduler;

import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.service.InvoiceOverduePersistence;
import com.clenzy.service.InvoiceOverduePersistence.OverdueInvoice;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.InvoiceReminderExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
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
 * <p>Volontairement non transactionnel : les triggers (dont les executeurs envoient des
 * emails) partent hors transaction DB. Les acces base passent par
 * {@link InvoiceOverduePersistence}, dont les methodes ouvrent des transactions courtes
 * <b>que l'aspect Row-Level Security peut instrumenter</b> — un repository appele
 * directement depuis ce scheduler echapperait a son pointcut, et le balayage renverrait
 * zero facture en silence une fois la RLS active (audit RLS, plan REM-T-01).</p>
 *
 * <p>Un echec sur une facture est logue et n'empeche pas les suivantes (le scheduler
 * repasse chaque jour — statut explicite par facture, pas d'avalement global).</p>
 */
@Component
public class InvoiceOverdueScheduler {

    private static final Logger log = LoggerFactory.getLogger(InvoiceOverdueScheduler.class);

    private static final List<InvoiceStatus> OVERDUE_CANDIDATE_STATUSES =
        List.of(InvoiceStatus.SENT, InvoiceStatus.ISSUED);

    private final InvoiceOverduePersistence overdueInvoices;
    private final AutomationEngine automationEngine;

    public InvoiceOverdueScheduler(InvoiceOverduePersistence overdueInvoices,
                                   AutomationEngine automationEngine) {
        this.overdueInvoices = overdueInvoices;
        this.automationEngine = automationEngine;
    }

    @Scheduled(cron = "0 0 8 * * *")  // Daily at 8:00 AM
    @SchedulerLock(name = "invoice-overdue-marking", lockAtMostFor = "PT10M")
    public void checkOverdueInvoices() {
        log.debug("Checking for overdue invoices...");

        // Query DB directement pour eviter le full table scan cross-tenant
        List<Long> candidateIds = overdueInvoices.findOverdueCandidateIds(
            OVERDUE_CANDIDATE_STATUSES, LocalDate.now());

        int overdueCount = 0;
        for (Long invoiceId : candidateIds) {
            try {
                OverdueInvoice marked = overdueInvoices.markOverdue(invoiceId);
                overdueCount++;
                log.info("Invoice {} marked as OVERDUE (due date: {})",
                    marked.invoiceNumber(), marked.dueDate());

                fireInvoiceOverdueTrigger(marked);
            } catch (Exception e) {
                log.error("Failed to mark invoice {} as overdue: {}", invoiceId, e.getMessage());
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
    @SchedulerLock(name = "invoice-overdue-reminders", lockAtMostFor = "PT15M")
    public void fireOverdueReminders() {
        List<OverdueInvoice> overdue =
            overdueInvoices.findRemindable(InvoiceReminderExecutor.MAX_REMINDERS);
        if (overdue.isEmpty()) {
            return;
        }

        int fired = 0;
        for (OverdueInvoice invoice : overdue) {
            try {
                fireInvoiceOverdueTrigger(invoice);
                fired++;
            } catch (Exception e) {
                log.error("Failed to fire INVOICE_OVERDUE for invoice {}: {}",
                    invoice.id(), e.getMessage());
            }
        }
        log.info("Relances factures : trigger INVOICE_OVERDUE tire pour {}/{} facture(s) en retard",
            fired, overdue.size());
    }

    private void fireInvoiceOverdueTrigger(OverdueInvoice invoice) {
        automationEngine.fireTrigger(AutomationTrigger.INVOICE_OVERDUE,
            invoice.organizationId(),
            new AutomationSubject(AutomationSubject.TYPE_INVOICE, invoice.id(),
                Map.of(AutomationSubject.DATA_DAYS_OVERDUE, invoice.daysOverdue())));
    }
}
