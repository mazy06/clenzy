package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.fiscal.einvoicing.EInvoiceStatus;
import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import com.clenzy.model.Invoice;
import com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Provider Factur-X FR (CLZ-P0-19) : mode FACTURX_PDP, rendu XML, transmission PDP.
 */
class FrancePdpProviderTest {
    @Test void onlyLocallyAndFrenchValidatedArtifactsAreSentToTheReplaceablePartner() {
        var invoice=BaitlyInvoiceCiiTest.invoice();var xml=new BaitlyInvoiceCiiBuilder().build(invoice,BaitlyInvoiceCiiTest.data());
        var client=mock(PdpTransmissionClient.class);var documents=mock(BaitlyInvoiceFiscalDocuments.class);
        when(documents.preparedArtifact(invoice)).thenReturn(xml.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        when(client.transmit(org.mockito.ArgumentMatchers.eq(invoice),org.mockito.ArgumentMatchers.any())).thenReturn(EInvoiceResult.pending("Déposé"));
        var provider=new FrancePdpProvider(documents,client,BaitlyInvoiceCiiTest.VALIDATOR);
        assertThat(provider.report(invoice).status()).isEqualTo(EInvoiceStatus.PENDING);
        org.mockito.Mockito.verify(client).transmit(org.mockito.ArgumentMatchers.eq(invoice),org.mockito.ArgumentMatchers.eq(xml.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        org.mockito.Mockito.clearInvocations(client);
        when(documents.preparedArtifact(invoice)).thenReturn(xml.replace("<ram:SubjectCode>PMT</ram:SubjectCode>","").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThat(provider.report(invoice).message()).contains("françaises");org.mockito.Mockito.verifyNoInteractions(client);
    }

    private final BaitlyInvoiceFiscalDocuments documents=mock(BaitlyInvoiceFiscalDocuments.class);
    private final FrancePdpProvider provider = new FrancePdpProvider(documents, new UnconfiguredPdpTransmissionClient(),mock(BaitlyCiiValidator.class));

    @Test
    void exposesFacturXMode() {
        assertThat(provider.providerCode()).isEqualTo("factur_x");
        assertThat(provider.mode()).isEqualTo(EInvoicingMode.FACTURX_PDP);
    }

    @Test
    void rendersOnlyTheInternallyArchivedArtifact() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("F1");
        when(documents.preparedArtifact(inv)).thenReturn("ARCHIVED".getBytes());

        assertThat(provider.renderCompliantArtifact(inv).length).isGreaterThan(0);
    }

    @Test
    void reportPendingWhenPdpNotConfigured() {
        Invoice inv = mock(Invoice.class);
        when(inv.getInvoiceNumber()).thenReturn("F1");
        when(documents.preparedArtifact(inv)).thenReturn(new byte[0]);

        EInvoiceResult result = provider.report(inv);

        assertThat(result.status()).isEqualTo(EInvoiceStatus.PENDING);
        assertThat(result.message()).contains("Préparation fiscale interne");
    }

    @Test
    void clearNotRequiredForFrance() {
        Invoice inv = mock(Invoice.class);

        assertThat(provider.clear(inv).status()).isEqualTo(EInvoiceStatus.NOT_REQUIRED);
    }
}
