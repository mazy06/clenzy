package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class EInvoicingServiceTest {
    @Test void doesNotSendAnUnconfiguredOrAlreadySubmittedInvoice(){
        var registry=mock(EInvoicingProviderRegistry.class);var store=mock(BaitlyEInvoiceStore.class);var provider=mock(EInvoicingProvider.class);
        var invoice=new Invoice();invoice.setId(8L);invoice.setOrganizationId(2L);var submission=new EInvoiceSubmission();submission.setStatus(EInvoiceStatus.PENDING);
        when(registry.resolve(null)).thenReturn(provider);when(store.prepare(2L,8L,null,provider)).thenReturn(new BaitlyEInvoiceStore.Prepared(invoice,submission,false));
        assertThat(new EInvoicingService(registry,store).process(invoice,null)).isSameAs(submission);verifyNoInteractions(provider);verify(store,never()).finish(any(),any(),any());
    }
    @Test void preparesBeforeNetworkAndPersistsCanonicalAcknowledgement(){
        var registry=mock(EInvoicingProviderRegistry.class);var store=mock(BaitlyEInvoiceStore.class);var provider=mock(EInvoicingProvider.class);
        var invoice=new Invoice();invoice.setId(8L);invoice.setOrganizationId(2L);var submission=new EInvoiceSubmission();submission.setId(4L);
        when(registry.resolve(null)).thenReturn(provider);when(store.prepare(2L,8L,null,provider)).thenReturn(new BaitlyEInvoiceStore.Prepared(invoice,submission,true));
        when(provider.mode()).thenReturn(EInvoicingMode.FACTURX_PDP);var result=EInvoiceResult.reported("ACK-test");when(provider.report(invoice)).thenReturn(result);
        new EInvoicingService(registry,store).process(invoice,null);
        var order=inOrder(store,provider);order.verify(store).prepare(2L,8L,null,provider);order.verify(provider).report(invoice);order.verify(store).finish(2L,4L,result);
    }
    @Test void aLostReplyRemainsPendingInsteadOfReportingSuccess(){
        var registry=mock(EInvoicingProviderRegistry.class);var store=mock(BaitlyEInvoiceStore.class);var provider=mock(EInvoicingProvider.class);
        var invoice=new Invoice();invoice.setId(8L);invoice.setOrganizationId(2L);var submission=new EInvoiceSubmission();submission.setId(4L);
        when(registry.resolve(null)).thenReturn(provider);when(store.prepare(2L,8L,null,provider)).thenReturn(new BaitlyEInvoiceStore.Prepared(invoice,submission,true));
        when(provider.mode()).thenReturn(EInvoicingMode.ZATCA_CLEARANCE);when(provider.clear(invoice)).thenThrow(new IllegalStateException("Timeout"));
        new EInvoicingService(registry,store).process(invoice,null);verify(store).finish(eq(2L),eq(4L),argThat(r->r.status()==EInvoiceStatus.PENDING));
    }
    @Test void knownReceiptUsesReadOnlyReconciliationWithoutSendingAgain(){
        var registry=mock(EInvoicingProviderRegistry.class);var store=mock(BaitlyEInvoiceStore.class);var provider=mock(EInvoicingProvider.class);
        var invoice=new Invoice();invoice.setId(8L);invoice.setOrganizationId(2L);var submission=new EInvoiceSubmission();submission.setId(4L);submission.setExternalRef("IOPOLE-TEST");
        when(registry.resolve(null)).thenReturn(provider);when(store.prepare(2L,8L,null,provider)).thenReturn(new BaitlyEInvoiceStore.Prepared(invoice,submission,false,true));
        var result=EInvoiceResult.reported("IOPOLE-TEST");when(provider.reconcile(invoice,"IOPOLE-TEST")).thenReturn(result);
        new EInvoicingService(registry,store).process(invoice,null);
        var order=inOrder(store,provider);order.verify(store).prepare(2L,8L,null,provider);order.verify(provider).reconcile(invoice,"IOPOLE-TEST");order.verify(store).finish(2L,4L,result);
        verify(provider,never()).report(any());verify(provider,never()).clear(any());
    }
}
