package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.clenzy.service.InterventionPaymentBatch.require;

/** Transaction courte : encaissement, parts, missions et grand livre sont atomiques. */
@Service
public class InterventionBatchReconciliationService {
    private final PaymentTransactionRepository payments;
    private final InterventionPaymentAllocationRepository allocations;
    private final PaymentPersistence persistence;
    private final StripePaymentConfirmationService confirmation;
    private final TenantContext tenant;
    private final EntityManager em;
    private final InvoicePaymentCoordination invoices;

    public InterventionBatchReconciliationService(PaymentTransactionRepository payments,
            InterventionPaymentAllocationRepository allocations, PaymentPersistence persistence,
            StripePaymentConfirmationService confirmation, TenantContext tenant, EntityManager em, InvoicePaymentCoordination invoices) {
        this.payments = payments; this.allocations = allocations; this.persistence = persistence;
        this.confirmation = confirmation; this.tenant = tenant; this.em = em;
        this.invoices = invoices;
    }

    @Transactional
    public void confirm(String ref, String sessionId) {
        var tx = lock(ref);
        require(Objects.equals(sessionId, tx.getProviderTxId()), "Session du lot incohérente");
        require(tx.getStatus() != TransactionStatus.REFUNDED && tx.getStatus() != TransactionStatus.CANCELLED,
                "Lot remboursé ou annulé : rapprochement requis");
        persistence.completeTransaction(ref);
        // Le CAS vide le contexte JPA ; relire les allocations après cette transition.
        reconcileLocked(payments.findByTransactionRef(ref).orElseThrow());
    }

    /** Rejeu Kafka : ne peut jamais transformer à lui seul une transaction en paiement acquis. */
    @Transactional
    public void reconcile(String ref) {
        var tx = lock(ref);
        if (tx.getStatus() != TransactionStatus.COMPLETED) return;
        reconcileLocked(tx);
    }

    private void reconcileLocked(PaymentTransaction tx) {
        var parts = allocations.findForTransaction(tx.getOrganizationId(), tx.getTransactionRef());
        parts.forEach(em::refresh);
        InterventionPaymentBatch.validate(tx, parts);
        confirmation.confirmAllocatedPayment(tx, parts);
        invoices.reconcile(tx.getTransactionRef());
    }

    @Transactional
    public void expire(String ref, String sessionId) {
        var tx = lock(ref);
        require(Objects.equals(sessionId, tx.getProviderTxId()), "Session du lot incohérente");
        if (tx.getStatus() == TransactionStatus.COMPLETED || tx.getStatus() == TransactionStatus.REFUNDED) return;
        var parts = allocations.findForTransaction(tx.getOrganizationId(), ref);
        InterventionPaymentBatch.validate(tx, parts);
        require(parts.stream().noneMatch(a -> a.getConfirmedAt() != null), "Lot déjà rapproché");
        confirmation.markGroupedPaymentAsFailed(sessionId, (String) tx.getMetadata().get("interventionIds"));
        persistence.failTransaction(ref, "Session Stripe expirée sans encaissement");
        tx = payments.findByTransactionRef(ref).orElseThrow();
        var metadata = new HashMap<>(tx.getMetadata());
        metadata.put("batchRetryAllowed", true);
        tx.setMetadata(metadata);
        payments.save(tx);
        invoices.releaseExpiredBindings(tx);
    }

    private PaymentTransaction lock(String ref) {
        var tx = payments.findByTransactionRef(ref).orElseThrow();
        require(Objects.equals(tenant.getRequiredOrganizationId(), tx.getOrganizationId())
                && InterventionPaymentBatch.SOURCE_TYPE.equals(tx.getSourceType()), "Lot inaccessible");
        em.refresh(tx, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(tenant.getRequiredOrganizationId(), tx.getOrganizationId()), "Lot inaccessible");
        return tx;
    }
}
