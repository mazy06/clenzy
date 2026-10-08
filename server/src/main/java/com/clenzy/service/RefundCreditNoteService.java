package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.booking.service.BookingCancellationRefunds;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;

/** Avoir Baitly après remboursement confirmé. Aucun appel réseau ni nouveau mouvement d'argent. */
@Service
public class RefundCreditNoteService {
    static final String CANDIDATES_SQL = """
        SELECT p.transaction_ref, p.organization_id FROM payment_transactions p
        WHERE p.payment_type='REFUND' AND p.status='COMPLETED' AND p.provider_type='STRIPE'
          AND ((p.source_type='INTERVENTION' AND (p.metadata->>'managedRefund'='true'
            OR (p.metadata->>'externalRefund'='true' AND p.metadata->>'externalRefundConfirmed'='true'
              AND p.metadata->>'stripeStatus'='succeeded' AND p.metadata->>'reviewRequired'='false')))
            OR (p.source_type='BOOKING_CANCELLATION' AND p.metadata->>'cancellationRefund'='true')
            OR (p.source_type='RESERVATION' AND p.metadata->>'externalRefundConfirmed'='true'
              AND p.metadata->>'stripeStatus'='succeeded' AND p.metadata->>'reviewRequired'='false'))
          AND EXISTS (SELECT 1 FROM invoices i WHERE i.organization_id=p.organization_id
            AND ((p.source_type='INTERVENTION' AND i.intervention_id=p.source_id)
              OR (p.source_type IN ('BOOKING_CANCELLATION','RESERVATION') AND i.reservation_id=p.source_id AND i.invoice_type='GUEST'))
            AND (i.status='PAID' OR (p.source_type='INTERVENTION' AND p.metadata->>'batchAllocationId' IS NOT NULL
              AND i.status IN ('ISSUED','SENT','OVERDUE'))) AND i.duplicate_of_id IS NULL)
          AND (NOT EXISTS (SELECT 1 FROM invoices c WHERE c.refund_transaction_id=p.id)
            OR (p.metadata->>'ownerRecoveryRequired'='true' AND COALESCE(p.metadata->>'ownerRefundDocumentsChecked','false')<>'true'))
        ORDER BY p.updated_at NULLS FIRST, p.id LIMIT 20
        """;
    private final EntityManager em;
    private final InvoiceRepository invoices;
    private final PaymentTransactionRepository payments;
    private final InvoiceNumberingService numbers;
    private final TenantContext tenant;
    private final BaitlyBatchRefundPersistence batchRefunds;

    public RefundCreditNoteService(EntityManager em, InvoiceRepository invoices, PaymentTransactionRepository payments,
            InvoiceNumberingService numbers, TenantContext tenant, BaitlyBatchRefundPersistence batchRefunds) {
        this.batchRefunds = batchRefunds;
        this.em = em; this.invoices = invoices; this.payments = payments; this.numbers = numbers; this.tenant = tenant;
    }

    public record Candidate(String refundRef, Long organizationId) {}

    /** Lecture cross-tenant explicite, sous transaction pour appliquer les GUC RLS du worker. */
    @Transactional(readOnly = true)
    public List<Candidate> candidates() {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(CANDIDATES_SQL).getResultList();
        return rows.stream().map(row -> new Candidate((String) row[0], ((Number) row[1]).longValue())).toList();
    }

