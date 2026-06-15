package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.fiscal.einvoicing.EInvoiceStatus;
import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import com.clenzy.model.Invoice;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Provider Factur-X FR (CLZ-P0-19) : mode FACTURX_PDP, rendu XML, transmission PDP.
 */
class FrancePdpProviderTest {

    private final FrancePdpProvider provider =
        new FrancePdpProvider(new FacturXCiiBuilder(), new UnconfiguredPdpTransmissionClient());

    @Test
    void exposesFacturXMode() {
        assertThat(provider.providerCode()).isEqualTo("factur_x");
        assertThat(provider.mode()).isEqualTo(EInvoicingMode.FACTURX_PDP);
    }

    @Test
    void rendersNonEmptyArtifact() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("F1");

        assertThat(provider.renderCompliantArtifact(inv).length).isGreaterThan(0);
    }

    @Test
    void reportPendingWhenPdpNotConfigured() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("F1");

        EInvoiceResult result = provider.report(inv);

        assertThat(result.status()).isEqualTo(EInvoiceStatus.PENDING);
        assertThat(result.message()).contains("PDP");
    }

    @Test
    void clearNotRequiredForFrance() {
        Invoice inv = mock(Invoice.class);

        assertThat(provider.clear(inv).status()).isEqualTo(EInvoiceStatus.NOT_REQUIRED);
    }
}
