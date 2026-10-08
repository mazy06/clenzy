package com.clenzy.fiscal.einvoicing.francepdp;

import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import static com.clenzy.fiscal.einvoicing.francepdp.BaitlyIopoleFixture.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyCiiPreflightTest {
    String issue(String xml) { return BaitlyCiiPreflight.issue(invoice(), xml.getBytes(StandardCharsets.UTF_8)); }
    @Test void coherentArchivedDocumentPassesLocalChecks() { assertThat(issue(cii())).isNull(); }
    @Test void negativeSourceCannotBecomeAPositiveInvoiceAndRateIsAPercentage() {
        var invoice=invoice();invoice.setTotalHt(new java.math.BigDecimal("-100"));
        assertThat(BaitlyCiiPreflight.issue(invoice,cii().getBytes(StandardCharsets.UTF_8))).isNotNull();
        assertThat(issue(cii().replace(">20</ram:RateApplicablePercent>",">0.2</ram:RateApplicablePercent>"))).isNotNull();
    }
    @Test void numberAmountsCurrencyPartiesAndLinesMustMatch() {
        assertThat(issue(cii().replace("BAITLY-TEST-1", "OTHER"))).isNotNull();
        assertThat(issue(cii().replace("120.00", "120.01"))).isNotNull();
        assertThat(issue(cii().replace("EUR", "USD"))).isNotNull();
        assertThat(issue(cii().replace("FR-TEST-BUYER", "OTHER"))).isNotNull();
        assertThat(issue(cii().replace("Service test", "Autre service"))).isNotNull();
        assertThat(issue(cii().replace("<ram:LineID>1", "<ram:LineID>2"))).isNotNull();
    }
    @Test void missingStructuredAddressBlocksTransmission() {
        assertThat(issue(cii().replace("<ram:PostcodeCode>75001</ram:PostcodeCode>", ""))).isNotNull();
    }
    @Test void dtdEntitiesAndWrongNamespacesAreRejectedWithoutReadingResources() {
        assertThat(issue("<!DOCTYPE x [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]>" + cii().replace("Vendeur test", "&xxe;"))).isNotNull();
        assertThat(issue(cii().replace("CrossIndustryInvoice:100", "Unexpected:100"))).isNotNull();
    }
    @Test void oversizedDocumentIsRejected() { assertThat(issue(" ".repeat(2_000_001))).contains("volumineux"); }
    @Test void creditNoteCannotMasqueradeAsInvoiceOrOmitItsOriginalReference() {
        var invoice = invoice(); invoice.setOriginalInvoiceId(5L);
        assertThat(BaitlyCiiPreflight.issue(invoice, cii().getBytes(StandardCharsets.UTF_8))).isNotNull();
        assertThat(BaitlyCiiPreflight.issue(invoice, cii().replace(">380<", ">381<").getBytes(StandardCharsets.UTF_8))).isNotNull();
    }
}
