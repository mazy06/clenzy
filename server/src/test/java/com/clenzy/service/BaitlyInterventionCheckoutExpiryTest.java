package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.checkout.Session;
import jakarta.persistence.*;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyInterventionCheckoutExpiryTest {
    final PaymentTransactionRepository payments=mock(PaymentTransactionRepository.class);
    final StripeGateway stripe=mock(StripeGateway.class);
    final BaitlyInterventionCheckoutExpiryWriter writer=mock(BaitlyInterventionCheckoutExpiryWriter.class);
    final BaitlyHistoricalCheckoutWriter history=mock(BaitlyHistoricalCheckoutWriter.class);
    final BaitlyInterventionCheckoutExpiry service=new BaitlyInterventionCheckoutExpiry(payments,stripe,writer,mock(TenantScopedExecutor.class),history);
    PaymentTransaction tx;
    Session session;
    @BeforeEach void setup() throws Exception {
        tx=new PaymentTransaction(); tx.setOrganizationId(2L); tx.setTransactionRef("TX-expiry"); tx.setSourceType("INTERVENTION");
        tx.setSourceId(352L); tx.setProviderType(PaymentProviderType.STRIPE); tx.setPaymentType(TransactionType.CHECKOUT);
        tx.setStatus(TransactionStatus.PROCESSING); tx.setProviderTxId("cs_test_expiry"); tx.setAmount(new BigDecimal("70")); tx.setCurrency("EUR");
        tx.setMetadata(new HashMap<>(Map.of("purpose","FULL")));
        session=new Session(); session.setId("cs_test_expiry"); session.setMode("payment"); session.setAmountTotal(7000L); session.setCurrency("eur");
        session.setStatus("expired"); session.setPaymentStatus("unpaid"); session.setMetadata(new HashMap<>(Map.of("transactionRef","TX-expiry","sourceType","INTERVENTION","sourceId","352","orgId","2","purpose","FULL")));
        when(payments.findByProviderTxId("cs_test_expiry")).thenReturn(Optional.of(tx));
        when(stripe.retrieveSession("cs_test_expiry")).thenReturn(session);
        when(writer.expire("TX-expiry","cs_test_expiry",2L)).thenReturn(true);
    }
    @Test void releasesOnlyCanonicalExpiredUnpaidSession() { assertThat(service.reconcile("cs_test_expiry",2L)).isTrue(); verify(writer).expire("TX-expiry","cs_test_expiry",2L); }
    @Test void noCrossOrganizationLookupAtStripe() { assertThat(service.reconcile("cs_test_expiry",9L)).isFalse(); verifyNoInteractions(stripe,writer); }
    @Test void openUnpaidDoesNotReleaseDebt() { session.setStatus("open"); assertThat(service.reconcile("cs_test_expiry",2L)).isFalse(); verifyNoInteractions(writer); }
    @Test void paidOrAsyncSessionNeverAllowsRetry() { session.setStatus("complete"); session.setPaymentStatus("paid"); assertThat(service.reconcile("cs_test_expiry",2L)).isFalse(); verifyNoInteractions(writer); }
    @Test void amountMismatchRejectsProof() { session.setAmountTotal(7001L); rejected(); }
    @Test void metadataMismatchRejectsProof() { session.getMetadata().put("sourceId","351"); rejected(); }
    @Test void existingIntentRequiresReview() { session.setPaymentIntent("pi_requires_review"); rejected(); }
    @Test void unreadableStripeCannotReleaseDebt() throws Exception { when(stripe.retrieveSession(any())).thenThrow(new com.stripe.exception.ApiException("offline",null,null,503,null)); rejected(); }
    private void rejected() { assertThatThrownBy(()->service.reconcile("cs_test_expiry",2L)).isInstanceOf(IllegalStateException.class); verifyNoInteractions(writer); }

    @Nested class Persistence {
        final InterventionRepository missions=mock(InterventionRepository.class);
        final InterventionPaymentAllocationRepository allocations=mock(InterventionPaymentAllocationRepository.class);
        final InterventionPaymentCoordination coordination=mock(InterventionPaymentCoordination.class);
        final InvoicePaymentCoordination invoices=mock(InvoicePaymentCoordination.class);
        final EntityManager em=mock(EntityManager.class);
        final BaitlyInterventionCheckoutExpiryWriter store=new BaitlyInterventionCheckoutExpiryWriter(payments,missions,allocations,coordination,invoices,em);
        Intervention mission;
        @BeforeEach void prepare() {
            mission=new Intervention(); mission.setId(352L); mission.setOrganizationId(2L); mission.setStatus(InterventionStatus.COMPLETED);
            mission.setCompletedAt(LocalDateTime.parse("2026-10-06T05:43:00")); mission.setStripeSessionId("cs_test_expiry"); mission.setPaymentStatus(PaymentStatus.PROCESSING);
            when(payments.findByTransactionRef("TX-expiry")).thenReturn(Optional.of(tx));
            when(missions.findAllByStripeSessionIdAndOrganizationId("cs_test_expiry",2L)).thenReturn(List.of(mission));
            when(coordination.lockMission(2L,352L)).thenReturn(mission);
        }
        @Test void freesPaymentAndKeepsCompletedMissionAndHistoricalSession() {
            assertThat(store.expire("TX-expiry","cs_test_expiry",2L)).isTrue();
            assertThat(mission.getStatus()).isEqualTo(InterventionStatus.COMPLETED);
            assertThat(mission.getCompletedAt()).isEqualTo(LocalDateTime.parse("2026-10-06T05:43:00"));
            assertThat(mission.getStripeSessionId()).isNull(); assertThat(mission.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
            assertThat(tx.getProviderTxId()).isEqualTo("cs_test_expiry"); assertThat(tx.getStatus()).isEqualTo(TransactionStatus.FAILED);
            verify(em).refresh(tx,LockModeType.PESSIMISTIC_WRITE); verify(invoices).releaseExpiredBindings(tx);
            assertThat(store.expire("TX-expiry","cs_test_expiry",2L)).isTrue();
            verify(invoices,times(1)).releaseExpiredBindings(tx);
        }
        @Test void completedTransactionWonRaceAndIsNotDowngraded() {
            doAnswer(i->{tx.setStatus(TransactionStatus.COMPLETED);return null;}).when(em).refresh(tx,LockModeType.PESSIMISTIC_WRITE);
            assertThat(store.expire("TX-expiry","cs_test_expiry",2L)).isFalse();
            assertThat(mission.getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING); verifyNoInteractions(invoices,coordination);
        }
        @Test void newerMissionSessionCannotBeCleared() { mission.setStripeSessionId("cs_test_new"); assertThatThrownBy(()->store.expire("TX-expiry","cs_test_expiry",2L)).isInstanceOf(IllegalStateException.class); assertThat(tx.getStatus()).isEqualTo(TransactionStatus.PROCESSING); }
        @Test void ambiguousSharedSessionCannotBeCleared() { when(missions.findAllByStripeSessionIdAndOrganizationId(any(),any())).thenReturn(List.of(mission,mission)); assertThatThrownBy(()->store.expire("TX-expiry","cs_test_expiry",2L)).isInstanceOf(IllegalStateException.class); verifyNoInteractions(coordination,invoices); }
        @Test void alreadyPaidMissionRequiresReview() { mission.setPaidAt(LocalDateTime.now()); assertThatThrownBy(()->store.expire("TX-expiry","cs_test_expiry",2L)).isInstanceOf(IllegalStateException.class); assertThat(tx.getStatus()).isEqualTo(TransactionStatus.PROCESSING); }
    }
}
