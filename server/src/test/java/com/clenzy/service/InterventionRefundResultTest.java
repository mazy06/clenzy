package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class InterventionRefundResultTest {
    @Mock StripeGateway gateway;
    @Mock PaymentStatusTransitionService transitions;
    @Mock PaymentLedgerReversalService ledger;
    @Mock NotificationService notifications;
    @InjectMocks StripeRefundService service;
    private Session session;

    @BeforeEach void setup() throws Exception {
        when(transitions.loadRefundableIntervention(1L)).thenReturn(
                new PaymentStatusTransitionService.InterventionRefundContext(1L, "cs_1", "Mission", null, null));
        session = new Session(); session.setPaymentIntent("pi_1");
        when(gateway.retrieveSession("cs_1")).thenReturn(session);
    }

    private Refund refund(String status) {
        var refund = new Refund(); refund.setId("re_1"); refund.setStatus(status); return refund;
    }

    @ParameterizedTest @ValueSource(strings = {"pending", "requires_action", "failed", "canceled"})
    void doesNotDeclareRefundCompletedBeforeProviderConfirmation(String status) throws Exception {
        when(gateway.createRefund(any(), eq("refund-intervention-1"))).thenReturn(refund(status));
        when(gateway.retrieveRefund("re_1")).thenReturn(refund(status));
        assertThatThrownBy(() -> service.refundPayment(1L)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("non confirmé");
        verify(transitions, never()).markInterventionRefunded(any());
        verifyNoInteractions(ledger, notifications);
    }

    @Test void retryReadsCurrentRefundInsteadOfCachedPendingResponse() throws Exception {
        when(gateway.createRefund(any(), eq("refund-intervention-1"))).thenReturn(refund("pending"));
        when(gateway.retrieveRefund("re_1")).thenReturn(refund("succeeded"));
        service.refundPayment(1L);
        verify(transitions).markInterventionRefunded(1L);
        verify(ledger).reverseInterventionPaymentEntries(1L);
        verify(gateway, times(1)).createRefund(any(), eq("refund-intervention-1"));
    }

    @Test void missingRefundResultIsNotSuccess() throws Exception {
        assertThatThrownBy(() -> service.refundPayment(1L)).isInstanceOf(IllegalStateException.class);
        verify(transitions, never()).markInterventionRefunded(any());
        verifyNoInteractions(ledger, notifications);
    }

    @ParameterizedTest @ValueSource(strings = {"intervention_ids", "interventionIds"})
    void individualRefundCannotRefundEntireGroup(String key) throws Exception {
        session.setMetadata(Map.of(key, "1,2"));
        assertThatThrownBy(() -> service.refundPayment(1L)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("groupé");
        verify(gateway, never()).createRefund(any(), any());
        verifyNoInteractions(ledger, notifications);
    }
}
