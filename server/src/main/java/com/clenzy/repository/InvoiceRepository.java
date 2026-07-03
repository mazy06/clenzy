package com.clenzy.repository;

import com.clenzy.model.Invoice;
import com.clenzy.model.InvoiceStatus;
import com.clenzy.model.InvoiceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    List<Invoice> findByOrganizationId(Long organizationId);

    List<Invoice> findByOrganizationIdAndStatus(Long organizationId, InvoiceStatus status);

    Optional<Invoice> findByOrganizationIdAndInvoiceNumber(Long organizationId, String invoiceNumber);

    /**
     * Facture avec ses lignes initialisées (fetch join) — pour la génération PDF
     * hors transaction : les lignes sont LAZY et open-in-view est désactivé,
     * l'appelant doit donc recevoir une entité complètement initialisée à la
     * sortie de la transaction courte du repository.
     */
    @Query("SELECT i FROM Invoice i LEFT JOIN FETCH i.lines WHERE i.id = :id")
    Optional<Invoice> findWithLinesById(@Param("id") Long id);

    /** Toutes les factures (séjour + commission) liées à une réservation. */
    List<Invoice> findAllByReservationId(Long reservationId);

    /** Facture d'une réservation par nature (unicité GUEST / COMMISSION). */
    Optional<Invoice> findByReservationIdAndInvoiceType(Long reservationId, InvoiceType invoiceType);

    Optional<Invoice> findByPayoutId(Long payoutId);

    Optional<Invoice> findByInterventionId(Long interventionId);

    Optional<Invoice> findByDocumentGenerationId(Long documentGenerationId);

    List<Invoice> findByDuplicateOfId(Long duplicateOfId);

    @Query("SELECT i FROM Invoice i WHERE i.organizationId = :orgId " +
           "AND i.invoiceDate BETWEEN :from AND :to " +
           "ORDER BY i.invoiceDate DESC")
    List<Invoice> findByOrganizationIdAndDateRange(
        @Param("orgId") Long organizationId,
        @Param("from") LocalDate from,
        @Param("to") LocalDate to
    );

    /**
     * Factures non encore synchronisees vers Pennylane (statuts syncables uniquement).
     */
    @Query("SELECT i FROM Invoice i WHERE i.organizationId = :orgId " +
           "AND i.pennylaneInvoiceId IS NULL " +
           "AND i.status IN :statuses " +
           "ORDER BY i.invoiceDate DESC")
    List<Invoice> findPendingPennylaneSync(
        @Param("orgId") Long organizationId,
        @Param("statuses") List<InvoiceStatus> statuses
    );

    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.organizationId = :orgId " +
           "AND i.pennylaneInvoiceId IS NULL " +
           "AND i.status IN :statuses")
    long countPendingPennylaneSync(
        @Param("orgId") Long organizationId,
        @Param("statuses") List<InvoiceStatus> statuses
    );

    /**
     * Factures SENT ou ISSUED dont la date d'echeance est depassee.
     * Utilisee par InvoiceOverdueScheduler (cross-tenant, pas de filtre org).
     */
    @Query("SELECT i FROM Invoice i WHERE i.status IN :statuses " +
           "AND i.dueDate IS NOT NULL AND i.dueDate < :today")
    List<Invoice> findOverdueCandidates(
        @Param("statuses") List<InvoiceStatus> statuses,
        @Param("today") LocalDate today
    );

    /**
     * Factures OVERDUE avec budget de relance restant (moins de {@code max} relances
     * envoyees). Utilisee par InvoiceOverdueScheduler pour re-tirer le trigger
     * INVOICE_OVERDUE quotidien (cross-tenant, pas de filtre org — F5a).
     */
    List<Invoice> findByStatusAndOverdueReminderCountLessThan(InvoiceStatus status, int maxReminders);
}