    @Transactional
    public Long reconcile(String refundRef) {
        // La réconciliation du journal peut nous appeler dans la même transaction.
        // Ne pas perdre ses écritures locales lors des refresh sous verrou.
        em.flush();
        Long org = tenant.getRequiredOrganizationId();
        var candidate = payments.findByTransactionRef(refundRef).orElseThrow();
        require(Objects.equals(candidate.getOrganizationId(), org), "Remboursement hors organisation");
        if (BookingCancellationRefunds.SOURCE.equals(candidate.getSourceType()) || ("RESERVATION".equals(candidate.getSourceType()) && BaitlyExternalRefundStore.confirmed(candidate))) return reconcileBooking(candidate, org);
        var refund = payments.lockByReference(org, refundRef).orElseThrow();
        em.refresh(refund);
        // Les anciens remboursements sans preuve canonique durable ne fabriquent pas de document.
        if (!PaymentPersistence.managedRefund(refund) && !BaitlyExternalRefundStore.confirmed(refund)) return null;
        require(refund.getOrganizationId().equals(org) && refund.getStatus() == TransactionStatus.COMPLETED
            && refund.getPaymentType() == TransactionType.REFUND && refund.getProviderType() == PaymentProviderType.STRIPE
            && "INTERVENTION".equals(refund.getSourceType()) && BaitlyRefundEvidence.confirmedStripe(refund), "Remboursement non confirmé");
        var existing = invoices.findByOrganizationIdAndRefundTransactionId(org, refund.getId());
        if (existing.isPresent()) {
            require(existing.get().getStatus() == InvoiceStatus.CREDIT_NOTE
                && existing.get().getOriginalInvoiceId() != null
                && Objects.equals(existing.get().getCurrency(), refund.getCurrency())
                && equal(existing.get().getTotalTtc(), refund.getAmount().negate()), "Avoir existant incohérent");
            return existing.get().getId();
        }
        // Un rejet tardif conserve les documents existants, mais suspend toute nouvelle émission.
        if (BaitlyExternalRefundStore.external(refund)) {
            require("succeeded".equals(refund.getMetadata().get("stripeStatus"))
                && Boolean.FALSE.equals(refund.getMetadata().get("reviewRequired")),
                "Remboursement externe à rapprocher avant l'avoir");
        }
        Object originalRef = refund.getMetadata().get("originalTransactionRef");
        require(originalRef instanceof String, "Encaissement du remboursement absent");
        var payment = payments.findByTransactionRef((String) originalRef).orElseThrow();
        boolean allocated = BaitlyBatchRefundPersistence.isAllocation(refund);
        boolean series = BaitlyRefundSeries.isSeries(refund);
        boolean externalPartial = BaitlyExternalRefundStore.confirmed(refund)
            && refund.getAmount().signum()>0 && refund.getAmount().compareTo(payment.getAmount())<0;
        BigDecimal paidBasis = allocated ? batchRefunds.validate(refund, payment).getAmount() : payment.getAmount();
        require(Objects.equals(payment.getOrganizationId(), org) && payment.getStatus() == TransactionStatus.COMPLETED
            && payment.getPaymentType() == TransactionType.CHECKOUT && payment.getProviderType() == PaymentProviderType.STRIPE
            && (allocated || (Objects.equals(payment.getSourceType(), refund.getSourceType()) && Objects.equals(payment.getSourceId(), refund.getSourceId())
                && (series || externalPartial || equal(payment.getAmount(), refund.getAmount()))))
            && Objects.equals(payment.getCurrency(), refund.getCurrency())
            && refund.getAmount().signum() > 0, "Encaissement et remboursement incohérents");
        var mission = em.find(Intervention.class, refund.getSourceId());
        require(mission != null && Objects.equals(mission.getOrganizationId(), org), "Intervention hors organisation");
        em.refresh(mission, LockModeType.PESSIMISTIC_WRITE);
        BaitlyMaintenanceReceipts maintenance=null;
        if(BaitlyMaintenanceReceipts.aggregated(refund)) {
            var rows=payments.findByOrganizationIdAndSourceTypeAndSourceId(org,"INTERVENTION",mission.getId());rows.forEach(em::refresh);
            var quotes=em.createQuery("from ServiceQuote where organizationId=:org and interventionId=:mission",ServiceQuote.class)
                    .setParameter("org",org).setParameter("mission",mission.getId()).getResultList();
            maintenance=BaitlyMaintenanceReceipts.verify(mission,rows,quotes);maintenance.history(rows);paidBasis=maintenance.gross();
        }
        require((series ? mission.getPaymentStatus()==PaymentStatus.PARTIALLY_REFUNDED || mission.getPaymentStatus()==PaymentStatus.REFUNDED
                : mission.getPaymentStatus() == (externalPartial ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED))
            && Objects.equals(mission.getOrganizationId(), org)
            && (maintenance!=null || Objects.equals(mission.getStripeSessionId(), payment.getProviderTxId()))
            && equal(mission.getEstimatedCost(), series || externalPartial ? paidBasis : refund.getAmount())
            && Objects.equals(mission.getCurrency(), refund.getCurrency()),
            "Remboursement de l'intervention à rapprocher");

        var originals = em.createQuery("SELECT i FROM Invoice i WHERE i.organizationId=:org AND i.interventionId=:mission "
            + "AND i.status in :states AND i.duplicateOfId IS NULL", Invoice.class)
            .setParameter("org", org).setParameter("mission", mission.getId())
            .setParameter("states", allocated ? List.of(InvoiceStatus.PAID,InvoiceStatus.ISSUED,InvoiceStatus.SENT,InvoiceStatus.OVERDUE)
                : List.of(InvoiceStatus.PAID)).getResultList();
        if (originals.isEmpty()) return null; // Une facture émise plus tard sera retrouvée par le worker.
        require(originals.size() == 1, "Plusieurs factures à rapprocher pour cette intervention");
        var original = originals.getFirst();
        em.refresh(original, LockModeType.PESSIMISTIC_WRITE);
        if (allocated) batchRefunds.bindInvoice(original, refund, payment);
        if (original.getPaymentTransactionId() == null) {
            long paidCycles = payments.findByOrganizationIdAndSourceTypeAndSourceId(org, "INTERVENTION", mission.getId()).stream()
                .filter(tx -> tx.getPaymentType() == TransactionType.CHECKOUT && tx.getStatus() == TransactionStatus.COMPLETED).count();
            require(paidCycles == 1 || maintenance!=null, "Plusieurs encaissements : la facture historique doit être rapprochée");
        }
        require(original.getStatus() == InvoiceStatus.PAID && Objects.equals(original.getOrganizationId(), org)
            && Objects.equals(original.getInterventionId(), mission.getId()) && original.getDuplicateOfId() == null
            && original.getOriginalInvoiceId() == null && original.getRefundTransactionId() == null
            && original.getInvoiceType() == InvoiceType.GUEST
            && (original.getPaymentTransactionId() == null || Objects.equals(original.getPaymentTransactionId(), payment.getId())
                || maintenance!=null && maintenance.receipts().stream().map(PaymentTransaction::getId).toList().contains(original.getPaymentTransactionId()))
            && Objects.equals(original.getCurrency(), refund.getCurrency())
            && equal(original.getTotalTtc(), series || externalPartial ? paidBasis : refund.getAmount()),
            "Facture et encaissement à rapprocher avant l'avoir");
        // Inclut les avoirs manuels récents ; les anciens avoirs non liés exigent un rapprochement humain.
        if(series) requirePriorCredits(original,refund,payment,org);
        else require(!invoices.existsByOrganizationIdAndOriginalInvoiceId(org, original.getId()), "Un avoir existe déjà pour cette facture");
        long historical = em.createQuery("SELECT count(i) FROM Invoice i WHERE i.organizationId=:org "
            + "AND i.status=com.clenzy.model.InvoiceStatus.CREDIT_NOTE AND i.originalInvoiceId IS NULL "
            + "AND (i.interventionId=:mission OR i.legalMentions LIKE :mention)", Long.class)
            .setParameter("org", org).setParameter("mission", mission.getId())
            .setParameter("mention", "%" + original.getInvoiceNumber() + "%").getSingleResult();
        require(historical == 0, "Un ancien avoir doit être rapproché");

        var credit = copyReversed(original, BaitlyMaintenanceReceipts.accounting(refund));
        credit.setInvoiceNumber(numbers.generateNextNumberFor(credit));
        invoices.saveAndFlush(credit);
        clearError(refund);
        return credit.getId();
    }

