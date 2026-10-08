package com.clenzy.service.payout;

import com.clenzy.model.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

/** Règles Baitly : un statut PAID seul ne prouve jamais un encaissement plateforme. */
public final class ReservationPayoutFunding {
    public static final Set<String> SOURCES = Set.of("RESERVATION", "BOOKING_CHECKOUT", "BOOKING_BALANCE");
    public static final Set<String> FUNDING_SOURCES = Set.of("RESERVATION", "BOOKING_CHECKOUT", "BOOKING_BALANCE",
            "BOOKING_CANCELLATION", "RESERVATION_REFUND_GUARD");

    private ReservationPayoutFunding() {}

    public record Evidence(String currency, BigDecimal collectedAmount, List<Long> transactionIds) {}

    public static boolean belongsToPeriod(Reservation reservation, LocalDate from, LocalDate to) {
        LocalDate departure = reservation.getCheckOut();
        return departure != null && !departure.isBefore(from) && !departure.isAfter(to);
    }

    public static Optional<Evidence> evaluate(Reservation reservation, List<PaymentTransaction> transactions) {
        if (!isEligibleStay(reservation)) return Optional.empty();
        String currency = currency(reservation.getCurrency());
        BigDecimal total = reservation.getTotalPrice();
        if (currency == null || total == null || total.signum() <= 0) return Optional.empty();

        Map<String, PaymentTransaction> receipts = new LinkedHashMap<>();
        List<PaymentTransaction> refunds = new ArrayList<>();
        for (PaymentTransaction tx : transactions) {
            if (!Objects.equals(tx.getOrganizationId(), reservation.getOrganizationId())
                    || !Objects.equals(tx.getSourceId(), reservation.getId())
                    || tx.getSourceType() == null || !FUNDING_SOURCES.contains(tx.getSourceType())) continue;
            // Une décision ambiguë reste bloquante même si son émission a été classée FAILED.
            if (!SOURCES.contains(tx.getSourceType())) {
                if (tx.getPaymentType() == TransactionType.REFUND && tx.getStatus() != TransactionStatus.CANCELLED) {
                    if (!"BOOKING_CANCELLATION".equals(tx.getSourceType())) return Optional.empty();
                    refunds.add(tx);
                }
                continue;
            }
            if (tx.hasDisputeRisk()) return Optional.empty();
            if(tx.getPaymentType()==TransactionType.REFUND && com.clenzy.service.BaitlyExternalRefundStore.external(tx)) {
                if(com.clenzy.service.BaitlyExternalRefundStore.rejectedBeforeAccounting(tx)) continue;
                refunds.add(tx);continue;
            }
            // Une demande de remboursement en cours exige aussi un rapprochement avant versement.
            if (tx.getStatus() == TransactionStatus.REFUNDED
                    || (tx.getPaymentType() == TransactionType.REFUND
                        && tx.getStatus() != TransactionStatus.FAILED
                        && tx.getStatus() != TransactionStatus.CANCELLED)) return Optional.empty();
            if (tx.getStatus() != TransactionStatus.COMPLETED
                    || tx.getPaymentType() != TransactionType.CHECKOUT) continue;
            if (tx.getId() == null || tx.getProviderType() == null
                    || tx.getProviderTxId() == null || tx.getProviderTxId().isBlank()
                    || !currency.equals(currency(tx.getCurrency()))
                    || tx.getAmount() == null || tx.getAmount().signum() <= 0) return Optional.empty();
            String key = tx.getProviderType() + ":" + tx.getProviderTxId();
            PaymentTransaction previous = receipts.putIfAbsent(key, tx);
            if (previous != null && previous.getAmount().compareTo(tx.getAmount()) != 0) return Optional.empty();
        }
        BigDecimal collected = receipts.values().stream().map(PaymentTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        // Acompte, trop-perçu ou doublon ambigu : aucune estimation ne devient un reversement.
        try {
            if (collected.compareTo(com.clenzy.booking.service.BaitlyReservationCredit.cash(reservation)) != 0) return Optional.empty();
            if (com.clenzy.booking.service.BaitlyReservationCredit.applied(reservation).signum() > 0) {
                if (receipts.size() != 1) return Optional.empty();
                com.clenzy.booking.service.BaitlyReservationCredit.requireIntent(reservation, receipts.values().iterator().next());
            }
        } catch (IllegalStateException | ArithmeticException invalid) { return Optional.empty(); }
        List<Long> evidenceIds = new ArrayList<>(receipts.values().stream().map(PaymentTransaction::getId).toList());
        if (reservation.getPaymentStatus() == PaymentStatus.PARTIALLY_REFUNDED) {
            // Seul le remboursement canonique d'un encaissement unique est réattribuable.
            // Les acomptes, avoirs utilisés comme paiement et historiques ambigus restent bloqués.
            if (receipts.size() != 1 || refunds.isEmpty())
                return Optional.empty();
            var original = receipts.values().iterator().next();
            if(refunds.stream().allMatch(com.clenzy.service.BaitlyExternalRefundStore::confirmed)) {
                try {
                    com.clenzy.service.BaitlyRefundSeries.history(original,refunds);
                } catch(IllegalStateException | com.clenzy.exception.PaymentValidationException | ArithmeticException | IllegalArgumentException invalid) { return Optional.empty(); }
            } else if(refunds.size()!=1) return Optional.empty();
            for(var refund:refunds) {
                if (!confirmedRefund(reservation, original, refund)) return Optional.empty();
                collected = collected.subtract(refund.getAmount());evidenceIds.add(refund.getId());
            }
            if(collected.signum()<=0) return Optional.empty();
        } else if (!refunds.isEmpty()) return Optional.empty();
        return Optional.of(new Evidence(currency, collected,
                evidenceIds.stream().sorted().toList()));
    }

    private static boolean confirmedRefund(Reservation reservation, PaymentTransaction original, PaymentTransaction refund) {
        var metadata = refund.getMetadata();
        if (refund.getId() == null || refund.getStatus() != TransactionStatus.COMPLETED
                || refund.getProviderType() != PaymentProviderType.STRIPE
                || original.getProviderType() != PaymentProviderType.STRIPE || !"RESERVATION".equals(original.getSourceType())
                || !original.getProviderTxId().startsWith("cs_") || refund.getProviderTxId() == null
                || !refund.getProviderTxId().startsWith("re_") || refund.hasDisputeRisk()
                || refund.getErrorMessage() != null || metadata == null
                || !(Boolean.TRUE.equals(metadata.get("cancellationRefund"))
                    || (com.clenzy.service.BaitlyExternalRefundStore.confirmed(refund) && "succeeded".equals(metadata.get("stripeStatus"))
                        && Boolean.FALSE.equals(metadata.get("reviewRequired")) && com.clenzy.service.BaitlyRefundSeries.isSeries(refund)))
                || Boolean.TRUE.equals(metadata.get("reviewRequired"))
                || original.getTransactionRef() == null || !original.getTransactionRef().equals(metadata.get("originalTransactionRef"))
                || !original.getProviderTxId().equals(metadata.get("checkoutSessionId"))
                || !original.getProviderTxId().equals(reservation.getStripeSessionId())
                || !original.getCurrency().equals(refund.getCurrency()) || !"EUR".equals(refund.getCurrency())
                || refund.getAmount() == null || refund.getAmount().signum() <= 0
                || refund.getAmount().compareTo(original.getAmount()) >= 0) return false;
        try {
            return original.getAmount().compareTo(new BigDecimal(Objects.toString(metadata.get("originalAmount"), ""))) == 0;
        } catch (NumberFormatException invalid) { return false; }
    }

    private static boolean isEligibleStay(Reservation reservation) {
        if (reservation.getId() == null || reservation.getOrganizationId() == null
                || reservation.getPaymentCollection() != PaymentCollection.PMS
                || reservation.getCheckOut() == null) return false;
        boolean retainedCancellation = reservation.getPaymentStatus() == PaymentStatus.PARTIALLY_REFUNDED
                && reservation.getCancelledAt() != null && "cancelled".equalsIgnoreCase(reservation.getStatus());
        boolean completed = (reservation.getPaymentStatus() == PaymentStatus.PAID || reservation.getPaymentStatus() == PaymentStatus.PARTIALLY_REFUNDED) && reservation.getCancelledAt() == null
                && Set.of("confirmed", "completed", "checked_in", "checked_out")
                    .contains(Objects.toString(reservation.getStatus(), "").toLowerCase(Locale.ROOT));
        if (!retainedCancellation && !completed) return false;
        // Même échéance contractuelle qu'avant : l'annulation n'avance pas le reversement.
        String timezone = reservation.getProperty() == null ? null : reservation.getProperty().getTimezone();
        // Même repli que le planning : aucune dépendance au fuseau de la JVM.
        ZoneId zone = ZoneId.of(timezone == null || timezone.isBlank() ? "Europe/Paris" : timezone);
        return !reservation.getCheckOut().isAfter(LocalDate.now(zone));
    }

    public static String currency(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Currency.getInstance(value.trim().toUpperCase(Locale.ROOT)).getCurrencyCode();
        } catch (IllegalArgumentException invalid) {
            return null;
        }
    }
}
