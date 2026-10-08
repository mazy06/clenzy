package com.clenzy.service.payout;

import com.clenzy.model.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class ReservationPayoutFundingTest {
    static Reservation stay() {
        User owner = new User(); owner.setId(10L);
        Property property = new Property(); property.setId(50L); property.setOwner(owner);
        property.setOrganizationId(7L);
        property.setTimezone("Europe/Paris");
        Reservation stay = new Reservation();
        stay.setId(1L); stay.setOrganizationId(7L); stay.setProperty(property);
        stay.setCheckIn(LocalDate.of(2025, 8, 29)); stay.setCheckOut(LocalDate.of(2025, 9, 2));
        stay.setPaymentCollection(PaymentCollection.PMS); stay.setPaymentStatus(PaymentStatus.PAID);
        stay.setTotalPrice(new BigDecimal("100.00")); stay.setCurrency("EUR");
        return stay;
    }

    static PaymentTransaction receipt(long id, String amount) {
        PaymentTransaction tx = new PaymentTransaction();
        tx.setId(id); tx.setOrganizationId(7L); tx.setSourceType("RESERVATION"); tx.setSourceId(1L);
        tx.setProviderType(PaymentProviderType.STRIPE); tx.setProviderTxId("cs_" + id);
        tx.setPaymentType(TransactionType.CHECKOUT); tx.setStatus(TransactionStatus.COMPLETED);
        tx.setAmount(new BigDecimal(amount)); tx.setCurrency("EUR");
        return tx;
    }

    @Test void attributesCrossMonthStayToDepartureOnly() {
        assertThat(ReservationPayoutFunding.belongsToPeriod(stay(), LocalDate.of(2025, 8, 1), LocalDate.of(2025, 8, 31))).isFalse();
        assertThat(ReservationPayoutFunding.belongsToPeriod(stay(), LocalDate.of(2025, 9, 1), LocalDate.of(2025, 9, 30))).isTrue();
    }
    @Test void paidWithoutReceiptIsNotPlatformFunding() {
        assertThat(ReservationPayoutFunding.evaluate(stay(), List.of())).isEmpty();
    }
    @Test void creditDoesNotCreateStripeFunding() {
        var r=stay();r.setCreditApplied(new BigDecimal("20"));r.setConfirmationCode("LOYALTY");
        var p=receipt(1,"80");p.setMetadata(new java.util.HashMap<>(com.clenzy.booking.service.BaitlyReservationCredit.metadata(r,9L)));
        assertThat(ReservationPayoutFunding.evaluate(r,List.of(p)).orElseThrow().collectedAmount()).isEqualByComparingTo("80");
        p.setAmount(new BigDecimal("100"));
        assertThat(ReservationPayoutFunding.evaluate(r,List.of(p))).isEmpty();
        p.setAmount(new BigDecimal("80"));p.setMetadata(java.util.Map.of());
        assertThat(ReservationPayoutFunding.evaluate(r,List.of(p))).isEmpty();
    }
    @Test void disputedMoneyCannotFundTheOwnerEvenWhenPaymentRemainsPaid() {
        var receipt=receipt(1,"100"); receipt.setDisputedAmount(BigDecimal.TEN);
        assertThat(ReservationPayoutFunding.evaluate(stay(),List.of(receipt))).isEmpty();
        receipt.setDisputedAmount(BigDecimal.ZERO);
        assertThat(ReservationPayoutFunding.evaluate(stay(),List.of(receipt))).isPresent();
    }
    @Test void otaPaidIsNotMoneyCollectedByPlatform() {
        Reservation r = stay(); r.setPaymentCollection(PaymentCollection.CHANNEL);
        assertThat(ReservationPayoutFunding.evaluate(r, List.of(receipt(1, "100")))).isEmpty();
    }
    @Test void combinesBookingDepositAndConfirmedBalance() {
        PaymentTransaction deposit = receipt(1, "30"); deposit.setSourceType("BOOKING_CHECKOUT");
        PaymentTransaction balance = receipt(2, "70"); balance.setSourceType("BOOKING_BALANCE");
        var evidence = ReservationPayoutFunding.evaluate(stay(), List.of(deposit, balance)).orElseThrow();
        assertThat(evidence.collectedAmount()).isEqualByComparingTo("100");
        assertThat(evidence.transactionIds()).containsExactly(1L, 2L);
    }
    @ParameterizedTest @ValueSource(strings = {"30", "101"})
    void requiresExactFundingNotDepositOrOverpayment(String amount) {
        assertThat(ReservationPayoutFunding.evaluate(stay(), List.of(receipt(1, amount)))).isEmpty();
    }
    @ParameterizedTest @EnumSource(value = PaymentStatus.class, names = "PAID", mode = EnumSource.Mode.EXCLUDE)
    void excludesNonPaidReservation(PaymentStatus status) {
        Reservation r = stay(); r.setPaymentStatus(status);
        assertThat(ReservationPayoutFunding.evaluate(r, List.of(receipt(1, "100")))).isEmpty();
    }
    @ParameterizedTest @ValueSource(strings = {"cancelled", "canceled", "pending", "blocked", "unknown"})
    void excludesNonConfirmedStay(String status) {
        Reservation r = stay(); r.setStatus(status);
        assertThat(ReservationPayoutFunding.evaluate(r, List.of(receipt(1, "100")))).isEmpty();
    }
    @Test void excludesFutureDeparture() {
        Reservation r = stay(); r.setCheckOut(LocalDate.of(2999, 1, 1));
        assertThat(ReservationPayoutFunding.evaluate(r, List.of(receipt(1, "100")))).isEmpty();
    }
    @Test void ignoresOtherTenantAndOtherReservation() {
        PaymentTransaction otherOrg = receipt(1, "100"); otherOrg.setOrganizationId(8L);
        PaymentTransaction otherStay = receipt(2, "100"); otherStay.setSourceId(2L);
        assertThat(ReservationPayoutFunding.evaluate(stay(), List.of(otherOrg, otherStay))).isEmpty();
    }
    @Test void rejectsDifferentCurrencyEvenWhenAmountMatches() {
        PaymentTransaction tx = receipt(1, "100"); tx.setCurrency("MAD");
        assertThat(ReservationPayoutFunding.evaluate(stay(), List.of(tx))).isEmpty();
    }
    @ParameterizedTest @ValueSource(strings = {"EUR", "MAD", "SAR"})
    void preservesActualCurrency(String currency) {
        Reservation r = stay(); r.setCurrency(currency);
        PaymentTransaction tx = receipt(1, "100"); tx.setCurrency(currency);
        assertThat(ReservationPayoutFunding.evaluate(r, List.of(tx)).orElseThrow().currency()).isEqualTo(currency);
    }
    @Test void duplicateProviderReceiptDoesNotDoubleCollectedAmount() {
        PaymentTransaction duplicate = receipt(2, "100"); duplicate.setProviderTxId("cs_1");
        assertThat(ReservationPayoutFunding.evaluate(stay(), List.of(receipt(1, "100"), duplicate))
                .orElseThrow().collectedAmount()).isEqualByComparingTo("100");
    }
    @Test void rejectsRefundInProgress() {
        PaymentTransaction refund = receipt(2, "10"); refund.setPaymentType(TransactionType.REFUND);
        refund.setStatus(TransactionStatus.PROCESSING);
        assertThat(ReservationPayoutFunding.evaluate(stay(), List.of(receipt(1, "100"), refund))).isEmpty();
    }
    @ParameterizedTest @ValueSource(strings={"BOOKING_CANCELLATION","RESERVATION_REFUND_GUARD"})
    void standaloneRefundDecisionsBlockFundingEvenBeforeThePaidStatusChanges(String source) {
        PaymentTransaction refund=receipt(2,"10"); refund.setPaymentType(TransactionType.REFUND); refund.setSourceType(source);
        for(var status:List.of(TransactionStatus.PROCESSING,TransactionStatus.FAILED,TransactionStatus.COMPLETED)) {
            refund.setStatus(status);
            assertThat(ReservationPayoutFunding.evaluate(stay(),List.of(receipt(1,"100"),refund))).isEmpty();
        }
        refund.setStatus(TransactionStatus.CANCELLED);
        assertThat(ReservationPayoutFunding.evaluate(stay(),List.of(receipt(1,"100"),refund))).isPresent();
    }
    @Test void rejectsRefundedReceipt() {
        PaymentTransaction tx = receipt(1, "100"); tx.setStatus(TransactionStatus.REFUNDED);
        assertThat(ReservationPayoutFunding.evaluate(stay(), List.of(tx))).isEmpty();
    }
    @Test void doesNotTreatCaptureAsAnAdditionalCheckout() {
        PaymentTransaction capture = receipt(2, "100"); capture.setPaymentType(TransactionType.CAPTURE);
        assertThat(ReservationPayoutFunding.evaluate(stay(), List.of(receipt(1, "100"), capture))
                .orElseThrow().collectedAmount()).isEqualByComparingTo("100");
    }
    @Test void requiresProviderReference() {
        PaymentTransaction tx = receipt(1, "100"); tx.setProviderTxId(null);
        assertThat(ReservationPayoutFunding.evaluate(stay(), List.of(tx))).isEmpty();
    }

    static Reservation partiallyRefundedStay() {
        var r = stay(); r.setPaymentStatus(PaymentStatus.PARTIALLY_REFUNDED);
        r.setStatus("cancelled"); r.setCancelledAt(r.getCheckIn().atStartOfDay()); r.setStripeSessionId("cs_1"); return r;
    }

    static PaymentTransaction confirmedRefund() {
        var r = receipt(2,"40"); r.setSourceType("BOOKING_CANCELLATION"); r.setPaymentType(TransactionType.REFUND);
        r.setProviderTxId("re_confirmed");
        r.setMetadata(new java.util.HashMap<>(java.util.Map.of("cancellationRefund",true,
                "originalTransactionRef","TX-original","checkoutSessionId","cs_1","originalAmount","100")));
        return r;
    }

    @Test void retainedAmountIsNetOfConfirmedRefundAndKeepsBothProofs() {
        var original = receipt(1,"100"); original.setTransactionRef("TX-original");
        var result = ReservationPayoutFunding.evaluate(partiallyRefundedStay(), List.of(original, confirmedRefund())).orElseThrow();
        assertThat(result.collectedAmount()).isEqualByComparingTo("60");
        assertThat(result.transactionIds()).containsExactly(1L,2L);
    }

    @ParameterizedTest @ValueSource(strings={"pending","failed","provider","proof","review","original","amount","currency","session","full","over","duplicate","guard","credit","future"})
    void neverReattributesAnUnprovenOrUnavailableResidual(String defect) {
        var stay = partiallyRefundedStay(); var original = receipt(1,"100"); original.setTransactionRef("TX-original");
        var refund = confirmedRefund(); var rows = new java.util.ArrayList<>(List.of(original,refund));
        switch(defect) {
            case "pending" -> refund.setStatus(TransactionStatus.PROCESSING);
            case "failed" -> refund.setStatus(TransactionStatus.FAILED);
            case "provider" -> refund.setProviderTxId(null);
            case "proof" -> refund.getMetadata().remove("cancellationRefund");
            case "review" -> refund.getMetadata().put("reviewRequired",true);
            case "original" -> refund.getMetadata().put("originalTransactionRef","another");
            case "amount" -> refund.getMetadata().put("originalAmount","wrong");
            case "currency" -> refund.setCurrency("MAD");
            case "session" -> stay.setStripeSessionId("cs_other");
            case "full" -> refund.setAmount(new BigDecimal("100"));
            case "over" -> refund.setAmount(new BigDecimal("101"));
            case "duplicate" -> rows.add(confirmedRefund());
            case "guard" -> refund.setSourceType("RESERVATION_REFUND_GUARD");
            case "credit" -> stay.setCreditApplied(BigDecimal.ONE);
            case "future" -> stay.setCheckOut(LocalDate.of(2999,1,1));
        }
        assertThat(ReservationPayoutFunding.evaluate(stay,rows)).isEmpty();
    }
}
