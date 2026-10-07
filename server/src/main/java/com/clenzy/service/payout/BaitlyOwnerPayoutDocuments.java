package com.clenzy.service.payout;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.InvoiceGeneratorService;
import com.clenzy.service.InvoiceNumberingService;
import com.clenzy.service.commission.ManagementCommissionCalculator.Commission;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/** Justificatifs Baitly : retenue TTC documentée, règlement seulement après preuve du transfert. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class BaitlyOwnerPayoutDocuments {
    private final InvoiceRepository invoices;
    private final InvoiceGeneratorService generator;
    private final InvoiceNumberingService numbering;
    private final OwnerPayoutReservationRepository claims;
    private final EntityManager em;

    public BaitlyOwnerPayoutDocuments(InvoiceRepository invoices, InvoiceGeneratorService generator,
            InvoiceNumberingService numbering, OwnerPayoutReservationRepository claims, EntityManager em) {
        this.invoices = invoices; this.generator = generator; this.numbering = numbering;
        this.claims = claims; this.em = em;
    }

    public Invoice prepare(Reservation stay, Commission commission) {
        require(commission.amount().signum() >= 0, "Commission négative.");
        if (commission.amount().signum() == 0) return null;
        // Ne jamais réémettre ni réaffecter une facture historique déjà présente.
        require(invoices.findByReservationIdAndInvoiceType(stay.getId(), InvoiceType.COMMISSION).isEmpty(),
                "Une facture de commission existe déjà pour ce séjour : rapprochement requis.");
        Invoice invoice = generator.generateCommissionForPayout(stay, commission, stay.getOrganizationId());
        require(invoice.getId() != null && same(invoice.getTotalHt(), commission.amount()), "Commission non documentée.");
        requireTotals(invoice);
        return invoice;
    }

    public void bind(OwnerPayout payout, List<Invoice> documents) {
        for (Invoice invoice : documents) {
            require(Objects.equals(invoice.getOrganizationId(), payout.getOrganizationId())
                    && payout.getCurrency().equals(invoice.getCurrency()) && invoice.getStatus() == InvoiceStatus.DRAFT
                    && invoice.getPayoutId() == null && invoice.getPaymentTransactionId() == null, "Facture déjà attribuée.");
            invoice.setPayoutId(payout.getId());
            invoice.setInvoiceNumber(numbering.generateNextNumber(payout.getOrganizationId()));
            invoice.setStatus(InvoiceStatus.ISSUED);
            invoice.setPaymentMethod("RETENUE_REVERSEMENT");
            invoice.setDueDate(null); // Pas de relance client pour une retenue sur un versement en attente.
        }
        invoices.saveAll(documents);
    }

    public void validateRefund(Reservation stay, List<PaymentTransaction> transactions) {
        if (stay.getPaymentStatus() != PaymentStatus.PARTIALLY_REFUNDED) return;
        var refunds = transactions.stream().filter(t -> ("BOOKING_CANCELLATION".equals(t.getSourceType())
                    || ("RESERVATION".equals(t.getSourceType()) && com.clenzy.service.BaitlyExternalRefundStore.confirmed(t)))
                && t.getPaymentType() == TransactionType.REFUND && t.getStatus() == TransactionStatus.COMPLETED)
                .toList();
        require(!refunds.isEmpty(),"Remboursement absent.");
        var original = invoices.findByReservationIdAndInvoiceType(stay.getId(), InvoiceType.GUEST)
                .orElseThrow(() -> invalid("Facture du séjour absente."));
        for(var refund:refunds) {
        var credit = invoices.findByOrganizationIdAndRefundTransactionId(stay.getOrganizationId(), refund.getId())
                .orElseThrow(() -> invalid("L'avoir du remboursement doit être rapproché avant reversement."));
        require(Objects.equals(original.getOrganizationId(), stay.getOrganizationId())
                && original.getStatus() == InvoiceStatus.PAID && same(original.getTotalTtc(), com.clenzy.booking.service.BaitlyReservationCredit.cash(stay))
                && Objects.equals(credit.getOrganizationId(), stay.getOrganizationId())
                && Objects.equals(credit.getReservationId(), stay.getId()) && credit.getInvoiceType() == InvoiceType.GUEST
                && credit.getStatus() == InvoiceStatus.CREDIT_NOTE && credit.getDuplicateOfId() == null
                && Objects.equals(credit.getOriginalInvoiceId(), original.getId())
                && Objects.equals(credit.getRefundTransactionId(), refund.getId())
                && same(credit.getTotalTtc(), refund.getAmount().negate())
                && stay.getCurrency().equals(original.getCurrency()) && stay.getCurrency().equals(credit.getCurrency()),
                "La facture et l'avoir du séjour ne correspondent pas au remboursement confirmé.");
        }
    }

    public List<Invoice> validate(OwnerPayout payout, List<OwnerPayoutReservation> lines, boolean lock) {
        var documents = invoices.findAllByPayoutIdAndOrganizationIdOrderById(payout.getId(), payout.getOrganizationId());
        Set<Long> stays = new HashSet<>(lines.stream().map(OwnerPayoutReservation::getReservationId).toList());
        Set<Long> billed = new HashSet<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Invoice invoice : documents) {
            if (lock) em.refresh(invoice, LockModeType.PESSIMISTIC_WRITE);
            require(Objects.equals(invoice.getOrganizationId(), payout.getOrganizationId())
                    && Objects.equals(invoice.getPayoutId(), payout.getId()) && stays.contains(invoice.getReservationId())
                    && billed.add(invoice.getReservationId()) && invoice.getInvoiceType() == InvoiceType.COMMISSION
                    && invoice.getDuplicateOfId() == null && invoice.getPaymentTransactionId() == null
                    && (invoice.getStatus() == InvoiceStatus.ISSUED || invoice.getStatus() == InvoiceStatus.PAID)
                    && "RETENUE_REVERSEMENT".equals(invoice.getPaymentMethod())
                    && payout.getCurrency().equals(invoice.getCurrency())
                    && !invoices.existsByOrganizationIdAndOriginalInvoiceId(payout.getOrganizationId(), invoice.getId()),
                    "Justificatif de commission modifié : rapprochement requis.");
            requireTotals(invoice);
            total = total.add(invoice.getTotalTtc());
        }
        require(same(total, payout.getCommissionAmount()), "La retenue doit correspondre aux factures de commission TTC.");
        return documents;
    }

    /** Appelée dans la transaction qui enregistre la preuve PSP, y compris en rapprochement. */
    public void settle(PayoutTransfer transfer) {
        if (transfer.getSource() != PayoutTransfer.Source.OWNER_PAYOUT) return;
        require(transfer.getState() == PayoutTransfer.State.TRANSFERRED
                && transfer.getExternalReference() != null, "Transfert non confirmé.");
        var payout = em.find(OwnerPayout.class, transfer.getSourceId());
        require(payout != null, "Reversement absent.");
        em.refresh(payout, LockModeType.PESSIMISTIC_WRITE);
        require(Objects.equals(payout.getOrganizationId(), transfer.getOrganizationId())
                && same(payout.getNetAmount(), transfer.getAmount()) && payout.getCurrency().equals(transfer.getCurrency()),
                "Transfert différent du reversement.");
        // Les historiques sans facture ne sont pas régularisés artificiellement par un rapprochement PSP.
        if (payout.getFundingVersion() == 0) return;
        // Le transfert historique reste acquis après un remboursement ultérieur et ses avoirs.
        if(payout.getStatus()==OwnerPayout.PayoutStatus.PAID) return;
        var documents = validate(payout, claims.findByPayoutIdAndOrganizationId(payout.getId(), payout.getOrganizationId()), true);
        for (Invoice invoice : documents) {
            if (invoice.getStatus() == InvoiceStatus.PAID) continue;
            invoice.setStatus(InvoiceStatus.PAID);
            invoice.setPaidAt(LocalDateTime.now());
        }
        invoices.saveAll(documents);
    }

    private static void requireTotals(Invoice invoice) {
        require(invoice.getTotalHt() != null && invoice.getTotalHt().signum() > 0
                && invoice.getTotalTax() != null && invoice.getTotalTax().signum() >= 0
                && same(invoice.getTotalTtc(), invoice.getTotalHt().add(invoice.getTotalTax())), "TTC de commission incohérent.");
    }
    private static boolean same(BigDecimal left, BigDecimal right) { return left != null && right != null && left.compareTo(right) == 0; }
    private static void require(boolean condition, String message) { if (!condition) throw invalid(message); }
    private static IllegalStateException invalid(String message) { return new IllegalStateException(message); }
}
