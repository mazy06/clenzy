package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.clenzy.service.InvoicePaymentCoordination.require;

/** Confirmation après lecture canonique Stripe hors transaction. */
@Service
public class InvoicePaymentReconciliationService {
    private final EntityManager em;
    private final TenantContext tenant;
    private final PaymentTransactionRepository payments;
    private final PaymentPersistence persistence;
    private final InvoicePaymentCoordination invoices;
    private final ReservationPaymentReconciliationService reservations;

    public InvoicePaymentReconciliationService(EntityManager em, TenantContext tenant, PaymentTransactionRepository payments,
            PaymentPersistence persistence, InvoicePaymentCoordination invoices, ReservationPaymentReconciliationService reservations) {
        this.em = em; this.tenant = tenant; this.payments = payments; this.persistence = persistence;
        this.invoices = invoices; this.reservations = reservations;
    }

    @Transactional
    public void confirm(String ref, String session) {
        var tx = lock(ref, session);
        require(tx.getStatus() != TransactionStatus.REFUNDED && tx.getStatus() != TransactionStatus.CANCELLED,
                "Paiement annulé ou remboursé : rapprochement requis");
        persistence.completeTransaction(ref);
        if (ReservationPaymentService.SOURCE_TYPE.equals(tx.getSourceType())) reservations.reconcile(ref);
        invoices.reconcile(ref);
    }

    @Transactional
    public void expire(String ref, String session) {
        var tx = lock(ref, session);
        if (tx.getStatus() == TransactionStatus.COMPLETED || tx.getStatus() == TransactionStatus.REFUNDED) return;
        if (tx.getStatus() == TransactionStatus.CANCELLED && "Session Stripe expirée sans encaissement".equals(tx.getErrorMessage())) return;
        Long id = InvoicePaymentCoordination.invoiceId(tx.getMetadata());
        require(id != null, "Facture de tentative absente");
        if (ReservationPaymentService.SOURCE_TYPE.equals(tx.getSourceType())) {
            var stay = em.find(Reservation.class, tx.getSourceId());
            require(stay != null, "Séjour introuvable");
            em.refresh(stay, LockModeType.PESSIMISTIC_WRITE);
            require(Objects.equals(stay.getOrganizationId(), tx.getOrganizationId()) && Objects.equals(stay.getStripeSessionId(), session)
                    && stay.getPaidAt() == null && stay.getPaymentStatus() != PaymentStatus.PAID, "Séjour déjà rapproché");
            stay.setStripeSessionId(null); stay.setPaymentStatus(PaymentStatus.FAILED);
        }
        var invoice = em.find(Invoice.class, id);
        require(invoice != null, "Facture introuvable");
        em.refresh(invoice, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(invoice.getOrganizationId(), tx.getOrganizationId()) && Objects.equals(invoice.getPaymentTransactionId(), tx.getId())
                && invoice.getPaidAt() == null && invoice.getStatus() != InvoiceStatus.PAID, "Facture déjà rapprochée");
        invoice.setPaymentTransactionId(null); invoice.setPaymentMethod(null);
        tx.setStatus(TransactionStatus.CANCELLED); tx.setErrorMessage("Session Stripe expirée sans encaissement");
        tx.setIdempotencyKey(null);
    }

    private PaymentTransaction lock(String ref, String session) {
        var tx = payments.findByTransactionRef(ref).orElseThrow();
        require(Objects.equals(tx.getOrganizationId(), tenant.getRequiredOrganizationId()), "Paiement hors organisation");
        em.refresh(tx, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(tx.getOrganizationId(), tenant.getRequiredOrganizationId()) && Objects.equals(tx.getProviderTxId(), session), "Session incohérente");
        require(tx.getProviderType() == PaymentProviderType.STRIPE && tx.getPaymentType() == TransactionType.CHECKOUT
                && (InvoicePaymentCoordination.SOURCE_TYPE.equals(tx.getSourceType()) || ReservationPaymentService.SOURCE_TYPE.equals(tx.getSourceType()))
                && InvoicePaymentCoordination.invoiceId(tx.getMetadata()) != null, "Paiement de facture incohérent");
        return tx;
    }
}
