package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.model.Invoice;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Génération du XML Factur-X (CII) à partir d'une facture (CLZ-P0-19).
 */
class FacturXCiiBuilderTest {

    private final FacturXCiiBuilder builder = new FacturXCiiBuilder();

    @Test
    void buildsCiiWithKeyFieldsAndEscaping() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("F-2026-001");
        when(inv.getCurrency()).thenReturn("EUR");
        when(inv.getInvoiceDate()).thenReturn(LocalDate.of(2026, 3, 15));
        when(inv.getTotalHt()).thenReturn(new BigDecimal("100.00"));
        when(inv.getTotalTax()).thenReturn(new BigDecimal("10.00"));
        when(inv.getTotalTtc()).thenReturn(new BigDecimal("110.00"));
        when(inv.getSellerName()).thenReturn("Concierge & Co");
        when(inv.getSellerTaxId()).thenReturn("FR123");

        String xml = builder.build(inv);

        assertThat(xml)
            .contains("<ram:ID>F-2026-001</ram:ID>")
            .contains("<ram:TypeCode>380</ram:TypeCode>")
            .contains("20260315")
            .contains("<ram:GrandTotalAmount>110.00</ram:GrandTotalAmount>")
            .contains("<ram:CalculatedAmount>10.00</ram:CalculatedAmount>")
            .contains("Concierge &amp; Co")   // échappement XML
            .contains("<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>");
        assertThat(xml).doesNotContain("Concierge & Co");
    }

    @Test
    void handlesNullsGracefully() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("X");
        // montants/devise/parties null

        String xml = builder.build(inv);

        assertThat(xml)
            .contains("<ram:GrandTotalAmount>0.00</ram:GrandTotalAmount>")
            .contains("<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>"); // devise par défaut
    }
}
