package com.clenzy.fiscal.einvoicing.moroccodgi;

import com.clenzy.model.Invoice;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Mapping UBL 2.1 DGI Maroc (CLZ-P0-MA).
 */
class MoroccoUblMapperTest {

    private final MoroccoUblMapper mapper = new MoroccoUblMapper();

    @Test
    void mapsUblWithKeyFieldsAndEscaping() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("MA-001");
        when(inv.getCurrency()).thenReturn("MAD");
        when(inv.getInvoiceDate()).thenReturn(LocalDate.of(2026, 4, 20));
        when(inv.getTotalHt()).thenReturn(new BigDecimal("1000.00"));
        when(inv.getTotalTax()).thenReturn(new BigDecimal("200.00"));
        when(inv.getTotalTtc()).thenReturn(new BigDecimal("1200.00"));
        when(inv.getSellerName()).thenReturn("Conciergerie <MA>");
        when(inv.getSellerTaxId()).thenReturn("ICE001122334455");

        String xml = mapper.toUbl(inv);

        assertThat(xml)
            .contains("<cbc:ID>MA-001</cbc:ID>")
            .contains("<cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>")
            .contains("<cbc:IssueDate>2026-04-20</cbc:IssueDate>")
            .contains("<cbc:DocumentCurrencyCode>MAD</cbc:DocumentCurrencyCode>")
            .contains("<cbc:TaxInclusiveAmount currencyID=\"MAD\">1200.00</cbc:TaxInclusiveAmount>")
            .contains("<cbc:CompanyID>ICE001122334455</cbc:CompanyID>")
            .contains("Conciergerie &lt;MA&gt;");
        assertThat(xml).doesNotContain("Conciergerie <MA>");
    }

    @Test
    void defaultsCurrencyToMad() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("X");

        assertThat(mapper.toUbl(inv)).contains("<cbc:DocumentCurrencyCode>MAD</cbc:DocumentCurrencyCode>");
    }
}
