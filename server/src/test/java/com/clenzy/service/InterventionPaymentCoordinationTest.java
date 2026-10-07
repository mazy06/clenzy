package com.clenzy.service;

import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.model.Intervention;
import com.clenzy.repository.PaymentTransactionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InterventionPaymentCoordinationTest {

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"valid", "partial", "currency", "session", "unpaid", "shared", "allocation", "cancellation"})
    void fullRefundRequiresAnUnsharedAndReconciledMission(String scenario) {
        var em = mock(EntityManager.class);
        var query = mock(jakarta.persistence.Query.class);
        when(em.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(
                scenario.equals("shared") || scenario.equals("allocation") ? 1L : 0L,
                scenario.equals("cancellation") ? 1L : 0L);
        var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        mission.setPaymentStatus(com.clenzy.model.PaymentStatus.PAID); mission.setEstimatedCost(new BigDecimal("35"));
        mission.setCurrency("EUR"); mission.setStripeSessionId("cs_original");
        var payment = new com.clenzy.model.PaymentTransaction(); payment.setId(2L); payment.setOrganizationId(7L);
        payment.setSourceId(1L); payment.setProviderType(com.clenzy.model.PaymentProviderType.STRIPE);
        payment.setAmount(new BigDecimal("35")); payment.setCurrency("EUR"); payment.setProviderTxId("cs_original");
        when(em.find(Intervention.class, 1L)).thenReturn(mission);
        switch (scenario) {
            case "partial" -> mission.setEstimatedCost(new BigDecimal("50"));
            case "currency" -> mission.setCurrency("USD");
            case "session" -> mission.setStripeSessionId("cs_other");
            case "unpaid" -> mission.setPaymentStatus(com.clenzy.model.PaymentStatus.REFUNDED);
        }
        var coordination = new InterventionPaymentCoordination(em, mock(PaymentTransactionRepository.class),
                mock(com.clenzy.repository.ServiceQuoteRepository.class), mock(CurrencyConverterService.class));
        if (scenario.equals("valid")) assertThatCode(() -> coordination.requireStandaloneRefund(payment)).doesNotThrowAnyException();
        else assertThatThrownBy(() -> coordination.requireStandaloneRefund(payment)).isInstanceOf(RuntimeException.class);
        verify(em).refresh(mission, LockModeType.PESSIMISTIC_WRITE);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"PAID","PARTIALLY_PAID","REFUNDED","PROCESSING","transaction","legacySession"})
    void missionCannotRechargeItsServiceRequest(String state) {
        var em=mock(EntityManager.class);
        var transactions=mock(PaymentTransactionRepository.class);
        var need=new com.clenzy.model.ServiceRequest(); need.setId(5L); need.setOrganizationId(7L);
        var mission=new Intervention(); mission.setId(1L); mission.setOrganizationId(7L); mission.setServiceRequest(need);
        when(em.find(Intervention.class,1L)).thenReturn(mission);
        if (state.equals("transaction")) {
            var tx=new com.clenzy.model.PaymentTransaction(); tx.setPaymentType(com.clenzy.model.TransactionType.CHECKOUT);
            tx.setStatus(com.clenzy.model.TransactionStatus.PROCESSING);
            when(transactions.findByOrganizationIdAndSourceTypeAndSourceId(7L,"SERVICE_REQUEST",5L)).thenReturn(java.util.List.of(tx));
        } else if (state.equals("legacySession")) {
            need.setStripeSessionId("cs_existing");
        } else {
            doAnswer(call->{need.setPaymentStatus(com.clenzy.model.PaymentStatus.valueOf(state));return null;})
                    .when(em).refresh(need,LockModeType.PESSIMISTIC_WRITE);
        }
        var coordination=new InterventionPaymentCoordination(em,transactions,
                mock(com.clenzy.repository.ServiceQuoteRepository.class),mock(CurrencyConverterService.class));
        assertThatThrownBy(()->coordination.lockPaymentMissions(7L,request("INTERVENTION_BATCH",1L,Map.of("interventionIds","1"))))
                .isInstanceOf(RuntimeException.class);
        verify(em).refresh(need,LockModeType.PESSIMISTIC_WRITE);
        verify(em,never()).refresh(mission,LockModeType.PESSIMISTIC_WRITE);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"converted","legacyConverted","amount","transaction","ready"})
    void requestIsRecheckedUnderLockBeforePersistingCheckout(String condition) {
        var em=mock(EntityManager.class);
        var transactions=mock(PaymentTransactionRepository.class);
        var need=new com.clenzy.model.ServiceRequest(); need.setId(5L); need.setOrganizationId(7L);
        need.setStatus(com.clenzy.model.RequestStatus.AWAITING_PAYMENT); need.setEstimatedCost(BigDecimal.TEN);
        when(em.find(com.clenzy.model.ServiceRequest.class,5L)).thenReturn(need);
        if(condition.equals("converted")) {
            doAnswer(call->{need.setConvertedInterventionId(1L);return null;}).when(em).refresh(need,LockModeType.PESSIMISTIC_WRITE);
        } else {
            var query=mock(jakarta.persistence.TypedQuery.class);
            when(em.createQuery(anyString(),eq(Long.class))).thenReturn(query);
            when(query.setParameter("id",5L)).thenReturn(query);
            when(query.getSingleResult()).thenReturn(condition.equals("legacyConverted")?1L:0L);
            if(condition.equals("amount")) need.setEstimatedCost(new BigDecimal("11"));
            if(condition.equals("transaction")) {
                var tx=new com.clenzy.model.PaymentTransaction();tx.setPaymentType(com.clenzy.model.TransactionType.CHECKOUT);
                tx.setStatus(com.clenzy.model.TransactionStatus.FAILED);
                when(transactions.findByOrganizationIdAndSourceTypeAndSourceId(7L,"SERVICE_REQUEST",5L)).thenReturn(java.util.List.of(tx));
            }
        }
        var coordination=new InterventionPaymentCoordination(em,transactions,
                mock(com.clenzy.repository.ServiceQuoteRepository.class),mock(CurrencyConverterService.class));
        if(condition.equals("ready")) assertThat(coordination.lockPaymentMissions(7L,request("SERVICE_REQUEST",5L,Map.of()))).isEmpty();
        else assertThatThrownBy(()->coordination.lockPaymentMissions(7L,request("SERVICE_REQUEST",5L,Map.of())))
                .isInstanceOf(com.clenzy.exception.PaymentValidationException.class);
        verify(em).refresh(need,LockModeType.PESSIMISTIC_WRITE);
    }

    @Test void overlappingBatchOrUnitPaymentIsBlockedUnderMissionLock() {
        var em=mock(EntityManager.class);
        var transactions=mock(PaymentTransactionRepository.class);
        var mission=new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        when(em.find(Intervention.class,1L)).thenReturn(mission);
        when(transactions.hasOpenInterventionPayment(7L,1L)).thenReturn(true);
        var coordination=new InterventionPaymentCoordination(em,transactions,mock(com.clenzy.repository.ServiceQuoteRepository.class),mock(CurrencyConverterService.class));
        assertThatThrownBy(()->coordination.lockPaymentMissions(7L,request("INTERVENTION",1L,Map.of()))).hasMessageContaining("déjà en cours");
        var order=inOrder(em,transactions);
        order.verify(em).refresh(mission,LockModeType.PESSIMISTIC_WRITE);
        order.verify(transactions).hasOpenInterventionPayment(7L,1L);
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"PAID", "PARTIALLY_PAID", "PROCESSING", "REFUNDED", "checkout", "paidAt", "transaction", "none"})
    void cancellationUsesBothDurablePaymentsAndLegacyMarkers(String state) {
        var repository = mock(PaymentTransactionRepository.class);
        var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        switch (state) {
            case "checkout" -> mission.setStripeSessionId("session");
            case "paidAt" -> mission.setPaidAt(java.time.LocalDateTime.now());
            case "transaction" -> when(repository.hasRecordedInterventionPayment(7L, 1L)).thenReturn(true);
            case "none" -> { }
            default -> mission.setPaymentStatus(com.clenzy.model.PaymentStatus.valueOf(state));
        }
        var coordination = new InterventionPaymentCoordination(mock(EntityManager.class), repository,
                mock(com.clenzy.repository.ServiceQuoteRepository.class), mock(CurrencyConverterService.class));
        assertThat(coordination.cancellationNeedsPaymentReview(mission)).isEqualTo(!state.equals("none"));
    }
    @Test void changedAmountAndCurrencyAreRejectedAfterRefresh() {
        var em = mock(EntityManager.class);
        var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        mission.setEstimatedCost(BigDecimal.TEN);
        var coordination = new InterventionPaymentCoordination(em, mock(PaymentTransactionRepository.class),
                mock(com.clenzy.repository.ServiceQuoteRepository.class), mock(CurrencyConverterService.class));
        when(em.find(Intervention.class, 1L)).thenReturn(mission);
        doAnswer(call -> { mission.setEstimatedCost(new BigDecimal("12")); return null; })
                .when(em).refresh(mission, LockModeType.PESSIMISTIC_WRITE);
        assertThatThrownBy(() -> coordination.lockPaymentMissions(7L, request("INTERVENTION", 1L, Map.of())))
                .hasMessageContaining("montant à payer a changé");
        doAnswer(call -> { mission.setEstimatedCost(BigDecimal.TEN); mission.setCurrency("MAD"); return null; })
                .when(em).refresh(mission, LockModeType.PESSIMISTIC_WRITE);
        assertThatThrownBy(() -> coordination.lockPaymentMissions(7L, request("INTERVENTION", 1L, Map.of())))
                .hasMessageContaining("devise");
    }

    @Test void unprovenDepositIsRereadAndBlockedBeforeComputingBalance() {
        var em = mock(EntityManager.class);
        var quotes = mock(com.clenzy.repository.ServiceQuoteRepository.class);
        var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        mission.setEstimatedCost(BigDecimal.TEN);
        var quote = new com.clenzy.model.ServiceQuote();
        quote.setStatus(com.clenzy.model.ServiceQuote.Status.APPROVED);
        quote.setDepositAmount(new BigDecimal("2"));
        when(em.find(Intervention.class, 1L)).thenReturn(mission);
        when(quotes.findByInterventionIdAndOrganizationIdOrderByAmountAsc(1L, 7L)).thenReturn(java.util.List.of(quote));
        doAnswer(call -> { quote.setDepositPaidAt(java.time.LocalDateTime.now()); return null; }).when(em).refresh(quote);
        var coordination = new InterventionPaymentCoordination(em, mock(PaymentTransactionRepository.class), quotes, mock(CurrencyConverterService.class));
        assertThatThrownBy(() -> coordination.lockPaymentMissions(7L, request("INTERVENTION", 1L, Map.of())))
                .hasMessageContaining("rapproché avant le paiement du solde");
        assertThatThrownBy(() -> coordination.lockPaymentMissions(7L, request("INTERVENTION", 1L, Map.of("purpose", "DEPOSIT"))))
                .hasMessageContaining("rapproché avant le paiement du solde");
    }

    @Test void deferredPaymentUsesFreshBalanceAndLocalCurrencyConversion() {
        var em = mock(EntityManager.class);
        var converter = mock(CurrencyConverterService.class);
        var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        mission.setEstimatedCost(new BigDecimal("100")); mission.setCurrency("MAD");
        // Une mission terminée reste payable via le parcours différé.
        mission.setStatus(com.clenzy.model.InterventionStatus.COMPLETED);
        when(em.find(Intervention.class, 1L)).thenReturn(mission);
        when(converter.convert(eq(new BigDecimal("100")), eq("MAD"), eq("EUR"), any())).thenReturn(BigDecimal.TEN);
        var coordination = new InterventionPaymentCoordination(em, mock(PaymentTransactionRepository.class),
                mock(com.clenzy.repository.ServiceQuoteRepository.class), converter);
        coordination.lockPaymentMissions(7L, request(DeferredPaymentService.SOURCE_TYPE_HOST, 99L, Map.of("intervention_ids", "1")));
        verify(converter).convert(eq(new BigDecimal("100")), eq("MAD"), eq("EUR"), any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"INTERVENTION","INTERVENTION_BATCH"})
    void completedMissionRemainsPayableAfterTheFinalLock(String source) {
        var em=mock(EntityManager.class);
        var mission=new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        mission.setEstimatedCost(BigDecimal.TEN); mission.setCurrency("EUR");
        when(em.find(Intervention.class,1L)).thenReturn(mission);
        doAnswer(call -> { mission.setStatus(com.clenzy.model.InterventionStatus.COMPLETED); return null; })
                .when(em).refresh(mission,LockModeType.PESSIMISTIC_WRITE);
        var service=new InterventionPaymentCoordination(em,mock(PaymentTransactionRepository.class),
                mock(com.clenzy.repository.ServiceQuoteRepository.class),mock(CurrencyConverterService.class));
        assertThatCode(() -> service.lockPaymentMissions(7L,request(source,1L,
                source.equals("INTERVENTION_BATCH")?Map.of("interventionIds","1"):Map.of())))
                .doesNotThrowAnyException();
        assertThat(mission.getStatus()).isEqualTo(com.clenzy.model.InterventionStatus.COMPLETED);
    }

    @Test void newlyPaidMissionCannotInitiateAnotherPayment() {
        var em = mock(EntityManager.class);
        var mission = new Intervention(); mission.setId(1L); mission.setOrganizationId(7L);
        when(em.find(Intervention.class, 1L)).thenReturn(mission);
        doAnswer(call -> { mission.setPaymentStatus(com.clenzy.model.PaymentStatus.PAID); return null; })
                .when(em).refresh(mission, LockModeType.PESSIMISTIC_WRITE);
        var quotes = mock(com.clenzy.repository.ServiceQuoteRepository.class);
        var coordination = new InterventionPaymentCoordination(em, mock(PaymentTransactionRepository.class), quotes, mock(CurrencyConverterService.class));
        assertThatThrownBy(() -> coordination.lockPaymentMissions(7L, request("INTERVENTION", 1L, Map.of())))
                .hasMessageContaining("ne peut plus être payée");
        verifyNoInteractions(quotes);
    }

    private PaymentOrchestrationRequest request(String type, Long id, Map<String, String> metadata) {
        return new PaymentOrchestrationRequest(BigDecimal.TEN, "EUR", type, id,
                "Mission", "host@example.test", null, null, null, metadata, "key");
    }

    @Test void batchMembersAreLockedOnceInStableOrderIncludingSource() {
        var em = mock(EntityManager.class);
        var coordination = new InterventionPaymentCoordination(em, mock(PaymentTransactionRepository.class),
                mock(com.clenzy.repository.ServiceQuoteRepository.class), mock(CurrencyConverterService.class));
        var first = new Intervention(); first.setId(1L); first.setOrganizationId(7L);
        var second = new Intervention(); second.setId(2L); second.setOrganizationId(7L);
        first.setEstimatedCost(new BigDecimal("5")); second.setEstimatedCost(new BigDecimal("5"));
        when(em.find(Intervention.class, 1L)).thenReturn(first);
        when(em.find(Intervention.class, 2L)).thenReturn(second);
        coordination.lockPaymentMissions(7L, request("INTERVENTION", 2L, Map.of("interventionIds", "2,1,2")));
        var order = inOrder(em);
        order.verify(em).find(Intervention.class, 1L);
        order.verify(em).find(Intervention.class, 2L);
        order.verify(em).find(Intervention.class, 1L);
        order.verify(em).refresh(first, LockModeType.PESSIMISTIC_WRITE);
        order.verify(em).find(Intervention.class, 2L);
        order.verify(em).refresh(second, LockModeType.PESSIMISTIC_WRITE);
        order.verifyNoMoreInteractions();
    }

    @Test void deferredBatchUsesMembersNotHostOrPropertyId() {
        for (String type : new String[]{DeferredPaymentService.SOURCE_TYPE_HOST, DeferredPaymentService.SOURCE_TYPE_PROPERTY}) {
            assertThat(InterventionPaymentCoordination.missionIds(request(type, 999L,
                    Map.of("intervention_ids", "3, 1,3")))).containsExactly(1L, 3L);
        }
    }

    @Test void malformedBatchesFailBeforeAnyLock() {
        var em = mock(EntityManager.class);
        var coordination = new InterventionPaymentCoordination(em, mock(PaymentTransactionRepository.class),
                mock(com.clenzy.repository.ServiceQuoteRepository.class), mock(CurrencyConverterService.class));
        for (String batch : new String[]{"", "1,", "1,abc", "1,0", "-1", "01", "+1", "9223372036854775808"}) {
            assertThatThrownBy(() -> coordination.lockPaymentMissions(7L,
                    request("INTERVENTION", 1L, Map.of("interventionIds", batch))))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> coordination.lockPaymentMissions(7L,
                request(DeferredPaymentService.SOURCE_TYPE_HOST, 1L, Map.of())))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(em);
    }

    @Test void otherPaymentSourcesDoNotLockMissions() {
        assertThat(InterventionPaymentCoordination.missionIds(request("RESERVATION", 1L,
                Map.of("interventionIds", "2")))).isEmpty();
    }

    @Test void organizationIsCheckedAgainAfterRefresh() {
        var em = mock(EntityManager.class);
        var mission = new Intervention(); mission.setOrganizationId(7L);
        when(em.find(Intervention.class, 1L)).thenReturn(mission);
        doAnswer(call -> { mission.setOrganizationId(8L); return null; })
                .when(em).refresh(mission, LockModeType.PESSIMISTIC_WRITE);
        var coordination = new InterventionPaymentCoordination(em, mock(PaymentTransactionRepository.class),
                mock(com.clenzy.repository.ServiceQuoteRepository.class), mock(CurrencyConverterService.class));
        assertThatThrownBy(() -> coordination.lockMission(7L, 1L)).isInstanceOf(AccessDeniedException.class);
    }
}
