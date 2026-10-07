package com.clenzy.booking.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;

/** Sépare le règlement en crédit fidélité de l'argent effectivement encaissé par le PSP. */
@Service
public class BaitlyReservationCredit {
    private final GuestCreditService credits;
    private final PaymentTransactionRepository payments;
    private final com.clenzy.service.voucher.BaitlyVoucherClaims vouchers;

    public BaitlyReservationCredit(GuestCreditService credits, PaymentTransactionRepository payments,
            com.clenzy.service.voucher.BaitlyVoucherClaims vouchers) {
        this.credits = credits;
        this.payments = payments;
        this.vouchers = vouchers;
    }

    public static BigDecimal applied(Reservation stay) {
        BigDecimal amount = stay.getCreditApplied() == null ? BigDecimal.ZERO : stay.getCreditApplied();
        if (amount.signum() < 0 || (amount.signum() > 0 && (stay.getTotalPrice() == null
                || amount.compareTo(stay.getTotalPrice()) >= 0 || !"EUR".equalsIgnoreCase(stay.getCurrency()))))
            throw new IllegalStateException("Crédit du séjour incohérent : rapprochement requis");
        amount.movePointRight(2).longValueExact();
        return amount;
    }

    public static BigDecimal cash(Reservation stay) { return stay.getTotalPrice().subtract(applied(stay)); }

    @Transactional(readOnly = true)
    public Map<String, String> checkoutMetadata(Reservation stay) {
        return metadata(stay, applied(stay).signum() > 0
            ? credits.accountId(stay.getOrganizationId(), email(stay), stay.getCurrency()) : null);
    }

    /** Intention figée côté serveur avant création de la session. Aucun email envoyé au PSP. */
    public static Map<String, String> metadata(Reservation stay, Long accountId) {
        if (applied(stay).signum() == 0) return Map.of();
        if (accountId == null || stay.getConfirmationCode() == null)
            throw new IllegalStateException("Preuve du crédit absente");
        return Map.of("baitlyCreditAccount", accountId.toString(),
            "baitlyCreditMinor", Long.toString(applied(stay).movePointRight(2).longValueExact()),
            "baitlyCreditCode", stay.getConfirmationCode());
    }

    public static Long requireIntent(Reservation stay, PaymentTransaction payment) {
        Map<String, Object> metadata = payment.getMetadata();
        if (metadata == null || !Objects.equals(stay.getConfirmationCode(), metadata.get("baitlyCreditCode"))
                || !Long.toString(applied(stay).movePointRight(2).longValueExact()).equals(metadata.get("baitlyCreditMinor")))
            throw new IllegalStateException("Intention du crédit modifiée : rapprochement requis");
        try { return Long.valueOf(Objects.toString(metadata.get("baitlyCreditAccount"), "")); }
        catch (NumberFormatException invalid) { throw new IllegalStateException("Compte du crédit absent", invalid); }
    }

    /** Appelé sous le verrou du séjour, AVANT PAID, ledger, factures ou notifications. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void confirm(Reservation stay) {
        vouchers.consume(stay);
        if (applied(stay).signum() == 0) return;
        var payment = payments.findByProviderTxId(stay.getStripeSessionId())
            .orElseThrow(() -> new IllegalStateException("Encaissement réduit sans preuve : rapprochement requis"));
        if (payment.getStatus() != TransactionStatus.COMPLETED || payment.getPaymentType() != TransactionType.CHECKOUT
                || !java.util.Set.of("RESERVATION","BOOKING_CHECKOUT").contains(payment.getSourceType()) || !Objects.equals(stay.getId(), payment.getSourceId())
                || !Objects.equals(stay.getOrganizationId(), payment.getOrganizationId())
                || !Objects.equals(stay.getCurrency(), payment.getCurrency()) || payment.hasDisputeRisk()
                || payment.getAmount() == null || cash(stay).compareTo(payment.getAmount()) != 0
                || payment.getMetadata() == null || Boolean.TRUE.equals(payment.getMetadata().get("reviewRequired")))
            throw new IllegalStateException("Encaissement du crédit incohérent : rapprochement requis");
        Long account = requireIntent(stay, payment);
        if (!credits.redeem(stay.getOrganizationId(), email(stay), applied(stay).movePointRight(2).longValueExact(),
                stay.getCurrency(), stay.getConfirmationCode(), account))
            throw new IllegalStateException("Crédit fidélité insuffisant : encaissement à rapprocher");
    }

    /** Le reversement s'appuie aussi sur l'écriture de crédit, jamais sur un champ déclaré seul. */
    @Transactional(readOnly = true)
    public void requireConsumed(Reservation stay) {
        if (applied(stay).signum() == 0) return;
        if (!credits.hasReconciledRedemption(stay.getOrganizationId(), email(stay), applied(stay).movePointRight(2).longValueExact(),
                stay.getCurrency(), stay.getConfirmationCode()))
            throw new IllegalStateException("Crédit du séjour non rapproché : reversement indisponible");
    }

    private static String email(Reservation stay) { return stay.getGuest() == null ? null : stay.getGuest().getEmail(); }
}
