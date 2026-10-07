package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/** La facture documente la dette : elle ne crée pas un second encaissement du séjour ou de la mission. */
@Service
public class InvoicePaymentCoordination {
    public static final String SOURCE_TYPE = "INVOICE";
    private final EntityManager em;
    private final TenantContext tenant;
    private final PaymentTransactionRepository payments;
    private final ServiceQuoteRepository quotes;
    private final InvoicePaymentRecipient recipients;
    private final ManagementContractService contracts;
    private final WalletService wallets;
    private final LedgerService ledger;

    public InvoicePaymentCoordination(EntityManager em, TenantContext tenant, PaymentTransactionRepository payments,
            ServiceQuoteRepository quotes, InvoicePaymentRecipient recipients, ManagementContractService contracts,
            WalletService wallets, LedgerService ledger) {
        this.em = em; this.tenant = tenant; this.payments = payments; this.quotes = quotes;
        this.recipients = recipients; this.contracts = contracts; this.wallets = wallets; this.ledger = ledger;
    }

    @Transactional(readOnly = true)
    public PaymentOrchestrationRequest prepare(Long id, String successUrl, String cancelUrl) {
        var invoice = invoice(id, tenant.getRequiredOrganizationId(), false);
        payable(invoice);
        var route = route(invoice);
        var recipient = recipients.resolve(invoice);
        var metadata = new HashMap<String, String>();
        metadata.put("invoiceId", id.toString());
        metadata.put("invoiceNumber", invoice.getInvoiceNumber());
        if (InterventionPaymentBatch.SOURCE_TYPE.equals(route.type())) {
            metadata.put("interventionIds", route.id().toString()); metadata.put("purpose", "FULL");
        } else if (ReservationPaymentService.SOURCE_TYPE.equals(route.type())) {
            metadata.put("reservation_id", route.id().toString());
        }
        return new PaymentOrchestrationRequest(invoice.getTotalTtc(), invoice.getCurrency(), route.type(), route.id(),
                "Règlement facture " + invoice.getInvoiceNumber(), recipient.email(), PaymentProviderType.STRIPE,
                successUrl, cancelUrl, metadata, route.key());
    }

    private record Route(String type, Long id, String key) {}

