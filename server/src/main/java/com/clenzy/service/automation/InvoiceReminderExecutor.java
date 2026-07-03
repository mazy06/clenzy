package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.Intervention;
import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.Reservation;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationService;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Executeur SEND_INVOICE_REMINDER (fiche 08, F5a) : relance par email le client
 * d'une facture OVERDUE, a J+3 puis J+7 apres le passage en retard —
 * <b>maximum 2 relances par facture</b>, idempotence portee en base par
 * {@code invoices.overdue_reminder_count} / {@code overdue_last_reminder_at}
 * (migration 0308), en filet sous l'idempotence generique du moteur.
 *
 * <p>Le destinataire est resolu cote serveur : voyageur de la reservation liee,
 * sinon demandeur de l'intervention liee. Tout contenu d'origine utilisateur est
 * echappe ({@link StringUtils#escapeHtml}). L'envoi email (HTTP externe) se fait
 * hors transaction DB : l'executeur n'est pas transactionnel, la mise a jour du
 * compteur est un save court apres envoi.</p>
 *
 * <p>Si aucun email client n'est resolvable, la relance est consommee (compteur
 * incremente) et les admins/managers de l'org sont notifies — sinon la meme
 * facture re-notifierait indefiniment.</p>
 */
@Service
public class InvoiceReminderExecutor implements AutomationActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(InvoiceReminderExecutor.class);

    /** Public : le scheduler des relances (autre package) pre-filtre sur ce budget. */
    public static final int MAX_REMINDERS = 2;
    static final int FIRST_REMINDER_DAYS = 3;
    static final int SECOND_REMINDER_DAYS = 7;

    private final InvoiceRepository invoiceRepository;
    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;

    public InvoiceReminderExecutor(InvoiceRepository invoiceRepository,
                                   ReservationRepository reservationRepository,
                                   InterventionRepository interventionRepository,
                                   EmailService emailService,
                                   NotificationService notificationService) {
        this.invoiceRepository = invoiceRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.emailService = emailService;
        this.notificationService = notificationService;
    }

    @Override
    public AutomationAction action() {
        return AutomationAction.SEND_INVOICE_REMINDER;
    }

    @Override
    public ExecutionResult execute(AutomationRule rule, AutomationActionContext ctx) {
        Long invoiceId = ctx.subjectId();
        if (invoiceId == null || !AutomationSubject.TYPE_INVOICE.equals(ctx.subjectType())) {
            // Regle mal cablée : echec explicite (statut FAILED cote moteur).
            throw new IllegalStateException("SEND_INVOICE_REMINDER attend un sujet "
                + AutomationSubject.TYPE_INVOICE + " (recu : " + ctx.subjectType()
                + "#" + ctx.subjectId() + ", regle " + rule.getId() + ")");
        }

        Invoice invoice = invoiceRepository.findById(invoiceId).orElse(null);
        if (invoice == null) {
            throw new IllegalStateException("Facture introuvable : " + invoiceId);
        }
        // findById contourne le filtre Hibernate : validation d'organisation explicite.
        if (!ctx.orgId().equals(invoice.getOrganizationId())) {
            throw new IllegalStateException("Facture " + invoiceId
                + " hors de l'organisation " + ctx.orgId());
        }
        if (invoice.getStatus() != InvoiceStatus.OVERDUE) {
            return ExecutionResult.skipped("facture " + invoice.getInvoiceNumber()
                + " en statut " + invoice.getStatus() + " (plus en retard)");
        }
        if (invoice.getOverdueReminderCount() >= MAX_REMINDERS) {
            return ExecutionResult.skipped("maximum de " + MAX_REMINDERS
                + " relances atteint pour la facture " + invoice.getInvoiceNumber());
        }

        long daysOverdue = daysOverdue(invoice);
        int requiredDays = invoice.getOverdueReminderCount() == 0 ? FIRST_REMINDER_DAYS : SECOND_REMINDER_DAYS;
        if (daysOverdue < requiredDays) {
            return ExecutionResult.skipped("facture " + invoice.getInvoiceNumber()
                + " en retard de " + daysOverdue + " j (< J+" + requiredDays + ", trop tot)");
        }
        // Garde anti-rafale : jamais deux relances a moins de 24 h (double declenchement).
        if (invoice.getOverdueLastReminderAt() != null
                && invoice.getOverdueLastReminderAt().isAfter(LocalDateTime.now().minusDays(1))) {
            return ExecutionResult.skipped("facture " + invoice.getInvoiceNumber()
                + " deja relancee il y a moins de 24 h");
        }

        Recipient recipient = resolveRecipient(invoice);
        boolean emailSent = false;
        if (recipient != null) {
            // Envoi HTTP externe HORS transaction DB (executeur non transactionnel).
            emailService.sendContactMessage(
                recipient.email(), recipient.name(), null, null,
                buildSubject(invoice),
                buildHtmlBody(invoice, recipient.name(), daysOverdue),
                List.of());
            emailSent = true;
        } else {
            log.warn("Relance facture: aucun email client resolvable pour la facture {} — relance consommee, "
                + "notification interne seule", invoiceId);
        }

        int reminderNumber = invoice.getOverdueReminderCount() + 1;
        invoice.setOverdueReminderCount(reminderNumber);
        invoice.setOverdueLastReminderAt(LocalDateTime.now());
        invoiceRepository.save(invoice);

        notifyStaff(invoice, reminderNumber, daysOverdue, emailSent, recipient);

        log.info("Relance facture: facture {} — relance {}/{} (J+{}, email {})",
            invoice.getInvoiceNumber(), reminderNumber, MAX_REMINDERS, daysOverdue,
            emailSent ? "envoye" : "absent");
        return ExecutionResult.executed();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static long daysOverdue(Invoice invoice) {
        LocalDate since = invoice.getOverdueNotifiedAt() != null
            ? invoice.getOverdueNotifiedAt().toLocalDate()
            : invoice.getDueDate();
        return since != null ? ChronoUnit.DAYS.between(since, LocalDate.now()) : 0;
    }

    private record Recipient(String email, String name) {}

    /** Email du client : voyageur de la reservation liee, sinon demandeur de l'intervention liee. */
    private Recipient resolveRecipient(Invoice invoice) {
        if (invoice.getReservationId() != null) {
            Reservation reservation = reservationRepository.findById(invoice.getReservationId()).orElse(null);
            if (reservation != null
                    && invoice.getOrganizationId().equals(reservation.getOrganizationId())
                    && reservation.getGuest() != null
                    && reservation.getGuest().getEmail() != null
                    && !reservation.getGuest().getEmail().isBlank()) {
                return new Recipient(reservation.getGuest().getEmail(), reservation.getGuest().getFullName());
            }
        }
        if (invoice.getInterventionId() != null) {
            Intervention intervention = interventionRepository.findById(invoice.getInterventionId()).orElse(null);
            if (intervention != null
                    && invoice.getOrganizationId().equals(intervention.getOrganizationId())
                    && intervention.getRequestor() != null
                    && intervention.getRequestor().getEmail() != null
                    && !intervention.getRequestor().getEmail().isBlank()) {
                var requestor = intervention.getRequestor();
                String name = ((requestor.getFirstName() != null ? requestor.getFirstName() : "") + " "
                    + (requestor.getLastName() != null ? requestor.getLastName() : "")).trim();
                return new Recipient(requestor.getEmail(), name.isBlank() ? null : name);
            }
        }
        return null;
    }

    private static String buildSubject(Invoice invoice) {
        return "Rappel : facture " + invoice.getInvoiceNumber() + " en attente de paiement";
    }

    private static String buildHtmlBody(Invoice invoice, String recipientName, long daysOverdue) {
        String name = StringUtils.escapeHtml(
            recipientName != null && !recipientName.isBlank() ? recipientName : "Madame, Monsieur");
        String number = StringUtils.escapeHtml(invoice.getInvoiceNumber());
        String amount = StringUtils.escapeHtml(
            invoice.getTotalTtc() != null ? invoice.getTotalTtc().toPlainString() : "-");
        String currency = StringUtils.escapeHtml(invoice.getCurrency() != null ? invoice.getCurrency() : "EUR");
        String dueDate = StringUtils.escapeHtml(
            invoice.getDueDate() != null ? invoice.getDueDate().toString() : "-");
        String seller = StringUtils.escapeHtml(invoice.getSellerName() != null ? invoice.getSellerName() : "");

        return "<p>Bonjour " + name + ",</p>"
            + "<p>Sauf erreur de notre part, la facture <strong>" + number + "</strong> d'un montant de "
            + "<strong>" + amount + " " + currency + "</strong>, echue le " + dueDate
            + ", reste impayee a ce jour (" + daysOverdue + " jour(s) de retard).</p>"
            + "<p>Nous vous remercions de bien vouloir proceder a son reglement dans les meilleurs delais. "
            + "Si le paiement a deja ete effectue, merci de ne pas tenir compte de ce message.</p>"
            + (seller.isBlank() ? "" : "<p>Cordialement,<br/>" + seller + "</p>");
    }

    private void notifyStaff(Invoice invoice, int reminderNumber, long daysOverdue,
                             boolean emailSent, Recipient recipient) {
        try {
            String detail = emailSent
                ? "Relance " + reminderNumber + "/" + MAX_REMINDERS + " envoyee a "
                    + (recipient != null ? recipient.email() : "?")
                : "Aucun email client resolvable — relance " + reminderNumber + "/" + MAX_REMINDERS
                    + " non envoyee, action manuelle requise";
            notificationService.notifyAdminsAndManagersByOrgId(invoice.getOrganizationId(),
                NotificationKey.PAYMENT_DEFERRED_OVERDUE,
                "Facture " + invoice.getInvoiceNumber() + " impayee (J+" + daysOverdue + ")",
                detail,
                "/billing?highlight=" + invoice.getId());
        } catch (Exception e) {
            log.warn("Relance facture: notification interne en echec pour la facture {}: {}",
                invoice.getId(), e.getMessage());
        }
    }
}