    private void requirePriorCredits(Invoice original,PaymentTransaction refund,PaymentTransaction payment,Long org) {
            var notes=em.createQuery("from Invoice i where i.organizationId=:org and i.originalInvoiceId=:original",Invoice.class)
                    .setParameter("org",org).setParameter("original",original.getId()).getResultList();
            BigDecimal credited=BigDecimal.ZERO;
            var creditedLines=new java.util.HashMap<Integer,BigDecimal>();
            var creditedTaxes=new java.util.HashMap<Integer,BigDecimal>();
            for(var note:notes) {
                require(note.getStatus()==InvoiceStatus.CREDIT_NOTE && note.getRefundTransactionId()!=null
                        && Objects.equals(note.getCurrency(),refund.getCurrency()),"Un avoir antérieur doit être rapproché");
                var prior=em.find(PaymentTransaction.class,note.getRefundTransactionId());
                require(prior!=null && BaitlyRefundEvidence.order(prior)<BaitlyRefundEvidence.order(refund) && prior.getStatus()==TransactionStatus.COMPLETED
                        && Objects.equals(prior.getOrganizationId(),org) && prior.getMetadata()!=null
                        && Objects.equals(prior.getSourceType(),refund.getSourceType()) && Objects.equals(prior.getSourceId(),refund.getSourceId())
                        && (BaitlyMaintenanceReceipts.aggregated(refund) && BaitlyMaintenanceReceipts.aggregated(prior)
                            || Objects.equals(prior.getMetadata().get("originalTransactionRef"),payment.getTransactionRef()))
                        && equal(note.getTotalTtc(),prior.getAmount().negate()),"Avoir antérieur non rapproché");
                credited=credited.subtract(note.getTotalTtc());
                for(var line:note.getLines()) {
                    creditedLines.merge(line.getLineNumber(),line.getTotalTtc().negate(),BigDecimal::add);
                    creditedTaxes.merge(line.getLineNumber(),line.getTaxAmount().negate(),BigDecimal::add);
                }
            }
            require(equal(credited,BaitlyMaintenanceReceipts.before(refund)),"Les avoirs antérieurs doivent être créés avant le suivant");
            var ordered=original.getLines().stream().sorted(java.util.Comparator.comparing(InvoiceLine::getLineNumber)).toList();
            var expected=BaitlyRefundSeries.apportion(ordered.stream().map(InvoiceLine::getTotalTtc).toList(),credited);
            for(int i=0;i<ordered.size();i++) {
                var line=ordered.get(i); var part=expected.get(i);
                var taxPart=line.getTotalTtc().signum()==0?BigDecimal.ZERO:line.getTaxAmount().multiply(part).divide(line.getTotalTtc(),2,RoundingMode.HALF_UP);
                require(equal(creditedLines.getOrDefault(line.getLineNumber(),BigDecimal.ZERO),part)
                        && equal(creditedTaxes.getOrDefault(line.getLineNumber(),BigDecimal.ZERO),taxPart),
                        "La répartition des avoirs antérieurs doit être rapprochée");
            }
    }

