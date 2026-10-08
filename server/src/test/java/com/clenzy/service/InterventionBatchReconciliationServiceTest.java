package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InterventionBatchReconciliationServiceTest {
    final PaymentTransactionRepository payments = mock(PaymentTransactionRepository.class);
    final InterventionPaymentAllocationRepository allocations = mock(InterventionPaymentAllocationRepository.class);
    final PaymentPersistence persistence = mock(PaymentPersistence.class);
    final StripePaymentConfirmationService confirmation = mock(StripePaymentConfirmationService.class);
    final TenantContext tenant = mock(TenantContext.class);
    final EntityManager em = mock(EntityManager.class);
    final InterventionBatchReconciliationService service = new InterventionBatchReconciliationService(payments, allocations, persistence, confirmation, tenant, em, mock(InvoicePaymentCoordination.class));
    final PaymentTransaction tx = InterventionBatchCheckoutServiceTest.batch();
    final List<InterventionPaymentAllocation> parts = List.of(new InterventionPaymentAllocation(tx, 1L, new BigDecimal("30")),
            new InterventionPaymentAllocation(tx, 2L, new BigDecimal("50")));
    InterventionBatchReconciliationServiceTest() {
        when(payments.findByTransactionRef("TX-batch")).thenReturn(Optional.of(tx));
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        when(allocations.findForTransaction(7L, "TX-batch")).thenReturn(parts);
    }
    @Test void completionLocksRootAndConfirmsExactAllocationsAfterCas() {
        service.confirm("TX-batch", "cs_batch");
        var order = inOrder(em, persistence, allocations, confirmation);
        order.verify(em).refresh(tx, LockModeType.PESSIMISTIC_WRITE);
        order.verify(persistence).completeTransaction("TX-batch");
        order.verify(allocations).findForTransaction(7L, "TX-batch");
        order.verify(confirmation).confirmAllocatedPayment(tx, parts);
    }
    @Test void kafkaCannotCompleteUnpaidTransaction() {
        service.reconcile("TX-batch"); verifyNoInteractions(persistence, confirmation);
        tx.setStatus(TransactionStatus.COMPLETED); service.reconcile("TX-batch");
        verify(confirmation).confirmAllocatedPayment(tx, parts);
    }
    @Test void incompleteAllocationRejectsWholeBatch() {
        when(allocations.findForTransaction(7L,"TX-batch")).thenReturn(List.of(parts.getFirst()));
        assertThatThrownBy(() -> service.confirm("TX-batch","cs_batch")).hasMessageContaining("incomplète");
        verifyNoInteractions(confirmation);
    }
    @Test void expiryCannotDowngradeCompletedPayment() {
        tx.setStatus(TransactionStatus.COMPLETED); service.expire("TX-batch","cs_batch");
        verifyNoInteractions(persistence, confirmation);
    }
    @Test void verifiedExpiryRecordsRetryAuthorization() {
        service.expire("TX-batch","cs_batch");
        verify(confirmation).markGroupedPaymentAsFailed("cs_batch","1,2");
        verify(persistence).failTransaction(eq("TX-batch"), anyString());
        assertThat(tx.getMetadata()).containsEntry("batchRetryAllowed",true);
    }
    @Test void foreignTenantCannotWrite() {
        when(tenant.getRequiredOrganizationId()).thenReturn(8L);
        assertThatThrownBy(() -> service.confirm("TX-batch","cs_batch")).hasMessageContaining("inaccessible");
        verifyNoInteractions(confirmation, persistence);
    }
    @ParameterizedTest @ValueSource(strings={"missing", "duplicate", "currency", "amount", "foreign", "membership"})
    void malformedAllocationsAreRejected(String problem) {
        var list = new ArrayList<>(parts);
        switch(problem) {
            case "missing" -> list.removeLast();
            case "duplicate" -> list.add(parts.getFirst());
            case "currency" -> tx.setCurrency("SAR");
            case "amount" -> tx.setAmount(new BigDecimal("81"));
            case "foreign" -> tx.setOrganizationId(8L);
            case "membership" -> tx.setMetadata(Map.of("interventionIds","1,3"));
        }
        assertThatThrownBy(() -> InterventionPaymentBatch.validate(tx,list)).isInstanceOf(IllegalStateException.class);
    }
}
