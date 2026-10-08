package com.clenzy.booking.service;

import com.clenzy.model.PaymentTransaction;
import com.clenzy.payment.*;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.Refund;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BookingCancellationRefundProcessorTest {
    PaymentTransactionRepository payments=mock(PaymentTransactionRepository.class);
    BookingCancellationRefunds refunds=mock(BookingCancellationRefunds.class);
    ManagedStripeRefund stripe=mock(ManagedStripeRefund.class);
    TenantScopedExecutor tenants=mock(TenantScopedExecutor.class);
    BookingCancellationRefundProcessor processor=new BookingCancellationRefundProcessor(payments,refunds,stripe,tenants);
    @BeforeEach void setup() {
        doAnswer(c->{c.<Runnable>getArgument(1).run();return null;}).when(tenants).runAsOrganization(anyLong(),any(Runnable.class));
    }
    PaymentTransaction stored(String ref) {
        var t=new PaymentTransaction(); t.setOrganizationId(7L); t.setTransactionRef(ref); t.setSourceType(BookingCancellationRefunds.SOURCE); return t;
    }
    BookingCancellationRefunds.Decision decision(String ref) {
        return new BookingCancellationRefunds.Decision(new RefundContext(7L,"cs_original","TX-original","EUR",new BigDecimal("100"),ref,null,LocalDateTime.now()),new BigDecimal("50"),false);
    }
    @Test void webhookPayloadCannotDeclareSuccessOrChooseTheOrganization() throws Exception {
        var event=new Refund();event.setId("re_case");event.setStatus("succeeded");event.setAmount(999999L);
        event.setMetadata(Map.of("baitly_refund_ref","BCR-case","organizationId","999"));
        when(payments.findByTransactionRef("BCR-case")).thenReturn(Optional.of(stored("BCR-case")));
        when(refunds.load(7L,"BCR-case")).thenReturn(decision("BCR-case"));
        var pending=new PaymentResult(false,"re_case",null,null,null,"REFUND_PENDING","En attente");
        when(stripe.executeCancellation(any(),eq(new BigDecimal("50")))).thenReturn(pending);
        processor.onWebhook(event);
        verify(tenants).runAsOrganization(eq(7L),any());verify(refunds).apply(7L,"BCR-case",pending);
        var context=org.mockito.ArgumentCaptor.forClass(RefundContext.class);verify(stripe).executeCancellation(context.capture(),any());
        assertThat(context.getValue().providerRefundId()).isEqualTo("re_case");assertThat(context.getValue().orgId()).isEqualTo(7L);
    }
    @Test void unrecordedEventsAreIgnored() {
        var event=new Refund();event.setId("re_unknown");
        processor.onWebhook(event);verifyNoInteractions(refunds,stripe);
    }
    @Test void lateWebhookAfterOwnerPayoutOnlyObservesTheConfirmedRefund() throws Exception {
        var event=new Refund(); event.setId("re_confirmed"); event.setMetadata(Map.of("baitly_refund_ref","BCR-case"));
        when(payments.findByTransactionRef("BCR-case")).thenReturn(Optional.of(stored("BCR-case")));
        var d=decision("BCR-case"); when(refunds.load(7L,"BCR-case"))
                .thenReturn(new BookingCancellationRefunds.Decision(d.context(),d.amount(),true));
        var success=PaymentResult.success("re_confirmed",null,"REFUNDED");
        when(stripe.observeConfirmed(any(),eq(d.amount()))).thenReturn(success);
        processor.onWebhook(event);
        verify(stripe,never()).executeCancellation(any(),any()); verify(refunds).apply(7L,"BCR-case",success);
    }
    @Test void unknownNetworkOutcomeIsRecordedAndDoesNotStopOtherCases() throws Exception {
        when(payments.findPendingBookingCancellationRefunds(any())).thenReturn(List.of(stored("BCR-first"),stored("BCR-second")));
        when(refunds.load(7L,"BCR-first")).thenReturn(decision("BCR-first"));when(refunds.load(7L,"BCR-second")).thenReturn(decision("BCR-second"));
        var success=PaymentResult.success("re_second",null,"REFUNDED");
        when(stripe.executeCancellation(any(),any())).thenThrow(new IllegalStateException("timeout")).thenReturn(success);
        processor.resume();verify(refunds).recordFailure(7L,"BCR-first");verify(refunds).apply(7L,"BCR-second",success);
        verify(refunds,never()).apply(eq(7L),eq("BCR-first"),any());
    }
    @Test void webhookMismatchFailsBeforeCanonicalQuery() {
        var t=stored("BCR-case");t.setProviderTxId("re_stored");
        when(payments.findByTransactionRef("BCR-case")).thenReturn(Optional.of(t));
        var event=new Refund();event.setId("re_other");event.setMetadata(Map.of("baitly_refund_ref","BCR-case"));
        assertThatThrownBy(()->processor.onWebhook(event)).hasMessageContaining("autre remboursement");verifyNoInteractions(stripe,refunds);
    }
}
