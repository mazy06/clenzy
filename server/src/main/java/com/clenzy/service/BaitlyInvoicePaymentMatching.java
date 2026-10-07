package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Rapprochement documentaire Baitly : aucune collecte, écriture comptable ou émission d'avoir. */
@Service
public class BaitlyInvoicePaymentMatching {
    static final String CANDIDATES_SQL = """
        SELECT i.id, i.organization_id FROM invoices i
        WHERE i.id > :after AND i.invoice_type='GUEST' AND i.duplicate_of_id IS NULL
          AND i.original_invoice_id IS NULL AND i.refund_transaction_id IS NULL AND i.payout_id IS NULL
          AND i.status IN ('ISSUED','SENT','OVERDUE')
          AND EXISTS (SELECT 1 FROM payment_transactions p
            WHERE p.organization_id=i.organization_id AND p.payment_type='CHECKOUT'
              AND p.provider_type='STRIPE' AND p.status='COMPLETED'
              AND ((p.source_type='RESERVATION' AND p.source_id=i.reservation_id AND i.intervention_id IS NULL)
                OR (p.source_type='INTERVENTION' AND p.source_id=i.intervention_id AND i.reservation_id IS NULL)
                OR (p.source_type='INTERVENTION_BATCH' AND i.reservation_id IS NULL AND EXISTS
                  (SELECT 1 FROM intervention_payment_allocations a WHERE a.transaction_id=p.id
                    AND a.organization_id=i.organization_id AND a.intervention_id=i.intervention_id))))
        ORDER BY i.id LIMIT 20
        """;
    private final EntityManager em;
    private final PaymentTransactionRepository payments;
    private final TenantContext tenant;
    public BaitlyInvoicePaymentMatching(EntityManager em, PaymentTransactionRepository payments, TenantContext tenant) {
        this.em = em; this.payments = payments; this.tenant = tenant;
    }
    public record Candidate(Long invoiceId, Long organizationId) {}
    public record Evidence(Long invoiceId, Long organizationId, String ref, String sessionId,
            String source, Long sourceId, BigDecimal collected, String currency, String interventionIds,
            Long interventionId, Long reservationId, BigDecimal invoiceAmount, LocalDateTime paidAt) {}

    /** Le curseur empêche les dossiers ambigus de monopoliser chaque passage du worker. */
    @Transactional(readOnly = true)
    public List<Candidate> candidates(long after) {
        @SuppressWarnings("unchecked") var rows = (List<Object[]>) em.createNativeQuery(CANDIDATES_SQL)
                .setParameter("after", after).getResultList();
        return rows.stream().map(r -> new Candidate(((Number) r[0]).longValue(), ((Number) r[1]).longValue())).toList();
    }

    @Transactional(readOnly = true)
    public Evidence prepare(Long invoiceId) { return evidence(invoice(invoiceId)); }

    /** Relecture sous verrous après le GET Stripe ; l'instantané réseau n'autorise pas un autre dossier. */
    @Transactional
    public void apply(Evidence checked) {
        require(Objects.equals(tenant.getRequiredOrganizationId(), checked.organizationId()), "Facture hors organisation");
        var payment = payments.lockByReference(checked.organizationId(), checked.ref()).orElseThrow();
        em.refresh(payment);
        var invoice = invoice(checked.invoiceId());
        lockDebt(invoice);
        em.refresh(invoice, LockModeType.PESSIMISTIC_WRITE);
        require(checked.equals(evidence(invoice)), "La preuve de règlement a changé pendant la vérification");
        invoice.setPaymentTransactionId(payment.getId()); invoice.setStatus(InvoiceStatus.PAID);
        invoice.setPaymentMethod("STRIPE"); invoice.setPaidAt(checked.paidAt());
        record(payment, invoice.getId(), "MATCHED");
    }

    private Evidence evidence(Invoice invoice) {
        require(Objects.equals(tenant.getRequiredOrganizationId(), invoice.getOrganizationId()), "Facture hors organisation");
        validateInvoice(invoice);
        var funding = relatedPayments(invoice).stream().filter(this::unresolvedOrPaid).toList();
        require(funding.size() == 1, "Plusieurs tentatives ou encaissements : rapprochement requis");
        var payment = funding.getFirst();
        require(payment.getStatus() == TransactionStatus.COMPLETED && payment.getProviderType() == PaymentProviderType.STRIPE
                && "EUR".equals(payment.getCurrency()) && payment.getProviderTxId() != null
                && payment.getProviderTxId().startsWith("cs_") && payment.getAmount() != null && payment.getAmount().signum() > 0
                && Set.of("RESERVATION", "INTERVENTION", "INTERVENTION_BATCH").contains(payment.getSourceType()),
                "Encaissement confirmé Stripe EUR requis");
        require(invoice.getPaymentTransactionId() == null || Objects.equals(invoice.getPaymentTransactionId(), payment.getId()),
                "Une autre transaction est liée à la facture");
        var debt = debt(invoice, payment);
        require(equal(invoice.getTotalTtc(), debt.amount()) && payment.getCurrency().equals(invoice.getCurrency())
                && debt.paidAt() != null, "Montant, devise ou date de règlement à rapprocher");
        String receipt = "INTERVENTION_BATCH".equals(payment.getSourceType())
                ? payment.getTransactionRef() + ":" + invoice.getInterventionId() : payment.getSourceId().toString();
        requireReceipt(payment.getOrganizationId(), receipt, debt.amount(), payment.getCurrency());
        return new Evidence(invoice.getId(), invoice.getOrganizationId(), payment.getTransactionRef(), payment.getProviderTxId(),
                payment.getSourceType(), payment.getSourceId(), payment.getAmount(), payment.getCurrency(),
                payment.getMetadata() == null ? null : (String) payment.getMetadata().get("interventionIds"),
                invoice.getInterventionId(), invoice.getReservationId(), debt.amount(), debt.paidAt());
    }