    private Long reconcileBooking(PaymentTransaction candidate, Long org) {
        // Même ordre que la confirmation financière : réservation, remboursement, puis facture.
        var stay = em.find(Reservation.class, candidate.getSourceId());
        require(stay != null && Objects.equals(stay.getOrganizationId(), org), "Réservation hors organisation");
        em.refresh(stay, LockModeType.PESSIMISTIC_WRITE);
        var refund = payments.lockByReference(org, candidate.getTransactionRef()).orElseThrow();
        em.refresh(refund);
        var metadata = refund.getMetadata();
        boolean external = "RESERVATION".equals(refund.getSourceType()) && BaitlyExternalRefundStore.confirmed(refund);
        require(Objects.equals(refund.getOrganizationId(), org) && Objects.equals(refund.getSourceId(), stay.getId())
            && (BookingCancellationRefunds.SOURCE.equals(refund.getSourceType()) || external)
            && refund.getStatus() == TransactionStatus.COMPLETED && refund.getPaymentType() == TransactionType.REFUND
            && refund.getProviderType() == PaymentProviderType.STRIPE && BaitlyRefundEvidence.confirmedStripe(refund) && "EUR".equals(refund.getCurrency())
            && refund.getAmount() != null && refund.getAmount().signum() > 0
            && metadata != null && (Boolean.TRUE.equals(metadata.get("cancellationRefund")) || (external && "succeeded".equals(metadata.get("stripeStatus")) && BaitlyRefundSeries.isSeries(refund)))
            && !Boolean.TRUE.equals(metadata.get("reviewRequired")) && refund.getErrorMessage() == null,
            "Remboursement de séjour non confirmé");
        if(Boolean.TRUE.equals(metadata.get("ownerRecoveryRequired"))) reconcileOwnerCommission(refund,org);
        var existing = invoices.findByOrganizationIdAndRefundTransactionId(org, refund.getId());
        if (existing.isPresent()) {
            var note = existing.get();
            require(note.getStatus() == InvoiceStatus.CREDIT_NOTE && note.getOriginalInvoiceId() != null
                && Objects.equals(note.getReservationId(), stay.getId()) && note.getInterventionId() == null
                && note.getInvoiceType() == InvoiceType.GUEST && Objects.equals(note.getCurrency(), refund.getCurrency())
                && equal(note.getTotalTtc(), refund.getAmount().negate()), "Avoir de séjour existant incohérent");
            clearError(refund);
            return note.getId();
        }
        require(metadata.get("originalTransactionRef") instanceof String, "Encaissement du remboursement absent");
        var payment = payments.findByTransactionRef((String) metadata.get("originalTransactionRef")).orElseThrow();
        require(Objects.equals(payment.getOrganizationId(), org) && "RESERVATION".equals(payment.getSourceType())
            && Objects.equals(payment.getSourceId(), stay.getId()) && payment.getPaymentType() == TransactionType.CHECKOUT
            && payment.getStatus() == TransactionStatus.COMPLETED && payment.getProviderType() == PaymentProviderType.STRIPE
            && payment.getProviderTxId() != null && payment.getProviderTxId().startsWith("cs_")
            && Objects.equals(payment.getProviderTxId(), metadata.get("checkoutSessionId"))
            && Objects.equals(payment.getProviderTxId(), stay.getStripeSessionId())
            && Objects.equals(payment.getCurrency(), refund.getCurrency()) && Objects.equals(stay.getCurrency(), refund.getCurrency())
            && Objects.equals(stay.getOrganizationId(), org) && (external || "cancelled".equalsIgnoreCase(stay.getStatus()))
            && stay.getPaymentCollection() == PaymentCollection.PMS
            && equal(com.clenzy.booking.service.BaitlyReservationCredit.cash(stay), payment.getAmount()) && payment.getAmount().compareTo(refund.getAmount()) >= 0
            && metadata.get("originalAmount") instanceof String
            && equal(payment.getAmount(), new BigDecimal((String) metadata.get("originalAmount"))),
            "Encaissement et remboursement du séjour à rapprocher");
        boolean full = equal(payment.getAmount(), BaitlyRefundSeries.after(refund));
        require(external ? stay.getPaymentStatus()==PaymentStatus.PARTIALLY_REFUNDED || stay.getPaymentStatus()==PaymentStatus.REFUNDED : stay.getPaymentStatus() == (full ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED),
            "Statut financier du séjour non rapproché");
        long paidCycles = payments.findReservationFunding(org, List.of(stay.getId()),
                com.clenzy.service.payout.ReservationPayoutFunding.SOURCES).stream()
            .filter(tx -> tx.getPaymentType() == TransactionType.CHECKOUT && tx.getStatus() == TransactionStatus.COMPLETED).count();
        require(paidCycles == 1, "Plusieurs encaissements du séjour : rapprochement requis");

        var originals = em.createQuery("SELECT i FROM Invoice i WHERE i.organizationId=:org AND i.reservationId=:stay "
            + "AND i.invoiceType=com.clenzy.model.InvoiceType.GUEST AND i.status=com.clenzy.model.InvoiceStatus.PAID "
            + "AND i.duplicateOfId IS NULL", Invoice.class)
            .setParameter("org", org).setParameter("stay", stay.getId()).getResultList();
        if (originals.isEmpty()) return null;
        require(originals.size() == 1, "Plusieurs factures de séjour à rapprocher");
        var original = originals.getFirst();
        em.refresh(original, LockModeType.PESSIMISTIC_WRITE);
        require(original.getStatus() == InvoiceStatus.PAID && Objects.equals(original.getOrganizationId(), org)
            && Objects.equals(original.getReservationId(), stay.getId()) && original.getInterventionId() == null
            && original.getInvoiceType() == InvoiceType.GUEST && original.getDuplicateOfId() == null
            && original.getOriginalInvoiceId() == null && original.getRefundTransactionId() == null
            && (original.getPaymentTransactionId() == null || Objects.equals(original.getPaymentTransactionId(), payment.getId()))
            && Objects.equals(original.getCurrency(), refund.getCurrency()) && equal(original.getTotalTtc(), payment.getAmount()),
            "Facture et encaissement du séjour à rapprocher avant l'avoir");
        if(external) requirePriorCredits(original,refund,payment,org);
        else require(!invoices.existsByOrganizationIdAndOriginalInvoiceId(org, original.getId()), "Un avoir existe déjà pour cette facture");
        long historical = em.createQuery("SELECT count(i) FROM Invoice i WHERE i.organizationId=:org "
            + "AND i.status=com.clenzy.model.InvoiceStatus.CREDIT_NOTE AND i.originalInvoiceId IS NULL "
            + "AND ((i.reservationId=:stay AND i.invoiceType=com.clenzy.model.InvoiceType.GUEST) OR i.legalMentions LIKE :mention)", Long.class)
            .setParameter("org", org).setParameter("stay", stay.getId())
            .setParameter("mention", "%" + original.getInvoiceNumber() + "%").getSingleResult();
        require(historical == 0, "Un ancien avoir de séjour doit être rapproché");
        var credit = copyReversed(original, refund);
        credit.setInvoiceNumber(numbers.generateNextNumberFor(credit));
        invoices.saveAndFlush(credit);
        clearError(refund);
        return credit.getId();
    }

