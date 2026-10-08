package com.clenzy.service;

import com.clenzy.dto.*;
import com.clenzy.model.*;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ServiceQuoteRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

/** Les deux présentations de paiement respectent le même accord Baitly. */
@ExtendWith(MockitoExtension.class)
class InterventionPaymentAgreementTest {
    @Mock InterventionRepository interventions;
    @Mock ServiceQuoteRepository quotes;
    @Mock PaymentOrchestrationService orchestration;
    @Mock TenantContext tenant;
    InterventionPaymentService service;
    Intervention mission;
    ServiceQuote quote;

    @BeforeEach
    void setUp() {
        service = new InterventionPaymentService(interventions, orchestration,
                mock(StripeService.class), mock(PaymentTransactionService.class), tenant,
                new OrganizationAccessGuard(tenant), quotes, mock(BaitlyBatchRefundPersistence.class), mock(ManagedRefundReconciliation.class));
        mission = new Intervention();
        mission.setId(1L);
        mission.setOrganizationId(7L);
        mission.setStatus(InterventionStatus.AWAITING_PAYMENT);
        mission.setPaymentStatus(PaymentStatus.PENDING);
        mission.setEstimatedCost(new BigDecimal("200"));
        mission.setCurrency("MAD");
        quote = new ServiceQuote();
        quote.setStatus(ServiceQuote.Status.APPROVED);
        quote.setDepositAmount(new BigDecimal("40"));
        when(tenant.getOrganizationId()).thenReturn(7L);
        when(interventions.findById(1L)).thenReturn(Optional.of(mission));
        when(quotes.findByInterventionIdAndOrganizationIdOrderByAmountAsc(1L, 7L))
                .thenReturn(List.of(quote));
    }

    private void pay(boolean embedded, String purpose, String amount) {
        var request = new PaymentSessionRequest();
        request.setInterventionId(1L);
        request.setPurpose(purpose);
        request.setAmount(new BigDecimal(amount));
        if (embedded) service.createEmbeddedPaymentSession(request, "host@example.test");
        else service.createPaymentSession(request, "host@example.test");
    }

    private PaymentOrchestrationRequest sent() {
        var capture = ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
        verify(orchestration).initiatePayment(capture.capture());
        return capture.getValue();
    }

    private void successfulPayment() {
        when(orchestration.initiatePayment(any())).thenReturn(new PaymentOrchestrationResult(
                null, PaymentResult.embedded("session", "secret"), PaymentProviderType.STRIPE));
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void depositUsesApprovedAmountAndDoesNotMarkFullPaymentProcessing(boolean embedded) {
        successfulPayment();
        pay(embedded, "DEPOSIT", "40");
        var request = sent();
        assertThat(request.amount()).isEqualByComparingTo("40");
        assertThat(request.currency()).isEqualTo("MAD");
        assertThat(request.metadata()).containsEntry("purpose", "DEPOSIT");
        assertThat(request.idempotencyKey()).startsWith("INT-1-DEPOSIT-");
        assertThat(mission.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void balanceDeductsPaidDeposit(boolean embedded) {
        quote.setDepositPaidAt(LocalDateTime.now()); quote.setDepositTransactionRef("DEP-TEST");
        successfulPayment();
        pay(embedded, "FULL", "160");
        assertThat(sent().amount()).isEqualByComparingTo("160");
        assertThat(mission.getPaymentStatus()).isEqualTo(PaymentStatus.PROCESSING);
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void deliveredMissionCanPayItsBalanceWithoutReopeningTheWork(boolean embedded) {
        mission.setStatus(InterventionStatus.COMPLETED);
        mission.setCompletedAt(LocalDateTime.of(2026,10,6,12,0));
        quote.setDepositPaidAt(LocalDateTime.now()); quote.setDepositTransactionRef("DEP-TEST");
        successfulPayment();
        pay(embedded,"FULL","160");
        assertThat(sent().amount()).isEqualByComparingTo("160");
        assertThat(mission.getStatus()).isEqualTo(InterventionStatus.COMPLETED);
        assertThat(mission.getCompletedAt()).isEqualTo(LocalDateTime.of(2026,10,6,12,0));
    }

    @org.junit.jupiter.api.Test
    void deliveredMissionIsAlsoPayableInABatch() {
        mission.setStatus(InterventionStatus.COMPLETED);
        successfulPayment();
        service.createBatchPaymentSession(new BatchPaymentSessionRequest(List.of(1L),new BigDecimal("200"),
                "http://localhost:3000/billing?tab=payments"),"sandbox@example.invalid");
        assertThat(sent().sourceType()).isEqualTo("INTERVENTION_BATCH");
        assertThat(mission.getStatus()).isEqualTo(InterventionStatus.COMPLETED);
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void unpaidDepositDoesNotReduceBalance(boolean embedded) {
        successfulPayment();
        pay(embedded, "FULL", "200");
        assertThat(sent().amount()).isEqualByComparingTo("200");
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void alreadyPaidDepositCannotBeChargedAgain(boolean embedded) {
        quote.setDepositPaidAt(LocalDateTime.now()); quote.setDepositTransactionRef("DEP-TEST");
        assertThatThrownBy(() -> pay(embedded, "DEPOSIT", "40"))
                .isInstanceOf(com.clenzy.exception.PaymentValidationException.class);
        verifyNoInteractions(orchestration);
        verify(interventions, never()).save(any());
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void totalCannotBeChargedAgainAfterDeposit(boolean embedded) {
        quote.setDepositPaidAt(LocalDateTime.now()); quote.setDepositTransactionRef("DEP-TEST");
        assertThatThrownBy(() -> pay(embedded, "FULL", "200"))
                .isInstanceOf(com.clenzy.exception.PaymentValidationException.class);
        verifyNoInteractions(orchestration);
        verify(interventions, never()).save(any());
    }
}
