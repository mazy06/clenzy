package com.clenzy.service;

import com.clenzy.model.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;

class BaitlyDocumentVerificationTest {
    static Invoice invoice(){return com.clenzy.fiscal.einvoicing.francepdp.BaitlyInvoiceCiiTest.invoice();}
    @Test void checksEverySellerFieldAndLineArithmetic(){
        var i=invoice();assertThat(BaitlyInvoiceChecks.issues(i)).isEmpty();
        i.setSellerAddress(" ");i.getLines().getFirst().setTaxAmount(new BigDecimal("50"));
        assertThat(BaitlyInvoiceChecks.issues(i)).extracting(BaitlyInvoiceChecks.Issue::code).contains("SELLER","LINE_TOTAL","TOTAL");
    }
    @Test void b2cAddressAndPartnerTransmissionAreNotFabricatedRequirements(){
        var i=invoice();i.setBuyerTaxId(null);i.setBuyerAddress(null);
        assertThat(BaitlyInvoiceChecks.issues(i)).isEmpty();
        i.setBuyerTaxId("FR123");assertThat(BaitlyInvoiceChecks.issues(i)).extracting(BaitlyInvoiceChecks.Issue::code).contains("BUYER_ADDRESS");
    }
    @Test void cancellationAndCopyHaveDifferentReportingSemantics(){
        var i=invoice();
        for(var state:java.util.List.of(InvoiceStatus.ISSUED,InvoiceStatus.SENT,InvoiceStatus.OVERDUE,InvoiceStatus.PAID,InvoiceStatus.CANCELLED,InvoiceStatus.CREDIT_NOTE)){
            i.setStatus(state);assertThat(FiscalReportingService.isCanonicalFiscalDocument(i)).isTrue();
        }
        i.setDuplicateOfId(1L);assertThat(FiscalReportingService.isCanonicalFiscalDocument(i)).isFalse();
        i.setDuplicateOfId(null);i.setStatus(InvoiceStatus.DRAFT);assertThat(FiscalReportingService.isCanonicalFiscalDocument(i)).isFalse();
    }
    @Test void documentFingerprintIgnoresSettlementButIncludesTermsAndDeadline(){
        var i=invoice();String hash=BaitlyInvoiceChecks.fingerprint(i);i.setStatus(InvoiceStatus.PAID);i.setPaidAt(java.time.LocalDateTime.now());
        assertThat(BaitlyInvoiceChecks.fingerprint(i)).isEqualTo(hash);
        i.setDueDate(i.getDueDate().plusDays(1));assertThat(BaitlyInvoiceChecks.fingerprint(i)).isNotEqualTo(hash);
    }
    @Test void historicalRefundRoundingIsBoundedAndDoesNotRelaxSalesChecks(){
        var i=invoice();var l=i.getLines().getFirst();
        i.setOriginalInvoiceId(50L);i.setRefundTransactionId(60L);i.setStatus(InvoiceStatus.CREDIT_NOTE);
        l.setQuantity(BigDecimal.ONE.negate());l.setUnitPriceHt(new BigDecimal("0.84"));l.setTotalHt(new BigDecimal("-0.84"));
        l.setTaxAmount(new BigDecimal("-0.16"));l.setTotalTtc(new BigDecimal("-1"));
        i.setTotalHt(l.getTotalHt());i.setTotalTax(l.getTaxAmount());i.setTotalTtc(l.getTotalTtc());
        assertThat(BaitlyInvoiceChecks.issues(i)).isEmpty();
        i.setRefundTransactionId(null);assertThat(BaitlyInvoiceChecks.issues(i)).extracting(BaitlyInvoiceChecks.Issue::code).contains("LINE_TOTAL");
        i.setRefundTransactionId(60L);l.setTaxAmount(new BigDecimal("-0.15"));l.setTotalTtc(new BigDecimal("-0.99"));
        i.setTotalTax(l.getTaxAmount());i.setTotalTtc(l.getTotalTtc());
        assertThat(BaitlyInvoiceChecks.issues(i)).extracting(BaitlyInvoiceChecks.Issue::code).contains("LINE_TOTAL");
    }
}