    /** Inversion exacte ou prorata des TTC et taxes historiques, sans consulter les taux courants. */
    private Invoice copyReversed(Invoice original, PaymentTransaction refund) {
        BigDecimal ht = BigDecimal.ZERO, tax = BigDecimal.ZERO, ttc = BigDecimal.ZERO;
        boolean full = equal(original.getTotalTtc(), refund.getAmount());
        BigDecimal before=BaitlyRefundSeries.before(refund), after=BaitlyRefundSeries.after(refund);
        BigDecimal allocated = BigDecimal.ZERO, allocatedBefore=BigDecimal.ZERO, allocatedAfter=BigDecimal.ZERO, creditHt = BigDecimal.ZERO, creditTax = BigDecimal.ZERO;
        require(!original.getLines().isEmpty(), "La facture n'a pas de lignes à créditer");
        var credit = new Invoice();
        var ordered=original.getLines().stream().sorted(java.util.Comparator.comparing(InvoiceLine::getLineNumber)).toList();
        var priorShares=BaitlyRefundSeries.isSeries(refund)?BaitlyRefundSeries.apportion(ordered.stream().map(InvoiceLine::getTotalTtc).toList(),before):List.<BigDecimal>of();
        var nextShares=BaitlyRefundSeries.isSeries(refund)?BaitlyRefundSeries.apportion(ordered.stream().map(InvoiceLine::getTotalTtc).toList(),after):List.<BigDecimal>of();
        int lineIndex=0;
        for (var line : ordered) {
            require(line.getQuantity() != null && line.getUnitPriceHt() != null && line.getTaxRate() != null
                && line.getTotalHt() != null && line.getTaxAmount() != null
                && equal(line.getTotalTtc(), line.getTotalHt().add(line.getTaxAmount())), "Totaux d'une ligne de facture incohérents");
            ht = ht.add(line.getTotalHt()); tax = tax.add(line.getTaxAmount()); ttc = ttc.add(line.getTotalTtc());
            BigDecimal lineHt = line.getTotalHt(), lineTax = line.getTaxAmount(), lineTtc = line.getTotalTtc();
            if (!full) {
                // Le prorata suit les TTC historiques ; l'arrondi cumulatif conserve exactement les centimes remboursés.
                require(lineHt.signum() >= 0 && lineTax.signum() >= 0 && lineTtc.signum() >= 0,
                    "Lignes mixtes de réduction : rapprochement requis");
                BigDecimal targetBefore=ttc.multiply(before).divide(original.getTotalTtc(),2,RoundingMode.HALF_UP);
                BigDecimal targetAfter=ttc.multiply(after).divide(original.getTotalTtc(),2,RoundingMode.HALF_UP);
                BigDecimal shareBefore=targetBefore.subtract(allocatedBefore),shareAfter=targetAfter.subtract(allocatedAfter);
                allocatedBefore=targetBefore; allocatedAfter=targetAfter;
                if(BaitlyRefundSeries.isSeries(refund)) { shareBefore=priorShares.get(lineIndex); shareAfter=nextShares.get(lineIndex); }
                lineIndex++;
                BigDecimal share=shareAfter.subtract(shareBefore); allocated=allocated.add(share);
                if (share.signum() == 0) continue;
                lineTax = lineTax.multiply(shareAfter).divide(lineTtc, 2, RoundingMode.HALF_UP)
                        .subtract(lineTax.multiply(shareBefore).divide(lineTtc,2,RoundingMode.HALF_UP));
                lineHt = share.subtract(lineTax); lineTtc = share;
            }
            creditHt = creditHt.add(lineHt); creditTax = creditTax.add(lineTax);
            var reversed = new InvoiceLine();
            reversed.setLineNumber(line.getLineNumber()); reversed.setDescription(line.getDescription());
            reversed.setQuantity(full ? line.getQuantity().negate() : BigDecimal.ONE.negate());
            reversed.setUnitPriceHt(full ? line.getUnitPriceHt() : lineHt);
            reversed.setTaxCategory(line.getTaxCategory()); reversed.setTaxRate(line.getTaxRate());
            reversed.setTotalHt(lineHt.negate()); reversed.setTaxAmount(lineTax.negate());
            reversed.setTotalTtc(lineTtc.negate()); credit.addLine(reversed);
        }
        require(equal(ht, original.getTotalHt()) && equal(tax, original.getTotalTax()) && equal(ttc, original.getTotalTtc()),
            "Le total de la facture ne correspond pas à ses lignes");
        credit.setOrganizationId(original.getOrganizationId()); credit.setInvoiceDate(LocalDate.now());
        credit.setStatus(InvoiceStatus.CREDIT_NOTE); credit.setInvoiceType(original.getInvoiceType());
        credit.setOriginalInvoiceId(original.getId()); credit.setRefundTransactionId(refund.getId());
        credit.setInterventionId(original.getInterventionId()); credit.setReservationId(original.getReservationId());
        credit.setCurrency(original.getCurrency()); credit.setCountryCode(original.getCountryCode());
        credit.setIssuerKey(original.getIssuerKey());
        credit.setSellerName(original.getSellerName()); credit.setSellerAddress(original.getSellerAddress()); credit.setSellerTaxId(original.getSellerTaxId());
        credit.setBuyerName(original.getBuyerName()); credit.setBuyerAddress(original.getBuyerAddress()); credit.setBuyerTaxId(original.getBuyerTaxId());
        require(equal(creditHt.add(creditTax), refund.getAmount()), "Montant de l'avoir différent du remboursement");
        credit.setTotalHt(creditHt.negate()); credit.setTotalTax(creditTax.negate()); credit.setTotalTtc(refund.getAmount().negate());
        credit.setLegalMentions((full ? "Avoir intégral sur facture " : "Avoir partiel au prorata des lignes de la facture ")
            + original.getInvoiceNumber() + " du " + original.getInvoiceDate()
            + ". Remboursement confirmé " + refund.getTransactionRef() + ". Référence Stripe : " + BaitlyRefundEvidence.stripeReference(refund) + ".");
        return credit;
    }