    private record Debt(BigDecimal amount, LocalDateTime paidAt) {}
    private Debt debt(Invoice invoice, PaymentTransaction payment) {
        if (invoice.getReservationId() != null) {
            var stay = em.find(Reservation.class, invoice.getReservationId());
            require(stay != null && Objects.equals(stay.getOrganizationId(), invoice.getOrganizationId())
                    && "RESERVATION".equals(payment.getSourceType()) && Objects.equals(stay.getId(), payment.getSourceId())
                    && stay.getPaymentCollection() == PaymentCollection.PMS && stay.getPaymentStatus() == PaymentStatus.PAID
                    && !"cancelled".equalsIgnoreCase(stay.getStatus())
                    && Objects.equals(stay.getStripeSessionId(), payment.getProviderTxId())
                    && Objects.equals(stay.getCurrency(), payment.getCurrency()) && equal(stay.getTotalPrice(), payment.getAmount())
                    && (stay.getCreditApplied() == null || stay.getCreditApplied().signum() == 0), "Dette du séjour à rapprocher");
            return new Debt(stay.getTotalPrice(), stay.getPaidAt());
        }
        var mission = em.find(Intervention.class, invoice.getInterventionId());
        require(mission != null && Objects.equals(mission.getOrganizationId(), invoice.getOrganizationId())
                && mission.getPaymentStatus() == PaymentStatus.PAID && Objects.equals(mission.getStripeSessionId(), payment.getProviderTxId())
                && Objects.equals(mission.getCurrency(), payment.getCurrency()), "Dette de la prestation à rapprocher");
        if ("INTERVENTION_BATCH".equals(payment.getSourceType())) {
            var parts = em.createQuery("from InterventionPaymentAllocation a where a.organizationId=:org and a.transaction.id=:tx", InterventionPaymentAllocation.class)
                    .setParameter("org", invoice.getOrganizationId()).setParameter("tx", payment.getId()).getResultList();
            InterventionPaymentBatch.validate(payment, parts);
            require(parts.stream().allMatch(p -> p.getConfirmedAt() != null), "Lot pas entièrement rapproché");
            var part = parts.stream().filter(p -> p.getInterventionId().equals(mission.getId())).findFirst().orElseThrow();
            require(equal(mission.getEstimatedCost(), part.getAmount()), "Montant de la prestation modifié");
            return new Debt(part.getAmount(), part.getConfirmedAt());
        }
        require("INTERVENTION".equals(payment.getSourceType()) && Objects.equals(payment.getSourceId(), mission.getId())
                && equal(payment.getAmount(), mission.getEstimatedCost()), "Encaissement d'une autre prestation");
        return new Debt(mission.getEstimatedCost(), mission.getPaidAt());
    }

    private void validateInvoice(Invoice invoice) {
        require(invoice.getInvoiceType() == InvoiceType.GUEST && invoice.getPayoutId() == null
                && invoice.getDuplicateOfId() == null && invoice.getOriginalInvoiceId() == null && invoice.getRefundTransactionId() == null
                && Set.of(InvoiceStatus.ISSUED, InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PAID).contains(invoice.getStatus())
                && (invoice.getInterventionId() == null) != (invoice.getReservationId() == null), "Facture non rapprochable automatiquement");
        String origin = invoice.getInterventionId() == null ? "reservationId" : "interventionId";
        Long id = invoice.getInterventionId() == null ? invoice.getReservationId() : invoice.getInterventionId();
        long count = em.createQuery("select count(i) from Invoice i where i.organizationId=:org and i." + origin + "=:id "
                + "and i.invoiceType=com.clenzy.model.InvoiceType.GUEST and i.duplicateOfId is null "
                + "and i.status<>com.clenzy.model.InvoiceStatus.CANCELLED", Long.class)
                .setParameter("org", invoice.getOrganizationId()).setParameter("id", id).getSingleResult();
        require(count == 1, "Plusieurs factures ou un avoir : rapprochement requis");
    }

