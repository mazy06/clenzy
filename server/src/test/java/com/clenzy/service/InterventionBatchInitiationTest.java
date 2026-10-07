package com.clenzy.service;

import com.clenzy.dto.*;
import com.clenzy.model.*;
import com.clenzy.payment.PaymentResult;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InterventionBatchInitiationTest {
    final InterventionRepository missions=mock(InterventionRepository.class);
    final PaymentOrchestrationService orchestration=mock(PaymentOrchestrationService.class);
    final ServiceQuoteRepository quotes=mock(ServiceQuoteRepository.class);
    final StripeService stripe=mock(StripeService.class);
    final BaitlyBatchRefundPersistence refunds=mock(BaitlyBatchRefundPersistence.class);
    final ManagedRefundReconciliation reconciliation=mock(ManagedRefundReconciliation.class);
    final TenantContext tenant=mock(TenantContext.class);
    final InterventionPaymentService service=new InterventionPaymentService(missions,orchestration,stripe,
            mock(PaymentTransactionService.class),tenant,mock(com.clenzy.service.access.OrganizationAccessGuard.class),quotes,refunds,reconciliation);
    Intervention mission(long id,String amount) {
        var mission=new Intervention(); mission.setId(id); mission.setOrganizationId(7L); mission.setCurrency("EUR");
        mission.setEstimatedCost(new BigDecimal(amount)); mission.setStatus(InterventionStatus.PENDING); mission.setPaymentStatus(PaymentStatus.PENDING);
        when(missions.findById(id)).thenReturn(Optional.of(mission)); return mission;
    }
    @Test void batchUsesServerBalancesAndStableIdsWithoutSavingDetachedMissions() {
        var first=mission(1,"40"); mission(2,"50");
        var quote=new ServiceQuote(); quote.setStatus(ServiceQuote.Status.APPROVED); quote.setDepositAmount(BigDecimal.TEN);
        quote.setDepositPaidAt(java.time.LocalDateTime.now()); quote.setDepositTransactionRef("DEP-TEST");
        when(quotes.findByInterventionIdAndOrganizationIdOrderByAmountAsc(1L,7L)).thenReturn(List.of(quote));
        when(orchestration.initiatePayment(any())).thenReturn(new PaymentOrchestrationResult(null,PaymentResult.success("cs_batch","https://checkout.stripe.com/test"),PaymentProviderType.STRIPE));
        var result=service.createBatchPaymentSession(new BatchPaymentSessionRequest(List.of(2L,1L,2L),new BigDecimal("80"),null),"host@example.test");
        var captor=org.mockito.ArgumentCaptor.forClass(PaymentOrchestrationRequest.class);
        verify(orchestration).initiatePayment(captor.capture());
        var request=captor.getValue();
        assertThat(request.amount()).isEqualByComparingTo("80");
        assertThat(request.sourceType()).isEqualTo("INTERVENTION_BATCH");
        assertThat(request.preferredProvider()).isEqualTo(PaymentProviderType.STRIPE);
        assertThat(request.metadata()).containsEntry("interventionIds","1,2");
        assertThat(request.idempotencyKey()).isEqualTo("INT-BATCH-1-2");
        assertThat(result.getSessionId()).isEqualTo("cs_batch");
        assertThat(first.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING);
        verify(missions,never()).save(any()); verify(missions,never()).saveAll(any());
    }
    @Test void mixedCurrenciesFailBeforeCheckout() {
        mission(1,"30"); mission(2,"50").setCurrency("SAR");
        assertThatThrownBy(()->service.createBatchPaymentSession(new BatchPaymentSessionRequest(List.of(1L,2L),null,null),"host@example.test")).hasMessageContaining("devise");
        verifyNoInteractions(orchestration);
    }
    @Test void allocatedMissionUsesItsDurableDecisionWithoutWholeSessionRefund() throws Exception {
        mission(1,"30").setPaymentStatus(PaymentStatus.PAID);
        when(missions.hasAllocatedPayment(eq(7L),eq(1L),any())).thenReturn(true);
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        when(refunds.prepare(7L,1L)).thenReturn("REF-part");
        var pending=new PaymentTransaction(); pending.setStatus(TransactionStatus.PROCESSING);
        when(reconciliation.resumeAllocation("REF-part",7L)).thenReturn(pending);
        assertThat(service.refundIntervention(1L)).containsEntry("status","PROCESSING");
        verifyNoInteractions(stripe,orchestration);
    }
}
