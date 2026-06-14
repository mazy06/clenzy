package com.clenzy.fiscal.einvoicing.moroccodgi;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.fiscal.einvoicing.EInvoiceStatus;
import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import com.clenzy.model.Invoice;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Provider DGI Maroc (CLZ-P0-MA) : mode clearance, rendu UBL, soumission via client Simpl-TVA.
 */
class MoroccoDgiProviderTest {

    private final MoroccoDgiProvider provider =
        new MoroccoDgiProvider(new MoroccoUblMapper(), new UnconfiguredDgiClearanceClient());

    @Test
    void exposesDgiClearanceMode() {
        assertThat(provider.providerCode()).isEqualTo("dgi_ma");
        assertThat(provider.mode()).isEqualTo(EInvoicingMode.DGI_CLEARANCE);
    }

    @Test
    void rendersUblArtifact() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("M1");

        assertThat(provider.renderCompliantArtifact(inv).length).isGreaterThan(0);
    }

    @Test
    void clearPendingWhenUnconfigured() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("M1");

        EInvoiceResult result = provider.clear(inv);

        assertThat(result.status()).isEqualTo(EInvoiceStatus.PENDING);
        assertThat(result.message()).contains("DGI");
    }

    @Test
    void reportNotRequiredForClearanceModel() {
        Invoice inv = mock(Invoice.class);

        assertThat(provider.report(inv).status()).isEqualTo(EInvoiceStatus.NOT_REQUIRED);
    }
}
