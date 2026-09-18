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

    @Test void depositIsRereadBeforeComputingBalance() {
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
                .hasMessageContaining("montant à payer a changé");
        assertThatThrownBy(() -> coordination.lockPaymentMissions(7L, request("INTERVENTION", 1L, Map.of("purpose", "DEPOSIT"))))
                .hasMessageContaining("aucun montant exigible");
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
