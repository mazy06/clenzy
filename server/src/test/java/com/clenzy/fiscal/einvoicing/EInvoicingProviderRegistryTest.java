package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.Country;
import com.clenzy.model.Invoice;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Resolution des providers e-invoicing par pays (CLZ-P0-04), avec repli NoOp.
 */
class EInvoicingProviderRegistryTest {

    private final NoOpEInvoicingProvider noOp = new NoOpEInvoicingProvider();

    private EInvoicingProvider fake(String code, EInvoicingMode mode) {
        return new EInvoicingProvider() {
            @Override public String providerCode() { return code; }
            @Override public EInvoicingMode mode() { return mode; }
            @Override public EInvoiceResult clear(Invoice invoice) { return EInvoiceResult.cleared("ref"); }
            @Override public EInvoiceResult report(Invoice invoice) { return EInvoiceResult.reported("ref"); }
            @Override public byte[] renderCompliantArtifact(Invoice invoice) { return new byte[0]; }
        };
    }

    private Country country(String einvoicingProvider) {
        Country c = new Country();
        c.setEinvoicingProvider(einvoicingProvider);
        return c;
    }

    @Test
    void resolvesRegisteredProvider() {
        EInvoicingProvider zatca = fake("zatca", EInvoicingMode.ZATCA_CLEARANCE);
        var registry = new EInvoicingProviderRegistry(List.of(noOp, zatca), noOp);

        assertThat(registry.resolve(country("zatca"))).isSameAs(zatca);
    }

    @Test
    void fallsBackToNoOp_whenCodeNotImplemented() {
        var registry = new EInvoicingProviderRegistry(List.of(noOp), noOp);

        assertThat(registry.resolve(country("factur_x"))).isSameAs(noOp);
    }

    @Test
    void fallsBackToNoOp_whenCountryNull() {
        var registry = new EInvoicingProviderRegistry(List.of(noOp), noOp);

        assertThat(registry.resolve(null)).isSameAs(noOp);
    }

    @Test
    void fallsBackToNoOp_whenProviderCodeBlank() {
        var registry = new EInvoicingProviderRegistry(List.of(noOp), noOp);

        assertThat(registry.resolve(country("   "))).isSameAs(noOp);
    }
}
