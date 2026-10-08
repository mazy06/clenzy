package com.clenzy.booking.service;

import com.clenzy.model.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.service.CalendarEngine;
import jakarta.persistence.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyBookingHoldLifecycleTest {
    final EntityManager em=mock(EntityManager.class);
    final PaymentTransactionRepository payments=mock(PaymentTransactionRepository.class);
    final CalendarEngine calendar=mock(CalendarEngine.class);
    final BaitlyBookingHoldLifecycle service=new BaitlyBookingHoldLifecycle(em,payments,calendar);
    final Reservation stay=new Reservation();
    @BeforeEach void setup() {
        stay.setId(1L);stay.setOrganizationId(2L);stay.setStatus("pending");stay.setPaymentStatus(PaymentStatus.PENDING);
        when(em.find(Reservation.class,1L,LockModeType.PESSIMISTIC_WRITE)).thenReturn(stay);
    }
    @ParameterizedTest @EnumSource(TransactionStatus.class)
    void anyRecordedAttemptPreventsReleaseWithoutCanonicalExpiration(TransactionStatus status) {
        var p=new PaymentTransaction();p.setStatus(status);
        when(payments.findByOrganizationIdAndSourceTypeAndSourceId(2L,"BOOKING_CHECKOUT",1L)).thenReturn(List.of(p));
        service.releaseIfNotStarted(1L);
        assertThat(stay.getStatus()).isEqualTo("pending");verifyNoInteractions(calendar);
    }
    @Test void validationFailureBeforePaymentReleasesDates() {
        service.releaseIfNotStarted(1L);
        assertThat(stay.getPaymentStatus()).isEqualTo(PaymentStatus.CANCELLED);
        verify(calendar).cancel(1L,2L,"booking-engine-embedded-rollback");
    }
    @Test void lateAttachCannotUndoCancellation() {
        stay.markCancelled();
        assertThatThrownBy(()->service.attach(1L,"cs_a")).hasMessageContaining("changé");
        assertThat(stay.getStripeSessionId()).isNull();
    }
    @Test void successfulFastWebhookIsPreservedByAttachReplay() {
        stay.setStripeSessionId("cs_a");stay.setStatus("confirmed");stay.setPaymentStatus(PaymentStatus.PAID);
        service.attach(1L,"cs_a");service.releaseIfNotStarted(1L);
        assertThat(stay.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);verifyNoInteractions(calendar);
    }
    @Test void unknownSessionIsNeverAttached() {
        assertThatThrownBy(()->service.attach(1L,"cs_unknown")).hasMessageContaining("intention");
        assertThat(stay.getStripeSessionId()).isNull();
    }
    @Test void verifiedIntentAllowsSessionBindingOnce() {
        var p=new PaymentTransaction();p.setPaymentType(TransactionType.CHECKOUT);p.setStatus(TransactionStatus.PROCESSING);p.setProviderTxId("cs_a");
        when(payments.findByOrganizationIdAndSourceTypeAndSourceId(2L,"BOOKING_CHECKOUT",1L)).thenReturn(List.of(p));
        service.attach(1L,"cs_a");service.attach(1L,"cs_a");
        assertThat(stay.getStripeSessionId()).isEqualTo("cs_a");
        assertThatThrownBy(()->service.attach(1L,"cs_other")).hasMessageContaining("changé");
    }

    com.stripe.model.checkout.Session paidDeposit() {
        stay.setCurrency("EUR");stay.setTotalPrice(new java.math.BigDecimal("100"));
        var p=new PaymentTransaction();p.setOrganizationId(2L);p.setSourceType("BOOKING_CHECKOUT");p.setSourceId(1L);
        p.setPaymentType(TransactionType.CHECKOUT);p.setStatus(TransactionStatus.COMPLETED);p.setProviderType(PaymentProviderType.STRIPE);
        p.setAmount(new java.math.BigDecimal("30"));p.setCurrency("EUR");p.setProviderTxId("cs_paid");
        p.setMetadata(java.util.Map.of("server_total","100.00","deposit_balance","70.00"));
        when(payments.findByProviderTxId("cs_paid")).thenReturn(java.util.Optional.of(p));
        var s=new com.stripe.model.checkout.Session();s.setId("cs_paid");s.setStatus("complete");s.setPaymentStatus("paid");s.setAmountTotal(3000L);
        s.setCurrency("eur");s.setMetadata(java.util.Map.of("deposit_balance","70.00"));return s;
    }
    @Test void confirmedDepositBindsPreviouslyUnattachedHold() {
        assertThat(service.confirmable(paidDeposit())).isSameAs(stay);assertThat(stay.getStripeSessionId()).isEqualTo("cs_paid");
    }
    @Test void cancelledDatesAreNeverReactivatedByLateMoney() {
        var s=paidDeposit();stay.markCancelled();
        assertThatThrownBy(()->service.confirmable(s)).hasMessageContaining("rapprocher");assertThat(stay.getStripeSessionId()).isNull();
    }
    @Test void changedDepositMetadataCannotAlterRemainingBalance() {
        var s=paidDeposit();s.setMetadata(java.util.Map.of("deposit_balance","0"));
        assertThatThrownBy(()->service.confirmable(s)).hasMessageContaining("incohérent");
    }
    @Test void wrongCurrencyAndMissingJournalCannotConfirm() {
        var s=paidDeposit();s.setCurrency("mad");assertThatThrownBy(()->service.confirmable(s)).hasMessageContaining("rapprocher");
        s.setId("cs_unknown");assertThatThrownBy(()->service.confirmable(s)).hasMessageContaining("sans dossier");
    }
}