    /** Avoir de commission distinct de l'avoir voyageur ; aucun second remboursement Stripe. */
    private void reconcileOwnerCommission(PaymentTransaction refund,Long org) {
        var recoveries=em.createQuery("from BaitlyTransferRecovery where organizationId=:org and refundId=:refund",BaitlyTransferRecovery.class)
                .setParameter("org",org).setParameter("refund",refund.getId()).getResultList();
        require(recoveries.size()==1,"Récupération propriétaire non documentée");
        var transfer=em.find(PayoutTransfer.class,recoveries.getFirst().getTransferId());
        require(transfer!=null && Objects.equals(transfer.getOrganizationId(),org),"Transfert propriétaire absent");
        var basis=com.clenzy.service.payout.BaitlyOwnerRefundBasis.requireBasis(em,refund,transfer);
        var payout=em.find(OwnerPayout.class,transfer.getSourceId());
        var documents=em.createQuery("from Invoice where organizationId=:org and payoutId=:payout and invoiceType=com.clenzy.model.InvoiceType.COMMISSION "
                + "and originalInvoiceId is null and duplicateOfId is null",Invoice.class)
                .setParameter("org",org).setParameter("payout",payout.getId()).getResultList();
        require(documents.stream().allMatch(i->i.getStatus()==InvoiceStatus.PAID && refund.getCurrency().equals(i.getCurrency()))
                && documents.stream().map(Invoice::getTotalTtc).reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(payout.getCommissionAmount())==0,
                "Factures historiques de commission à rapprocher");
        var matching=documents.stream().filter(i->Objects.equals(i.getReservationId(),refund.getSourceId())).toList();
        require(matching.size()<=1,"Plusieurs commissions pour le séjour");
        if(!matching.isEmpty()) {
            var original=matching.getFirst();em.refresh(original,LockModeType.PESSIMISTIC_WRITE);
            BigDecimal before=BaitlyRefundSeries.delta(original.getTotalTtc(),BigDecimal.ZERO,basis.before(),basis.gross());
            BigDecimal amount=BaitlyRefundSeries.delta(original.getTotalTtc(),basis.before(),basis.before().add(refund.getAmount()),basis.gross());
            var notes=em.createQuery("from Invoice where organizationId=:org and originalInvoiceId=:original",Invoice.class)
                    .setParameter("org",org).setParameter("original",original.getId()).getResultList();
            var same=notes.stream().filter(i->Objects.equals(i.getOwnerRefundTransactionId(),refund.getId())).toList();
            require(same.size()<=1,"Avoir de commission dupliqué");
            if(!same.isEmpty()) require(equal(same.getFirst().getTotalTtc(),amount.negate()) && same.getFirst().getStatus()==InvoiceStatus.CREDIT_NOTE,
                    "Avoir de commission différent");
            else {
                BigDecimal credited=BigDecimal.ZERO;
                for(var prior:notes) {
                    require(prior.getOwnerRefundTransactionId()!=null && prior.getStatus()==InvoiceStatus.CREDIT_NOTE,"Avoir de commission historique à rapprocher");
                    var proof=em.find(PaymentTransaction.class,prior.getOwnerRefundTransactionId());
                    require(proof!=null && proof.getId()<refund.getId() && proof.getStatus()==TransactionStatus.COMPLETED
                            && Objects.equals(proof.getOrganizationId(),org) && Objects.equals(proof.getSourceId(),refund.getSourceId())
                            && Objects.equals(proof.getSourceType(),refund.getSourceType()) && !Boolean.TRUE.equals(proof.getMetadata().get("reviewRequired")),
                            "Remboursement de la commission antérieure à rapprocher");
                    credited=credited.subtract(prior.getTotalTtc());
                }
                require(equal(credited,before),"Les avoirs de commission précédents doivent être rapprochés");
                if(amount.signum()>0) {
                    var allocation=new PaymentTransaction();allocation.setId(refund.getId());allocation.setAmount(amount);
                    allocation.setPaymentType(TransactionType.REFUND);allocation.setProviderTxId(refund.getProviderTxId());allocation.setTransactionRef(refund.getTransactionRef());
                    allocation.setMetadata(java.util.Map.of("externalRefund",true,"externalRefundConfirmed",true,"cumulativeRefund",true,"refundBefore",before.toPlainString()));
                    var note=copyReversed(original,allocation);note.setRefundTransactionId(null);note.setOwnerRefundTransactionId(refund.getId());
                    note.setInvoiceNumber(numbers.generateNextNumberFor(note));note.setPayoutId(payout.getId());
                    note.setLegalMentions("Avoir de commission sur facture "+original.getInvoiceNumber()+" consécutif au remboursement voyageur "+refund.getTransactionRef()+".");
                    invoices.saveAndFlush(note);
                }
            }
        }
        var meta=new HashMap<>(refund.getMetadata());meta.put("ownerRefundDocumentsChecked",true);refund.setMetadata(meta);
    }

    /** Diagnostic persistant et rotation des erreurs : un dossier incorrect ne bloque pas les suivants. */
    @Transactional
    public void recordFailure(String refundRef) {
        var tx = payments.lockByReference(tenant.getRequiredOrganizationId(), refundRef).orElseThrow();
        var metadata = new HashMap<>(tx.getMetadata());
        metadata.put("refundDocumentError", "Rapprochement de la facture et du remboursement requis");
        metadata.put("refundDocumentCheckedAt", LocalDateTime.now().toString());
        tx.setMetadata(metadata);
    }

    private static void clearError(PaymentTransaction tx) {
        var metadata = new HashMap<>(tx.getMetadata()); metadata.remove("refundDocumentError"); tx.setMetadata(metadata);
    }
    private static boolean equal(BigDecimal a, BigDecimal b) { return a != null && b != null && a.compareTo(b) == 0; }
    private static void require(boolean valid, String message) { if (!valid) throw new IllegalStateException(message); }
}
