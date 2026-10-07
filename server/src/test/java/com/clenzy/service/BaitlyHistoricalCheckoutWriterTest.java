package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import jakarta.persistence.*;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyHistoricalCheckoutWriterTest {
    final PaymentTransactionRepository payments=mock(PaymentTransactionRepository.class);
    final InterventionRepository missions=mock(InterventionRepository.class);
    final InterventionPaymentAllocationRepository allocations=mock(InterventionPaymentAllocationRepository.class);
    final InterventionPaymentCoordination coordination=mock(InterventionPaymentCoordination.class);
    final PaymentPersistence persistence=mock(PaymentPersistence.class);
    final EntityManager em=mock(EntityManager.class);
    final BaitlyHistoricalCheckoutWriter writer=new BaitlyHistoricalCheckoutWriter(payments,missions,allocations,coordination,persistence,em);
    PaymentTransaction tx; Intervention mission;
    @BeforeEach void setup() {
        tx=new PaymentTransaction(); tx.setOrganizationId(2L); tx.setTransactionRef("TX-history"); tx.setSourceType("INTERVENTION");
        tx.setSourceId(335L); tx.setProviderTxId("cs_test_history"); tx.setProviderType(PaymentProviderType.STRIPE);
        tx.setPaymentType(TransactionType.CHECKOUT); tx.setStatus(TransactionStatus.PROCESSING);
        tx.setAmount(new BigDecimal("35"));tx.setCurrency("EUR");tx.setMetadata(Map.of("purpose","FULL"));
        mission=new Intervention();mission.setId(335L);mission.setOrganizationId(2L);mission.setPaymentStatus(PaymentStatus.PAID);
        mission.setStripeSessionId("cs_test_history");mission.setPaidAt(LocalDateTime.parse("2026-10-05T05:00:37"));
        mission.setEstimatedCost(new BigDecimal("35"));mission.setStatus(InterventionStatus.COMPLETED);
        when(payments.findByTransactionRef("TX-history")).thenReturn(Optional.of(tx));
        when(missions.findAllByStripeSessionIdAndOrganizationId("cs_test_history",2L)).thenReturn(List.of(mission));
        when(coordination.lockMission(2L,335L)).thenReturn(mission);
        when(persistence.completeTransaction("TX-history")).thenAnswer(i->{tx.setStatus(TransactionStatus.COMPLETED);return tx;});
    }
    void reconcile() { writer.reconcilePaid("TX-history","cs_test_history",2L,335L,new BigDecimal("35"),"eur","pi_verified"); }
    @Test void repairsJournalExactlyOnceWithoutChangingMissionOrRecrediting() {
        reconcile();reconcile();
        verify(persistence,times(1)).completeTransaction("TX-history");
        assertThat(tx.getMetadata()).containsEntry("historicalCheckoutVerified",true).containsEntry("verifiedPaymentIntent","pi_verified");
        assertThat(mission.getPaidAt()).isEqualTo(LocalDateTime.parse("2026-10-05T05:00:37"));
        assertThat(mission.getStatus()).isEqualTo(InterventionStatus.COMPLETED);
        verify(missions,never()).save(any());
    }
    @Test void concurrentCompletionCannotPublishAgain() {
        doAnswer(i->{tx.setStatus(TransactionStatus.COMPLETED);return null;}).when(em).refresh(tx,LockModeType.PESSIMISTIC_WRITE);
        reconcile();verifyNoInteractions(persistence,coordination);
    }
    @Test void unpaidMissionKeepsNormalConfirmationFlow() { mission.setPaymentStatus(PaymentStatus.PROCESSING);reconcile();verifyNoInteractions(persistence); }
    @Test void rejectsOtherOrganization() { tx.setOrganizationId(3L);rejected();verifyNoInteractions(em); }
    @Test void rejectsOtherSource() { tx.setSourceId(336L);rejected(); }
    @Test void rejectsChangedAmount() { tx.setAmount(new BigDecimal("36"));rejected(); }
    @Test void rejectsChangedCurrency() { tx.setCurrency("MAD");rejected(); }
    @Test void rejectsChangedSession() { mission.setStripeSessionId("cs_new");rejected(); }
    @Test void rejectsAmbiguousSession() { when(missions.findAllByStripeSessionIdAndOrganizationId(any(),any())).thenReturn(List.of(mission,mission));rejected(); }
    @Test void rejectsDeposit() { tx.setMetadata(Map.of("purpose","DEPOSIT"));rejected(); }
    @Test void rejectsPaidWithoutTimestamp() { mission.setPaidAt(null);rejected(); }
    private void rejected() { assertThatThrownBy(this::reconcile).isInstanceOf(IllegalStateException.class);verifyNoInteractions(persistence); }
}