    private Route route(Invoice invoice) {
        Long org = invoice.getOrganizationId();
        if (invoice.getInvoiceType() == InvoiceType.COMMISSION) {
            require(invoice.getInterventionId() == null && invoice.getReservationId() != null && invoice.getPayoutId() == null,
                    "Origine de la commission à rapprocher");
            var stay = stay(invoice.getReservationId(), org, false);
            require(stay.getProperty() != null, "Logement de la commission absent");
            var contract = contracts.getActiveContract(stay.getProperty().getId(), org).orElseThrow(
                    () -> invalid("Contrat de gestion de la commission absent"));
            require(contract.getPaymentModel() == ManagementContract.PaymentModel.OWNER_COLLECTS,
                    "Cette commission est prélevée ou réglée par un autre circuit");
            return new Route(SOURCE_TYPE, invoice.getId(), "INVOICE-" + invoice.getId());
        }
        require(invoice.getInvoiceType() == InvoiceType.GUEST && invoice.getPayoutId() == null,
                "Nature de facture non payable par ce circuit");
        require((invoice.getInterventionId() == null) != (invoice.getReservationId() == null), "Origine de la facture ambiguë ou absente");
        if (invoice.getInterventionId() != null) {
            var mission = em.find(Intervention.class, invoice.getInterventionId());
            sameOrg(mission == null ? null : mission.getOrganizationId(), org);
            require(mission.getPaymentStatus() != PaymentStatus.PAID && mission.getPaymentStatus() != PaymentStatus.REFUNDED
                    && mission.getPaidAt() == null, "La prestation porte déjà un encaissement : rapprochez la facture");
            BigDecimal due = InterventionPaymentAmounts.payable(mission, quotes.findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                    mission.getId(), org), false);
            sameAmount(invoice, due, mission.getCurrency() == null ? "EUR" : mission.getCurrency());
            return new Route(InterventionPaymentBatch.SOURCE_TYPE, mission.getId(), "INT-BATCH-" + mission.getId());
        }
        var stay = stay(invoice.getReservationId(), org, false);
        require(ReservationPaymentState.canCollect(stay) && stay.getPaidAt() == null
                && (stay.getAmountPaid() == null || stay.getAmountPaid().signum() == 0),
                "Ce séjour est déjà encaissé, partiellement réglé ou collecté hors Baitly : rapprochez la facture");
        sameAmount(invoice, stay.getTotalPrice(), stay.getCurrency() == null ? "EUR" : stay.getCurrency());
        return new Route(ReservationPaymentService.SOURCE_TYPE, stay.getId(), "RESERVATION-" + stay.getId());
    }

    /** Appelé après les verrous des missions : racine de dette, puis facture, sans HTTP. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void lockForPayment(Long org, PaymentOrchestrationRequest request) {
        if (ReservationPaymentService.SOURCE_TYPE.equals(request.sourceType())) {
            var stay = stay(request.sourceId(), org, true);
            require(ReservationPaymentState.canCollect(stay) && stay.getPaidAt() == null
                    && (stay.getAmountPaid() == null || stay.getAmountPaid().signum() == 0), "Ce séjour ne peut plus être encaissé");
            require(stay.getStripeSessionId() == null || stay.getStripeSessionId().isBlank(), "Une session existe pour ce séjour : rapprochement requis");
            require(stay.getTotalPrice() != null && request.amount() != null && stay.getTotalPrice().compareTo(request.amount()) == 0
                    && request.currency().equalsIgnoreCase(stay.getCurrency() == null ? "EUR" : stay.getCurrency()), "Le montant du séjour a changé");
            require(payments.findByOrganizationIdAndSourceTypeAndSourceId(org, request.sourceType(), request.sourceId()).stream()
                    .noneMatch(t -> t.getPaymentType() == TransactionType.CHECKOUT && t.getStatus() != TransactionStatus.CANCELLED),
                    "Un paiement existe déjà pour ce séjour");
        }
        requireNoLegacyInvoicePayment(org, request);
        Long invoiceId = invoiceId(request.metadata());
        if (invoiceId == null) {
            require(!SOURCE_TYPE.equals(request.sourceType()), "Facture de paiement absente");
            return;
        }
        var invoice = invoice(invoiceId, org, true); payable(invoice);
        var route = route(invoice);
        require(route.type().equals(request.sourceType()) && route.id().equals(request.sourceId()), "La dette de la facture a changé");
        sameAmount(invoice, request.amount(), request.currency());
        require(invoice.getPaymentTransactionId() == null, "Une tentative existe pour cette facture : rapprochement requis");
        require(payments.findByOrganizationIdAndSourceTypeAndSourceId(org, SOURCE_TYPE, invoiceId).stream()
                .noneMatch(t -> t.getPaymentType() == TransactionType.CHECKOUT && t.getStatus() != TransactionStatus.CANCELLED),
                "Un ancien paiement de facture doit être rapproché");
    }

    /** Les anciens liens INVOICE ne doivent pas être contournés par le bouton de la dette. */
    private void requireNoLegacyInvoicePayment(Long orgId, PaymentOrchestrationRequest request) {
        boolean reservation = ReservationPaymentService.SOURCE_TYPE.equals(request.sourceType());
        var missions = InterventionPaymentCoordination.missionIds(request);
        if (!reservation && missions.isEmpty()) return;
        String origin = reservation ? "i.reservationId = :origin" : "i.interventionId in :origin";
        long attempts = em.createQuery("select count(p) from PaymentTransaction p, Invoice i "
                + "where p.organizationId = :org and i.organizationId = :org and p.sourceType = :source "
                + "and p.sourceId = i.id and i.invoiceType = :nature and p.paymentType = :kind "
                + "and p.status <> :cancelled and " + origin, Long.class)
                .setParameter("org", orgId).setParameter("source", SOURCE_TYPE)
                .setParameter("nature", InvoiceType.GUEST).setParameter("kind", TransactionType.CHECKOUT)
                .setParameter("cancelled", TransactionStatus.CANCELLED)
                .setParameter("origin", reservation ? request.sourceId() : missions).getSingleResult();
        require(attempts == 0, "Un ancien paiement de facture doit être rapproché avant d'encaisser cette dette");
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void bindPrepared(PaymentTransaction tx) {
        Long id = invoiceId(tx.getMetadata());
        if (id != null) {
            var invoice = invoice(id, tx.getOrganizationId(), true);
            require(invoice.getPaymentTransactionId() == null, "Facture déjà associée à une tentative");
            invoice.setPaymentTransactionId(tx.getId()); invoice.setPaymentMethod(tx.getProviderType().name());
        }
    }

    /** Reprise d'une session existante de la même dette ; ne fabrique pas un règlement. */
    @Transactional
    public void bindExisting(Long invoiceId, Long transactionId) {
        var tx = em.find(PaymentTransaction.class, transactionId);
        sameOrg(tx == null ? null : tx.getOrganizationId(), tenant.getRequiredOrganizationId());
        var invoice = invoice(invoiceId, tx.getOrganizationId(), true);
        if (Objects.equals(invoice.getPaymentTransactionId(), tx.getId())) return;
        payable(invoice); var route = route(invoice);
        require(route.type().equals(tx.getSourceType()) && route.id().equals(tx.getSourceId()), "Transaction d'une autre dette");
        sameAmount(invoice, tx.getAmount(), tx.getCurrency());
        require(invoice.getPaymentTransactionId() == null || invoice.getPaymentTransactionId().equals(tx.getId()), "Autre tentative de facture à rapprocher");
        invoice.setPaymentTransactionId(tx.getId()); invoice.setPaymentMethod(tx.getProviderType().name());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void attachReservation(PaymentTransaction tx) {
        if (!ReservationPaymentService.SOURCE_TYPE.equals(tx.getSourceType())) return;
        var stay = stay(tx.getSourceId(), tx.getOrganizationId(), true);
        require(stay.getStripeSessionId() == null || stay.getStripeSessionId().equals(tx.getProviderTxId()), "Autre session du séjour à rapprocher");
        require(stay.getPaymentStatus() != PaymentStatus.PAID && stay.getPaymentStatus() != PaymentStatus.REFUNDED, "État du séjour changé");
        stay.setStripeSessionId(tx.getProviderTxId()); stay.setPaymentStatus(PaymentStatus.PROCESSING);
    }

    @Transactional
    public void reconcile(String ref) {
        var tx = payments.findByTransactionRef(ref).orElseThrow();
        sameOrg(tx.getOrganizationId(), tenant.getRequiredOrganizationId());
        if (tx.getStatus() != TransactionStatus.COMPLETED || tx.getPaymentType() != TransactionType.CHECKOUT) return;
        var invoices = em.createQuery("select i from Invoice i where i.organizationId=:org and i.paymentTransactionId=:tx order by i.id", Invoice.class)
                .setParameter("org", tx.getOrganizationId()).setParameter("tx", tx.getId()).getResultList();
        if (SOURCE_TYPE.equals(tx.getSourceType())) require(invoices.size() == 1 && invoices.get(0).getId().equals(tx.getSourceId()), "Facture du paiement introuvable");
        if (invoices.isEmpty()) return;
        require(tx.getProviderType() == PaymentProviderType.STRIPE && tx.getProviderTxId() != null, "Preuve de facture absente");
        for (var invoice : invoices) {
            em.refresh(invoice, LockModeType.PESSIMISTIC_WRITE);
            require(Objects.equals(invoice.getPaymentTransactionId(), tx.getId()), "Association de facture modifiée");
            boolean allocated = InterventionPaymentBatch.SOURCE_TYPE.equals(tx.getSourceType());
            BigDecimal invoiceAmount = tx.getAmount();
            if (allocated) {
                var parts = em.createQuery("select a from InterventionPaymentAllocation a where a.organizationId=:org "
                        + "and a.transaction.id=:tx", InterventionPaymentAllocation.class)
                    .setParameter("org", tx.getOrganizationId()).setParameter("tx", tx.getId()).getResultList();
                InterventionPaymentBatch.validate(tx, parts);
                var part = parts.stream().filter(a -> Objects.equals(a.getInterventionId(), invoice.getInterventionId())).findFirst()
                    .orElseThrow(() -> invalid("Facture absente de la répartition du paiement"));
                require(part.getConfirmedAt() != null, "Part de facture non rapprochée");
                invoiceAmount = part.getAmount();
            }
            sameAmount(invoice, invoiceAmount, tx.getCurrency());
            if (invoice.getStatus() == InvoiceStatus.PAID) continue;
            payable(invoice);
            if (SOURCE_TYPE.equals(tx.getSourceType())) {
                require(invoice.getInvoiceType() == InvoiceType.COMMISSION, "Ancienne facture non rapprochée");
                ledger.recordTransfer(wallets.getOrCreateEscrowWallet(tx.getOrganizationId(), tx.getCurrency()),
                        wallets.getOrCreatePlatformWallet(tx.getOrganizationId(), tx.getCurrency()), tx.getAmount(),
                        LedgerReferenceType.PAYMENT, "invoice:" + invoice.getId(), "Règlement commission " + invoice.getInvoiceNumber());
            } else {
                require(invoice.getInvoiceType() == InvoiceType.GUEST, "Nature de facture incohérente");
                if (InterventionPaymentBatch.SOURCE_TYPE.equals(tx.getSourceType())) {
                    var mission = em.find(Intervention.class, invoice.getInterventionId());
                    require(mission != null && Objects.equals(mission.getOrganizationId(), tx.getOrganizationId())
                            && mission.getPaymentStatus() == PaymentStatus.PAID, "Prestation pas encore rapprochée");
                } else {
                    require(ReservationPaymentService.SOURCE_TYPE.equals(tx.getSourceType()) && Objects.equals(invoice.getReservationId(), tx.getSourceId()), "Facture non liée à ce séjour");
                    require(stay(tx.getSourceId(), tx.getOrganizationId(), false).getPaymentStatus() == PaymentStatus.PAID, "Séjour pas encore rapproché");
                }
            }
            invoice.setStatus(InvoiceStatus.PAID); invoice.setPaidAt(LocalDateTime.now()); invoice.setPaymentMethod("STRIPE");
        }
    }

    @Transactional
    public void releaseExpiredBindings(PaymentTransaction tx) {
        sameOrg(tx.getOrganizationId(), tenant.getRequiredOrganizationId());
        require(tx.getStatus() == TransactionStatus.FAILED && tx.getMetadata() != null
                && (Boolean.TRUE.equals(tx.getMetadata().get("batchRetryAllowed"))
                    || BaitlyInterventionCheckoutExpiryWriter.retryProven(tx)), "Expiration du paiement non prouvée");
        var linked = em.createQuery("select i from Invoice i where i.organizationId=:org and i.paymentTransactionId=:tx order by i.id", Invoice.class)
                .setParameter("org", tx.getOrganizationId()).setParameter("tx", tx.getId()).getResultList();
        for (var invoice : linked) {
            em.refresh(invoice, LockModeType.PESSIMISTIC_WRITE);
            require(Objects.equals(invoice.getPaymentTransactionId(), tx.getId()) && invoice.getPaidAt() == null
                    && invoice.getStatus() != InvoiceStatus.PAID, "Facture déjà rapprochée");
            invoice.setPaymentTransactionId(null); invoice.setPaymentMethod(null);
        }
    }

    @Transactional
    public Invoice send(Long id) {
        var invoice = invoice(id, tenant.getRequiredOrganizationId(), true);
        require(invoice.getStatus() == InvoiceStatus.DRAFT, "Seul un brouillon peut être envoyé");
        invoice.setStatus(InvoiceStatus.SENT); return invoice;
    }

    private Invoice invoice(Long id, Long org, boolean lock) {
        var invoice = em.find(Invoice.class, id); sameOrg(invoice == null ? null : invoice.getOrganizationId(), org);
        if (lock) { em.refresh(invoice, LockModeType.PESSIMISTIC_WRITE); sameOrg(invoice.getOrganizationId(), org); }
        return invoice;
    }
    private Reservation stay(Long id, Long org, boolean lock) {
        var stay = em.find(Reservation.class, id); sameOrg(stay == null ? null : stay.getOrganizationId(), org);
        if (lock) { em.refresh(stay, LockModeType.PESSIMISTIC_WRITE); sameOrg(stay.getOrganizationId(), org); }
        return stay;
    }
    static void payable(Invoice invoice) {
        require(Set.of(InvoiceStatus.SENT, InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE).contains(invoice.getStatus())
                && invoice.getDuplicateOfId() == null && invoice.getPaidAt() == null, "Cette facture n'est pas payable");
        require(invoice.getTotalTtc() != null && invoice.getTotalTtc().signum() > 0 && invoice.getCurrency() != null, "Montant de facture invalide");
    }
    static Long invoiceId(Map<String, ?> metadata) {
        if (metadata == null || metadata.get("invoiceId") == null) return null;
        try { long id = Long.parseLong(metadata.get("invoiceId").toString()); require(id > 0, "Facture invalide"); return id; }
        catch (NumberFormatException e) { throw invalid("Facture invalide"); }
    }
    private static void sameAmount(Invoice invoice, BigDecimal amount, String currency) {
        require(amount != null && invoice.getTotalTtc().compareTo(amount) == 0 && invoice.getCurrency().equalsIgnoreCase(currency),
                "Le solde ou la devise diffère de la facture : rapprochement requis avant paiement");
    }
    private static void sameOrg(Long actual, Long expected) {
        if (actual == null || !actual.equals(expected)) throw new AccessDeniedException("Facture ou dette hors organisation");
    }
    static void require(boolean condition, String message) { if (!condition) throw invalid(message); }
    private static IllegalStateException invalid(String message) { return new IllegalStateException(message); }
}
