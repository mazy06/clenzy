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

class InvoiceCheckoutServiceTest {
    final PaymentTransactionRepository payments = mock(PaymentTransactionRepository.class);
    final StripeGateway stripe = mock(StripeGateway.class);
    final InvoicePaymentReconciliationService writer = mock(InvoicePaymentReconciliationService.class);
    final TenantContext tenant = mock(TenantContext.class);
    final TenantScopedExecutor tenants = mock(TenantScopedExecutor.class);
    final InvoiceCheckoutService service = new InvoiceCheckoutService(payments, stripe, writer, tenant, tenants);

    static PaymentTransaction transaction() {
        var tx = new PaymentTransaction(); tx.setId(9L); tx.setOrganizationId(7L);
        tx.setTransactionRef("TX-invoice"); tx.setProviderTxId("cs_invoice"); tx.setSourceId(1L);
        tx.setSourceType("INVOICE"); tx.setProviderType(PaymentProviderType.STRIPE);
        tx.setPaymentType(TransactionType.CHECKOUT); tx.setStatus(TransactionStatus.PROCESSING);
        tx.setAmount(new BigDecimal("80.00")); tx.setCurrency("EUR");
        tx.setMetadata(Map.of("invoiceId", "1")); return tx;
    }
    static Session session() {
        var s = new Session(); s.setId("cs_invoice"); s.setMode("payment");
        s.setAmountTotal(8000L); s.setCurrency("eur"); s.setStatus("complete"); s.setPaymentStatus("paid");
        s.setMetadata(new HashMap<>(Map.of("transactionRef", "TX-invoice", "sourceType", "INVOICE",
                "orgId", "7", "sourceId", "1", "invoiceId", "1"))); return s;
    }
    void connected(PaymentTransaction tx, Session s) throws Exception {
        when(payments.findByProviderTxId("cs_invoice")).thenReturn(Optional.of(tx));
        when(stripe.retrieveSession("cs_invoice")).thenReturn(s);
        when(tenant.getOrganizationId()).thenReturn(7L);
    }

    @Test void canonicalPaidSessionConfirmsInvoice() throws Exception {
        connected(transaction(), session());
        assertThat(service.handleWebhook(session())).isTrue();
        verify(writer).confirm("TX-invoice", "cs_invoice");
    }
    @Test void reservationInvoiceUsesSameCanonicalPath() throws Exception {
        var tx = transaction(); tx.setSourceType("RESERVATION");
        var s = session(); s.getMetadata().put("sourceType", "RESERVATION"); connected(tx, s);
        assertThat(service.handleWebhook(s)).isTrue();
        verify(writer).confirm("TX-invoice", "cs_invoice");
    }
    @Test void forgedSnapshotCannotForceConfirmationOfUnpaidSession() throws Exception {
        var canonical = session(); canonical.setPaymentStatus("unpaid"); connected(transaction(), canonical);
        assertThat(service.handleWebhook(session())).isTrue();
        verifyNoInteractions(writer);
    }
    @Test void expiredUnpaidSessionMayReleaseDebt() throws Exception {
        var canonical = session(); canonical.setPaymentStatus("unpaid"); canonical.setStatus("expired"); connected(transaction(), canonical);
        assertThat(service.handleWebhook(session())).isTrue(); verify(writer).expire("TX-invoice", "cs_invoice");
    }
    @Test void unknownInvoiceSessionRequestsRedeliveryInsteadOfFallingThrough() {
        assertThatThrownBy(() -> service.handleWebhook(session())).hasMessageContaining("pas encore rattachée");
        verifyNoInteractions(stripe, writer);
    }
    @Test void ordinaryReservationIsLeftToItsExistingHandler() {
        var tx = transaction(); tx.setSourceType("RESERVATION"); tx.setMetadata(Map.of());
        when(payments.findByProviderTxId("cs_invoice")).thenReturn(Optional.of(tx));
        var s = session(); s.setMetadata(Map.of("sourceType", "RESERVATION"));
        assertThat(service.handleWebhook(s)).isFalse(); verifyNoInteractions(stripe, writer);
    }
    @Test void webhookScopesUsingDatabaseOrganization() throws Exception {
        connected(transaction(), session()); when(tenant.getOrganizationId()).thenReturn(null);
        when(tenants.callAsOrganization(eq(7L), any())).thenAnswer(c -> ((java.util.function.Supplier<?>) c.getArgument(1)).get());
        assertThat(service.handleWebhook(session())).isTrue(); verify(writer).confirm("TX-invoice", "cs_invoice");
    }
    @Test void foreignTenantCannotReconcile() throws Exception {
        connected(transaction(), session()); when(tenant.getOrganizationId()).thenReturn(8L);
        assertThatThrownBy(() -> service.handleWebhook(session())).hasMessageContaining("hors organisation");
        verifyNoInteractions(writer);
    }
    @ParameterizedTest @ValueSource(strings={"amount", "currency", "session", "mode", "orgId", "transactionRef", "sourceType", "sourceId", "invoiceId"})
    void mismatchedProofNeverConfirms(String field) throws Exception {
        var canonical = session();
        switch(field) {
            case "amount" -> canonical.setAmountTotal(8001L);
            case "currency" -> canonical.setCurrency("sar");
            case "session" -> canonical.setId("cs_other");
            case "mode" -> canonical.setMode("subscription");
            default -> canonical.getMetadata().put(field, "other");
        }
        connected(transaction(), canonical);
        assertThatThrownBy(() -> service.handleWebhook(session())).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(writer);
    }
    @Test void stripeFailureLeavesAttemptForReconciliation() throws Exception {
        connected(transaction(), session());
        when(stripe.retrieveSession("cs_invoice")).thenThrow(new com.stripe.exception.ApiException("offline", null, null, 503, null));
        assertThatThrownBy(() -> service.handleWebhook(session())).hasMessageContaining("indisponible");
        verifyNoInteractions(writer);
    }
}
