package com.clenzy.service;

import com.clenzy.dto.*;
import com.clenzy.model.*;
import com.clenzy.payment.PaymentResult;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InvoicePaymentServiceTest {
    final PaymentOrchestrationService orchestration = mock(PaymentOrchestrationService.class);
    final InvoicePaymentCoordination coordination = mock(InvoicePaymentCoordination.class);
    final InvoicePaymentService service = new InvoicePaymentService(orchestration, coordination);

    @Test void successfulOrResumedSessionBindsInvoiceWithoutMarkingItPaid() {
        var request = mock(PaymentOrchestrationRequest.class);
        when(coordination.prepare(5L, "ok", "ko")).thenReturn(request);
        var tx = new PaymentTransaction(); tx.setId(99L);
        var result = new PaymentOrchestrationResult(tx, PaymentResult.success("cs_test", "https://pay"), PaymentProviderType.STRIPE);
        when(orchestration.initiatePayment(request)).thenReturn(result);
        assertThat(service.payInvoice(5L, null, "ok", "ko")).isSameAs(result);
        var order = inOrder(coordination, orchestration);
        order.verify(coordination).prepare(5L, "ok", "ko");
        order.verify(orchestration).initiatePayment(request);
        order.verify(coordination).bindExisting(5L, 99L);
        verifyNoMoreInteractions(coordination);
    }

    @Test void rejectedAttemptDoesNotRebindInvoice() {
        var request = mock(PaymentOrchestrationRequest.class);
        when(coordination.prepare(5L, null, null)).thenReturn(request);
        var result = new PaymentOrchestrationResult(null, PaymentResult.failure("indisponible"), PaymentProviderType.STRIPE);
        when(orchestration.initiatePayment(request)).thenReturn(result);
        assertThat(service.payInvoice(5L, PaymentProviderType.STRIPE, null, null).isSuccess()).isFalse();
        verify(coordination, never()).bindExisting(any(), any());
    }

    @Test void noManualPaidDeclaration() {
        assertThatThrownBy(() -> service.markAsPaid(5L)).hasMessageContaining("confirmé par le PSP");
        verifyNoInteractions(orchestration, coordination);
    }

    @Test void validationFailureNeverCallsProvider() {
        when(coordination.prepare(5L, null, null)).thenThrow(new IllegalStateException("Facture déjà réglée"));
        assertThatThrownBy(() -> service.payInvoice(5L, null, null, null)).hasMessageContaining("déjà réglée");
        verifyNoInteractions(orchestration);
    }
}
