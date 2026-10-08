package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.checkout.Session;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyInvoicePaymentRecoveryTest {
    final BaitlyInvoicePaymentMatching matching=mock(BaitlyInvoicePaymentMatching.class);
    final StripeGateway stripe=mock(StripeGateway.class);
    final TenantScopedExecutor tenants=mock(TenantScopedExecutor.class);
    final BaitlyInvoicePaymentRecovery service=new BaitlyInvoicePaymentRecovery(matching,stripe,tenants);
    BaitlyInvoicePaymentMatching.Evidence proof() { return new BaitlyInvoicePaymentMatching.Evidence(13L,7L,"TX-batch","cs_batch",
            "INTERVENTION_BATCH",304L,new BigDecimal("90"),"EUR","304,320",320L,null,new BigDecimal("55"),LocalDateTime.of(2026,10,5,14,17)); }
    Session session() {
        var s=new Session(); s.setId("cs_batch"); s.setMode("payment"); s.setStatus("complete"); s.setPaymentStatus("paid");
        s.setCurrency("eur"); s.setAmountTotal(9000L); s.setPaymentIntent("pi_batch");
        s.setMetadata(new HashMap<>(Map.of("transactionRef","TX-batch","sourceType","INTERVENTION_BATCH","sourceId","304","orgId","7","interventionIds","304,320"))); return s;
    }
    @Test void canonicalReadHappensBetweenDatabasePhasesWithoutCreatingAPayment() throws Exception {
        var p=proof(); when(matching.prepare(13L)).thenReturn(p); when(stripe.retrieveSession("cs_batch")).thenReturn(session());
        service.reconcile(13L);
        var order=inOrder(matching,stripe); order.verify(matching).prepare(13L); order.verify(stripe).retrieveSession("cs_batch"); order.verify(matching).apply(p);
        verifyNoMoreInteractions(matching,stripe);
    }
    @ParameterizedTest @ValueSource(strings={"unpaid","processing","mode","amount","currency","session","intent","ref","source","source-id","org","parts","no-metadata"})
    void nonCanonicalProofNeverMarksInvoicePaid(String defect) throws Exception {
        var s=session(); switch(defect) {
            case "unpaid" -> s.setPaymentStatus("unpaid"); case "processing" -> s.setStatus("open"); case "mode" -> s.setMode("subscription");
            case "amount" -> s.setAmountTotal(5500L); case "currency" -> s.setCurrency("usd"); case "session" -> s.setId("cs_other");
            case "intent" -> s.setPaymentIntent((String)null); case "ref" -> s.getMetadata().put("transactionRef","other");
            case "source" -> s.getMetadata().put("sourceType","RESERVATION"); case "source-id" -> s.getMetadata().put("sourceId","320");
            case "org" -> s.getMetadata().put("orgId","8"); case "parts" -> s.getMetadata().put("interventionIds","320");
            case "no-metadata" -> s.setMetadata(null);
        }
        when(matching.prepare(13L)).thenReturn(proof()); when(stripe.retrieveSession("cs_batch")).thenReturn(s);
        assertThatThrownBy(() -> service.reconcile(13L)).isInstanceOf(IllegalStateException.class);
        verify(matching,never()).apply(any());
    }
    @Test void failedCandidateIsRecordedAndDoesNotStarveLaterInvoices() throws Exception {
        var first=new BaitlyInvoicePaymentMatching.Candidate(13L,7L); var next=new BaitlyInvoicePaymentMatching.Candidate(14L,8L);
        when(matching.candidates(0)).thenReturn(List.of(first,next)); when(matching.candidates(14)).thenReturn(List.of());
        doAnswer(c -> { c.<Runnable>getArgument(1).run(); return null; }).when(tenants).runAsOrganization(anyLong(),any());
        when(matching.prepare(13L)).thenThrow(new IllegalStateException("ambiguous"));
        when(matching.prepare(14L)).thenReturn(proof()); when(stripe.retrieveSession("cs_batch")).thenReturn(session());
        service.resume(); service.resume();
        verify(matching).recordFailure(13L); verify(matching).apply(proof());
        verify(tenants).runAsOrganization(eq(7L),any()); verify(tenants).runAsOrganization(eq(8L),any());
        verify(matching).candidates(14);
    }
}
