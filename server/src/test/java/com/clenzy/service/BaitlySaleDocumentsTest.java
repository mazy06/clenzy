package com.clenzy.service;

import com.clenzy.payment.StripeGateway;
import com.clenzy.tenant.TenantScopedExecutor;
import com.stripe.model.*;
import org.junit.jupiter.api.*;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlySaleDocumentsTest {
    StripeGateway stripe;BaitlySaleDocumentStore store;BaitlySaleDocuments service;
    Invoice invoice;Refund refund;BaitlySaleDocumentStore.Claim claim;
    @BeforeEach void setup()throws Exception {
        stripe=mock(StripeGateway.class);store=mock(BaitlySaleDocumentStore.class);service=new BaitlySaleDocuments(store,stripe,mock(TenantScopedExecutor.class));
        claim=new BaitlySaleDocumentStore.Claim(8L,2L,UUID.randomUUID(),"SUBSCRIPTION",5L,"in_test","re_test",null,"in_test","sub_test","cus_test","FR","acct_fr","EUR",1200,Instant.now());
        invoice=new Invoice();invoice.setId("in_test");invoice.setStatus("paid");invoice.setCurrency("eur");invoice.setTotal(1200L);invoice.setTotalExcludingTax(1000L);invoice.setAmountPaid(1200L);invoice.setCustomer("cus_test");
        invoice.setAccountCountry("FR");invoice.setAccountName("Vendeur test");invoice.setNumber("FR-001");invoice.setCustomerName("Acheteur test");invoice.setInvoicePdf("https://pay.stripe.com/invoice/pdf");
        var address=new Address();address.setCountry("FR");invoice.setCustomerAddress(address);
        var dates=new Invoice.StatusTransitions();dates.setFinalizedAt(100L);invoice.setStatusTransitions(dates);
        var tax=new Invoice.AutomaticTax();tax.setEnabled(true);tax.setStatus("complete");invoice.setAutomaticTax(tax);
        var parent=new Invoice.Parent();var details=new Invoice.Parent.SubscriptionDetails();details.setSubscription("sub_test");parent.setSubscriptionDetails(details);invoice.setParent(parent);
        when(stripe.retrieveInvoice("in_test")).thenReturn(invoice);
        var payment=new InvoicePayment();payment.setStatus("paid");payment.setInvoice("in_test");payment.setAmountPaid(1200L);payment.setCurrency("eur");
        var paid=new InvoicePayment.Payment();paid.setCharge("ch_test");payment.setPayment(paid);when(stripe.invoicePayments("in_test",null)).thenReturn(List.of(payment));
        var charge=new Charge();charge.setId("ch_test");charge.setAmount(1200L);charge.setAmountCaptured(1200L);charge.setCaptured(true);charge.setPaid(true);charge.setCustomer("cus_test");charge.setCurrency("eur");when(stripe.retrieveCharge("ch_test")).thenReturn(charge);
        refund=new Refund();refund.setId("re_test");refund.setAmount(300L);refund.setCharge("ch_test");refund.setCurrency("eur");refund.setStatus("succeeded");
        when(store.refundId(claim)).thenReturn("re_test");when(stripe.retrieveRefund("re_test")).thenReturn(refund);when(store.emitting(claim)).thenReturn(Instant.now());
        when(stripe.creditNotes("in_test")).thenReturn(List.of());when(stripe.createLinkedCreditNote(any(),anyString())).thenReturn(note());
    }
    CreditNote note(){var n=new CreditNote();n.setId("cn_test");n.setInvoice("in_test");n.setCurrency("eur");n.setStatus("issued");n.setCustomer("cus_test");n.setAmount(300L);n.setTotalExcludingTax(250L);n.setNumber("FR-C001");n.setCreated(110L);n.setPdf("https://pay.stripe.com/credit_note/pdf");var r=new CreditNote.Refund();r.setRefund("re_test");r.setAmountRefunded(300L);n.setRefunds(List.of(r));return n;}
    @Test void linksExistingRefundWithoutMovingMoneyOrSendingEmail()throws Exception {
        service.reconcile(claim);
        var params=org.mockito.ArgumentCaptor.forClass(com.stripe.param.CreditNoteCreateParams.class);verify(stripe).createLinkedCreditNote(params.capture(),eq("baitly-sale-credit-2-8"));
        assertThat(params.getValue().getRefundAmount()).isNull();assertThat(params.getValue().getEmailType()).isEqualTo(com.stripe.param.CreditNoteCreateParams.EmailType.NONE);
        assertThat(params.getValue().getRefunds()).singleElement().satisfies(r->assertThat(r.getRefund()).isEqualTo("re_test"));
        verify(store).complete(eq(claim),argThat(p->p.total()==300 && p.net()==250 && p.snapshot().get("refund").equals("re_test")));
    }
    @Test void lostResponseFindsTheExistingCreditNoteWithoutReissuing()throws Exception {
        when(stripe.creditNotes("in_test")).thenReturn(List.of(note()));service.reconcile(claim);
        verify(stripe,never()).createLinkedCreditNote(any(),anyString());verify(store,never()).emitting(any());verify(store).complete(eq(claim),any());
    }
    @Test void expiredIdempotencyWindowRequiresReconciliation()throws Exception {
        when(store.emitting(claim)).thenReturn(Instant.now().minusSeconds(86400));
        assertThatThrownBy(()->service.reconcile(claim)).hasMessageContaining("ISSUANCE_UNCERTAIN");verify(stripe,never()).createLinkedCreditNote(any(),anyString());
    }
    @Test void unrelatedRefundNeverProducesAnInvoiceAdjustment()throws Exception {
        refund.setCharge("ch_other");assertThatThrownBy(()->service.reconcile(claim)).hasMessageContaining("REFUND_MISMATCH");verify(stripe,never()).createLinkedCreditNote(any(),anyString());
    }
    @Test void missingTaxOrWrongSellerBlocksTheDocument()throws Exception {
        invoice.getAutomaticTax().setStatus("requires_location_inputs");assertThatThrownBy(()->service.reconcile(claim)).hasMessageContaining("INVOICE_MISMATCH");
        invoice.getAutomaticTax().setStatus("complete");invoice.setAccountCountry("MA");assertThatThrownBy(()->service.reconcile(claim)).hasMessageContaining("INVOICE_MISMATCH");verify(store,never()).complete(any(),any());
    }
    @Test void aPartialOrVoidedExternalCreditNoteMustNotBeDuplicated()throws Exception {
        var n=note();n.setStatus("void");when(stripe.creditNotes("in_test")).thenReturn(List.of(n));
        assertThatThrownBy(()->service.reconcile(claim)).hasMessageContaining("CREDIT_NOTE_MISMATCH");verify(stripe,never()).createLinkedCreditNote(any(),anyString());
    }
    @Test void untrustedPdfLinkIsNotStored()throws Exception {
        var n=note();n.setPdf("https://stripe.com.attacker.test/file");when(stripe.creditNotes("in_test")).thenReturn(List.of(n));assertThatThrownBy(()->service.reconcile(claim)).hasMessageContaining("Lien");verify(store,never()).complete(any(),any());
    }
}
