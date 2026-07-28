package com.clenzy.service;

import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.repository.InvoiceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Accès transactionnel aux factures en retard — extrait de
 * {@code InvoiceOverdueScheduler} (audit d'isolation RLS, plan REM-T-01).
 *
 * <h2>Pourquoi ce bean séparé</h2>
 * <p>Le scheduler ne peut pas être {@code @Transactional} : ses deux passes tirent le
 * trigger {@code INVOICE_OVERDUE}, dont les exécuteurs envoient des emails — un appel
 * externe ne doit jamais se produire dans une transaction DB (règle CLAUDE.md n°2). Il
 * appelait donc le repository directement, ce qui ouvre la transaction dans
 * {@code SimpleJpaRepository}, <b>hors</b> du pointcut de
 * {@link com.clenzy.tenant.RlsTenantGucAspect} ({@code @Transactional && within(com.clenzy..*)}).
 * Aucune GUC n'était posée : sous Row-Level Security active, le balayage renverrait zéro
 * facture <b>sans lever d'erreur</b> — plus aucun passage en OVERDUE, plus aucune relance,
 * et un {@code Marked 0 invoices} parfaitement normal dans les journaux.</p>
 *
 * <h2>Balayage cross-tenant assumé</h2>
 * <p>Ces requêtes parcourent délibérément toutes les organisations (cf.
 * {@link InvoiceRepository#findOverdueCandidates}) : il n'y a pas d'organisation courante à
 * poser. Le thread du scheduler n'ayant pas de contexte tenant, {@code RlsGuc} accorde le
 * bypass prévu pour les flux de fond (cf. {@code docs/security/RLS-ROLLOUT-RUNBOOK.md}, §
 * « Flux background »). Ce qui manquait n'était donc pas le droit de voir toutes les orgs,
 * mais une transaction que l'aspect puisse instrumenter pour l'accorder.</p>
 *
 * <p>Chaque méthode publique porte sa propre {@link Transactional} et est appelée depuis un
 * <b>autre</b> bean : elle passe par le proxy Spring, l'aspect pose les GUC, et la
 * frontière transactionnelle reste courte — les triggers partent entre deux appels, jamais
 * dedans.</p>
 */
@Service
public class InvoiceOverduePersistence {

    /** Instantané d'une facture en retard, lisible une fois la transaction refermée. */
    public record OverdueInvoice(Long id, Long organizationId, String invoiceNumber,
                                 LocalDate dueDate, long daysOverdue) {}

    private final InvoiceRepository invoiceRepository;

    public InvoiceOverduePersistence(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    /**
     * Identifiants des factures échues encore dans un statut candidat.
     *
     * <p>Seuls les identifiants sortent : chaque facture est rechargée par
     * {@link #markOverdue(Long)} dans sa propre transaction courte, plutôt que manipulée
     * détachée pendant toute la durée de la passe.</p>
     */
    @Transactional(readOnly = true)
    public List<Long> findOverdueCandidateIds(List<InvoiceStatus> statuses, LocalDate today) {
        return invoiceRepository.findOverdueCandidates(statuses, today).stream()
            .map(Invoice::getId)
            .toList();
    }

    /**
     * Passe une facture en OVERDUE et horodate le passage.
     *
     * @throws IllegalStateException si la facture a disparu entre le balayage et le marquage
     */
    @Transactional
    public OverdueInvoice markOverdue(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new IllegalStateException("Facture introuvable : " + invoiceId));
        invoice.setStatus(InvoiceStatus.OVERDUE);
        invoice.setOverdueNotifiedAt(LocalDateTime.now());
        return snapshot(invoiceRepository.save(invoice));
    }

    /** Factures OVERDUE ayant encore du budget de relance, avec leur retard du jour. */
    @Transactional(readOnly = true)
    public List<OverdueInvoice> findRemindable(int maxReminders) {
        return invoiceRepository
            .findByStatusAndOverdueReminderCountLessThan(InvoiceStatus.OVERDUE, maxReminders).stream()
            .map(InvoiceOverduePersistence::snapshot)
            .toList();
    }

    private static OverdueInvoice snapshot(Invoice invoice) {
        return new OverdueInvoice(invoice.getId(), invoice.getOrganizationId(),
            invoice.getInvoiceNumber(), invoice.getDueDate(), daysOverdue(invoice));
    }

    /** Jours de retard : depuis le passage OVERDUE, repli sur la date d'echeance. */
    private static long daysOverdue(Invoice invoice) {
        LocalDate since = invoice.getOverdueNotifiedAt() != null
            ? invoice.getOverdueNotifiedAt().toLocalDate()
            : invoice.getDueDate();
        return since != null ? Math.max(0, ChronoUnit.DAYS.between(since, LocalDate.now())) : 0;
    }
}
