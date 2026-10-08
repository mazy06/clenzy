package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.LedgerEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;

/** Contre-passation de la fraction remboursée, sous le verrou du dossier d'annulation. */
@Service
public class ReservationCancellationLedger {
    private final LedgerEntryRepository entries;
    private final LedgerService ledger;
    private final WalletService wallets;
    public ReservationCancellationLedger(LedgerEntryRepository entries, LedgerService ledger, WalletService wallets) {
        this.entries = entries; this.ledger = ledger; this.wallets = wallets;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void reverse(Reservation reservation, PaymentTransaction refund, BigDecimal cashPaid) {
        process(reservation, refund, cashPaid, true);
    }

    /** Vérifie le journal avant tout appel PSP ; aucune écriture ni portefeuille estimé. */
    @Transactional(readOnly = true)
    public void validate(Reservation reservation, PaymentTransaction refund, BigDecimal cashPaid) {
        process(reservation, refund, cashPaid, false);
    }

    private void process(Reservation reservation, PaymentTransaction refund, BigDecimal cashPaid, boolean record) {
        Long org = refund.getOrganizationId();
        if (!Objects.equals(org, reservation.getOrganizationId())) throw new IllegalStateException("Organisation incohérente");
        if (!entries.findByOrganizationIdAndReferenceTypeAndReferenceId(org, LedgerReferenceType.REFUND, refund.getTransactionRef()).isEmpty())
            throw new IllegalStateException("Contre-écritures déjà présentes sur un dossier non confirmé");
        var receipt = debits(org, LedgerReferenceType.PAYMENT, reservation.getId().toString()).stream()
                .filter(e -> e.getDescription() != null && e.getDescription().startsWith("Paiement reservation:")).toList();
        if (receipt.size() != 1 || receipt.get(0).getAmount().compareTo(cashPaid) != 0)
            throw new IllegalStateException("Encaissement comptable de réservation à rapprocher");
        var splits = debits(org, LedgerReferenceType.SPLIT, "SPLIT-RES-" + reservation.getId());
        BigDecimal splitTotal = splits.stream().map(LedgerEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (splitTotal.compareTo(cashPaid) > 0) throw new IllegalStateException("Répartition incohérente");
        // Les remboursements successifs prennent la différence de deux répartitions cumulées.
        if(BaitlyRefundSeries.isSeries(refund)) {
            var ordered=splits.stream().sorted(java.util.Comparator.comparing(LedgerEntry::getId)).toList();
            var weights=new java.util.ArrayList<>(ordered.stream().map(LedgerEntry::getAmount).toList());
            weights.add(cashPaid.subtract(splitTotal));
            var before=BaitlyRefundSeries.apportion(weights,BaitlyRefundSeries.before(refund));
            var after=BaitlyRefundSeries.apportion(weights,BaitlyRefundSeries.after(refund));
            for(int i=0;i<ordered.size();i++) reversePair(ordered.get(i),refund,after.get(i).subtract(before.get(i)),record);
            reversePair(receipt.get(0),refund,refund.getAmount(),record);return;
        }
        // Arrondi cumulatif : la somme des parts ne peut dépasser la fraction remboursée.
        BigDecimal cumulative = BigDecimal.ZERO;
        BigDecimal reversed = BigDecimal.ZERO;
        for (var split : splits.stream().sorted(java.util.Comparator.comparing(LedgerEntry::getId)).toList()) {
            cumulative = cumulative.add(split.getAmount());
            BigDecimal target = cumulative.multiply(refund.getAmount()).divide(cashPaid, 2, RoundingMode.HALF_UP);
            BigDecimal share = target.subtract(reversed);
            reversePair(split, refund, share, record);
            reversed = target;
        }
        reversePair(receipt.get(0), refund, refund.getAmount(), record);
    }

    private List<LedgerEntry> debits(Long org, LedgerReferenceType type, String ref) {
        return entries.findByOrganizationIdAndReferenceTypeAndReferenceId(org, type, ref).stream()
                .filter(e -> e.getEntryType() == LedgerEntryType.DEBIT).toList();
    }

    private void reversePair(LedgerEntry debit, PaymentTransaction refund, BigDecimal amount, boolean record) {
        var credit = debit.getCounterpartEntryId() == null ? null : entries.findById(debit.getCounterpartEntryId()).orElse(null);
        if (credit == null || credit.getEntryType() != LedgerEntryType.CREDIT
                || !Objects.equals(debit.getId(), credit.getCounterpartEntryId())
                || !Objects.equals(refund.getOrganizationId(), debit.getOrganizationId())
                || !Objects.equals(refund.getOrganizationId(), credit.getOrganizationId())
                || !Objects.equals(refund.getCurrency(), debit.getCurrency())
                || !Objects.equals(refund.getCurrency(), credit.getCurrency())
                || debit.getAmount().signum() <= 0 || debit.getAmount().compareTo(credit.getAmount()) != 0
                || debit.getReferenceType() != credit.getReferenceType()
                || !Objects.equals(debit.getReferenceId(), credit.getReferenceId())
                || Objects.equals(debit.getWalletId(), credit.getWalletId()))
            throw new IllegalStateException("Paire comptable incohérente");
        var from = wallets.getWalletById(credit.getWalletId());
        var to = wallets.getWalletById(debit.getWalletId());
        if (!Objects.equals(from.getOrganizationId(), refund.getOrganizationId())
                || !Objects.equals(to.getOrganizationId(), refund.getOrganizationId())
                || !Objects.equals(from.getCurrency(), refund.getCurrency()) || !Objects.equals(to.getCurrency(), refund.getCurrency()))
            throw new IllegalStateException("Portefeuille incohérent");
        if (record && amount.signum() > 0) ledger.recordTransfer(from, to, amount, LedgerReferenceType.REFUND,
                refund.getTransactionRef(), "Remboursement annulation réservation #" + refund.getSourceId());
    }
}
