package com.clenzy.fiscal.einvoicing.zatca;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.fiscal.einvoicing.EInvoiceStatus;
import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import com.clenzy.model.Invoice;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Provider ZATCA KSA (CLZ-P0-20) : mode reporting, rendu UBL, soumission via client API.
 */
class ZatcaProviderTest {

    private final ZatcaProvider provider =
        new ZatcaProvider(new ZatcaUblMapper(), new UnconfiguredZatcaApiClient());

    @Test
    void exposesZatcaReportingMode() {
        assertThat(provider.providerCode()).isEqualTo("zatca");
        assertThat(provider.mode()).isEqualTo(EInvoicingMode.ZATCA_REPORTING);
    }

    @Test
    void rendersUblArtifact() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("K1");

        assertThat(provider.renderCompliantArtifact(inv).length).isGreaterThan(0);
    }

    @Test
    void reportPendingWhenUnconfigured() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("K1");

        EInvoiceResult result = provider.report(inv);

        assertThat(result.status()).isEqualTo(EInvoiceStatus.PENDING);
        assertThat(result.message()).contains("ZATCA");
    }
}
