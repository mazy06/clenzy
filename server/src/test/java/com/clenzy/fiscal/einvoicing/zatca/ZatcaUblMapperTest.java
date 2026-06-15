package com.clenzy.fiscal.einvoicing.zatca;

import com.clenzy.model.Invoice;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Mapping UBL 2.1 ZATCA (CLZ-P0-20).
 */
class ZatcaUblMapperTest {

    private final ZatcaUblMapper mapper = new ZatcaUblMapper();

    @Test
    void mapsUblWithKeyFieldsAndEscaping() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("KSA-001");
        when(inv.getCurrency()).thenReturn("SAR");
        when(inv.getInvoiceDate()).thenReturn(LocalDate.of(2026, 3, 15));
        when(inv.getTotalHt()).thenReturn(new BigDecimal("100.00"));
        when(inv.getTotalTax()).thenReturn(new BigDecimal("15.00"));
        when(inv.getTotalTtc()).thenReturn(new BigDecimal("115.00"));
        when(inv.getSellerName()).thenReturn("Concierge <KSA>");

        String xml = mapper.toUbl(inv);

        assertThat(xml)
            .contains("<cbc:ID>KSA-001</cbc:ID>")
            .contains("<cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>")
            .contains("<cbc:IssueDate>2026-03-15</cbc:IssueDate>")
            .contains("currencyID=\"SAR\"")
            .contains("<cbc:TaxInclusiveAmount currencyID=\"SAR\">115.00</cbc:TaxInclusiveAmount>")
            .contains("Concierge &lt;KSA&gt;");
        assertThat(xml).doesNotContain("Concierge <KSA>");
    }

    @Test
    void defaultsCurrencyToSar() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("X");

        assertThat(mapper.toUbl(inv)).contains("<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>");
    }
}