    private List<PaymentTransaction> relatedPayments(Invoice invoice) {
        Long requestId = null;
        if (invoice.getInterventionId() != null) {
            var mission = em.find(Intervention.class, invoice.getInterventionId());
            require(mission != null && Objects.equals(mission.getOrganizationId(), invoice.getOrganizationId()), "Prestation hors organisation");
            if (mission.getServiceRequest() != null) requestId = mission.getServiceRequest().getId();
        }
        return em.createQuery("select p from PaymentTransaction p where p.organizationId=:org "
                + "and p.paymentType=com.clenzy.model.TransactionType.CHECKOUT and ((p.sourceType='INVOICE' and p.sourceId in "
                + "(select i.id from Invoice i where i.organizationId=:org and (i.id=:invoice or i.interventionId=:mission or i.reservationId=:stay))) "
                + "or (p.sourceType='RESERVATION' and p.sourceId=:stay) or (p.sourceType='INTERVENTION' and p.sourceId=:mission) "
                + "or (p.sourceType='SERVICE_REQUEST' and p.sourceId=:request) or (p.sourceType='INTERVENTION_BATCH' and exists "
                + "(select a.id from InterventionPaymentAllocation a where a.organizationId=:org and a.transaction.id=p.id and a.interventionId=:mission))) order by p.id", PaymentTransaction.class)
                .setParameter("org", invoice.getOrganizationId()).setParameter("invoice", invoice.getId())
                .setParameter("mission", invoice.getInterventionId()).setParameter("stay", invoice.getReservationId())
                .setParameter("request", requestId).getResultList();
    }

    private boolean unresolvedOrPaid(PaymentTransaction p) {
        return p.getStatus() != TransactionStatus.CANCELLED && !(p.getStatus() == TransactionStatus.FAILED
                && p.getMetadata() != null && (Boolean.TRUE.equals(p.getMetadata().get("batchRetryAllowed"))
                    || BaitlyInterventionCheckoutExpiryWriter.retryProven(p)));
    }

    private void lockDebt(Invoice invoice) {
        if (invoice.getInterventionId() == null) {
            var stay = em.find(Reservation.class, invoice.getReservationId());
            require(stay != null && Objects.equals(stay.getOrganizationId(), invoice.getOrganizationId()), "Séjour hors organisation");
            em.refresh(stay, LockModeType.PESSIMISTIC_WRITE); return;
        }
        var mission = em.find(Intervention.class, invoice.getInterventionId());
        require(mission != null && Objects.equals(mission.getOrganizationId(), invoice.getOrganizationId()), "Prestation hors organisation");
        Long before = mission.getServiceRequest() == null ? null : mission.getServiceRequest().getId();
        if (mission.getServiceRequest() != null) em.refresh(mission.getServiceRequest(), LockModeType.PESSIMISTIC_WRITE);
        em.refresh(mission, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(before, mission.getServiceRequest() == null ? null : mission.getServiceRequest().getId()), "Demande liée modifiée");
    }

    private void requireReceipt(Long org, String ref, BigDecimal amount, String currency) {
        var entries = em.createQuery("from LedgerEntry e where e.organizationId=:org and e.referenceType=com.clenzy.model.LedgerReferenceType.PAYMENT and e.referenceId=:ref", LedgerEntry.class)
                .setParameter("org", org).setParameter("ref", ref).getResultList();
        BigDecimal total = BigDecimal.ZERO;
        for (var entry : entries) {
            var other = entries.stream().filter(e -> Objects.equals(e.getId(), entry.getCounterpartEntryId())).findFirst().orElseThrow();
            require(Objects.equals(other.getCounterpartEntryId(), entry.getId()) && entry.getEntryType() != other.getEntryType()
                    && equal(entry.getAmount(), other.getAmount()) && currency.equals(entry.getCurrency()) && entry.getAmount().signum() > 0,
                    "Écritures d'encaissement à rapprocher");
            if (entry.getEntryType() == LedgerEntryType.DEBIT) total = total.add(entry.getAmount());
        }
        require(equal(total, amount), "Encaissement absent ou incomplet dans le journal");
    }

    @Transactional
    public void recordFailure(Long invoiceId) {
        for (var candidate : relatedPayments(invoice(invoiceId))) {
            if (candidate.getStatus() != TransactionStatus.COMPLETED) continue;
            var payment = payments.lockByReference(tenant.getRequiredOrganizationId(), candidate.getTransactionRef()).orElseThrow();
            em.refresh(payment); record(payment, invoiceId, "REVIEW_REQUIRED");
        }
    }
    private void record(PaymentTransaction payment, Long invoiceId, String state) {
        var metadata = new HashMap<String,Object>(payment.getMetadata() == null ? Map.of() : payment.getMetadata());
        var matches = new HashMap<String,Object>();
        if (metadata.get("invoiceMatches") instanceof Map<?,?> previous) previous.forEach((k,v) -> matches.put(k.toString(),v));
        matches.put(invoiceId.toString(), Map.of("state", state, "checkedAt", LocalDateTime.now().toString()));
        metadata.put("invoiceMatches", matches); payment.setMetadata(metadata);
    }
    private Invoice invoice(Long id) {
        var invoice = em.find(Invoice.class, id);
        require(invoice != null && Objects.equals(tenant.getRequiredOrganizationId(), invoice.getOrganizationId()), "Facture hors organisation");
        return invoice;
    }
    private static boolean equal(BigDecimal left, BigDecimal right) { return left != null && right != null && left.compareTo(right) == 0; }
}
