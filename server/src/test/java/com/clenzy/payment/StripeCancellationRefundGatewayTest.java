package com.clenzy.payment;

import com.stripe.StripeClient;
import com.stripe.model.Refund;
import com.stripe.param.RefundListParams;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class StripeCancellationRefundGatewayTest {
    Refund refund(String id,String ref,String status) {
        var r=new Refund();r.setId(id);r.setStatus(status);r.setMetadata(ref==null?Map.of():Map.of("baitly_refund_ref",ref));return r;
    }
    @ParameterizedTest @ValueSource(strings={"pending","requires_action","succeeded","unknown"})
    void unrelatedActiveRefundPreventsAutomaticCancellation(String state) throws Exception {
        try(var clients=mockConstruction(StripeClient.class,withSettings().defaultAnswer(RETURNS_DEEP_STUBS),
                (c,context)->when(c.v1().refunds().list(any(RefundListParams.class)).autoPagingIterable())
                        .thenReturn(List.of(refund("re_manual",null,state))))) {
            assertThatThrownBy(()->new StripeGateway("sk_test_fake").findExclusivePaymentRefund("pi_original","BCR-case"))
                    .hasMessageContaining("autre remboursement");
        }
    }
    @Test void duplicateOwnRefundProofIsAmbiguous() throws Exception {
        try(var clients=mockConstruction(StripeClient.class,withSettings().defaultAnswer(RETURNS_DEEP_STUBS),
                (c,context)->when(c.v1().refunds().list(any(RefundListParams.class)).autoPagingIterable())
                        .thenReturn(List.of(refund("re_1","BCR-case","succeeded"),refund("re_2","BCR-case","succeeded"))))) {
            assertThatThrownBy(()->new StripeGateway("sk_test_fake").findExclusivePaymentRefund("pi_original","BCR-case"))
                    .hasMessageContaining("Plusieurs");
        }
    }
    @Test void scansTheIntentHistoryAndKeepsOnlyTheUniqueOwnProof() throws Exception {
        var own=refund("re_case","BCR-case","pending");
        try(var clients=mockConstruction(StripeClient.class,withSettings().defaultAnswer(RETURNS_DEEP_STUBS),
                (c,context)-> {
                    var refunds=c.v1().refunds();
                    when(refunds.list(any(RefundListParams.class)).autoPagingIterable())
                        .thenReturn(List.of(refund("re_failed",null,"failed"),own,refund("re_canceled",null,"canceled")));
                    clearInvocations(refunds);
                })) {
            assertThat(new StripeGateway("sk_test_fake").findExclusivePaymentRefund("pi_original","BCR-case")).isSameAs(own);
            var params=org.mockito.ArgumentCaptor.forClass(RefundListParams.class);
            verify(clients.constructed().getFirst().v1().refunds()).list(params.capture());
            assertThat(params.getValue().getPaymentIntent()).isEqualTo("pi_original");assertThat(params.getValue().getLimit()).isEqualTo(100L);
        }
    }
}
