package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.payment.StripeGateway;
import com.clenzy.repository.PaymentTransactionRepository;
import com.clenzy.tenant.*;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InterventionBatchCheckoutServiceTest {
    final PaymentTransactionRepository payments = mock(PaymentTransactionRepository.class);
    final StripeGateway stripe = mock(StripeGateway.class);
    final InterventionBatchReconciliationService writer = mock(InterventionBatchReconciliationService.class);
    final TenantContext tenant = mock(TenantContext.class);
    final TenantScopedExecutor tenants = mock(TenantScopedExecutor.class);
    final InterventionBatchCheckoutService service = new InterventionBatchCheckoutService(payments, stripe, writer, tenant, tenants);

    static PaymentTransaction batch() {
        var tx = new PaymentTransaction(); tx.setId(9L); tx.setOrganizationId(7L);
        tx.setTransactionRef("TX-batch"); tx.setProviderTxId("cs_batch"); tx.setSourceId(1L);
        tx.setSourceType(InterventionPaymentBatch.SOURCE_TYPE); tx.setProviderType(PaymentProviderType.STRIPE);
        tx.setPaymentType(TransactionType.CHECKOUT); tx.setStatus(TransactionStatus.PROCESSING);
        tx.setAmount(new BigDecimal("80.00")); tx.setCurrency("EUR");
        tx.setMetadata(Map.of("interventionIds", "1,2", "purpose", "FULL")); return tx;
    }
    static Session session() {
        var session = new Session(); session.setId("cs_batch"); session.setMode("payment");
        session.setAmountTotal(8000L); session.setCurrency("eur"); session.setStatus("complete"); session.setPaymentStatus("paid");
        session.setMetadata(new HashMap<>(Map.of("transactionRef", "TX-batch", "sourceType", InterventionPaymentBatch.SOURCE_TYPE,
                "orgId", "7", "interventionIds", "1,2"))); return session;
    }
    void connected(PaymentTransaction tx, Session session) throws Exception {
        when(payments.findByProviderTxId("cs_batch")).thenReturn(Optional.of(tx));
        when(stripe.retrieveSession("cs_batch")).thenReturn(session);
        when(tenant.getOrganizationId()).thenReturn(7L);
    }

    @Test void authenticatedReturnAndRepeatedWebhookUseTheSameVerifiedBatch() throws Exception {
        connected(batch(), session());
        assertThat(service.sessionStatus("cs_batch", 7L).orElseThrow()).containsEntry("paymentStatus", "PAID");
        assertThat(service.handleWebhook(session())).isTrue();
        verify(writer, times(2)).confirm("TX-batch", "cs_batch");
    }
    @Test void webhookSnapshotCannotForcePaidWhenCanonicalSessionIsUnpaid() throws Exception {
        var canonical = session(); canonical.setPaymentStatus("unpaid"); connected(batch(), canonical);
        assertThat(service.handleWebhook(session())).isTrue();
        verifyNoInteractions(writer);
    }
    @Test void expiredUnpaidSessionUnlocksRetryOnlyAfterVerifiedExpiry() throws Exception {
        var canonical = session(); canonical.setPaymentStatus("unpaid"); canonical.setStatus("expired"); connected(batch(), canonical);
        assertThat(service.sessionStatus("cs_batch", 7L).orElseThrow()).containsEntry("paymentStatus", "FAILED");
        verify(writer).expire("TX-batch", "cs_batch");
    }
    @Test void absentDatabaseBindingRequestsStripeRedelivery() {
        assertThatThrownBy(() -> service.handleWebhook(session())).hasMessageContaining("pas encore rattachée");
        verifyNoInteractions(stripe, writer);
    }
    @Test void foreignOrganizationCannotPollOrReconcile() throws Exception {
        when(payments.findByProviderTxId("cs_batch")).thenReturn(Optional.of(batch()));
        assertThat(service.sessionStatus("cs_batch", 8L)).isEmpty();
        verifyNoInteractions(stripe, writer);
        when(stripe.retrieveSession("cs_batch")).thenReturn(session());
        when(tenant.getOrganizationId()).thenReturn(8L);
        assertThatThrownBy(() -> service.handleWebhook(session())).hasMessageContaining("hors organisation");
        verifyNoInteractions(writer);
    }
    @Test void webhookScopesUsingDatabaseOrganization() throws Exception {
        connected(batch(), session()); when(tenant.getOrganizationId()).thenReturn(null);
        when(tenants.callAsOrganization(eq(7L), any())).thenAnswer(call -> ((java.util.function.Supplier<?>)call.getArgument(1)).get());
        assertThat(service.handleWebhook(session())).isTrue();
        verify(tenants).callAsOrganization(eq(7L), any()); verify(writer).confirm("TX-batch", "cs_batch");
    }
    @ParameterizedTest @ValueSource(strings={"amount", "currency", "session", "mode", "orgId", "transactionRef", "sourceType", "interventionIds"})
    void mismatchNeverConfirms(String field) throws Exception {
        var canonical = session();
        switch(field) {
            case "amount" -> canonical.setAmountTotal(8001L);
            case "currency" -> canonical.setCurrency("sar");
            case "session" -> canonical.setId("cs_other");
            case "mode" -> canonical.setMode("subscription");
            default -> canonical.getMetadata().put(field, "other");
        }
        connected(batch(), canonical);
        assertThatThrownBy(() -> service.handleWebhook(session())).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(writer);
    }
    @Test void stripeReadFailureDoesNotConvertIntoPaymentFailure() throws Exception {
        connected(batch(), session());
        when(stripe.retrieveSession("cs_batch")).thenThrow(new com.stripe.exception.ApiException("offline", null, null, 503, null));
        assertThatThrownBy(() -> service.sessionStatus("cs_batch", 7L)).hasMessageContaining("indisponible");
        verifyNoInteractions(writer);
    }
}
