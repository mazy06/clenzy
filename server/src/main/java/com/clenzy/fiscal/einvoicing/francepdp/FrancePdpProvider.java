package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import com.clenzy.fiscal.einvoicing.EInvoicingProvider;
import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Provider e-invoicing France (CLZ-P0-19), branché sur l'abstraction {@code EInvoicingProvider}
 * (CLZ-P0-04). Mode {@link EInvoicingMode#FACTURX_PDP} : rendu du XML Factur-X (CII) puis
 * transmission via une PDP. Pas de clearance en France (modèle reporting/transmission).
 *
 * <p>Résolu pour les pays dont {@code Country.einvoicingProvider == "factur_x"} (la France).</p>
 */
@Component
public class FrancePdpProvider implements EInvoicingProvider {

    public static final String CODE = "factur_x";

    private final FacturXCiiBuilder ciiBuilder;
    private final PdpTransmissionClient pdpClient;

    public FrancePdpProvider(FacturXCiiBuilder ciiBuilder, PdpTransmissionClient pdpClient) {
        this.ciiBuilder = ciiBuilder;
        this.pdpClient = pdpClient;
    }

    @Override
    public String providerCode() {
        return CODE;
    }

    @Override
    public EInvoicingMode mode() {
        return EInvoicingMode.FACTURX_PDP;
    }

    @Override
    public EInvoiceResult clear(Invoice invoice) {
        // La France fonctionne en reporting/transmission PDP, pas en clearance temps réel.
        return EInvoiceResult.notRequired();
    }

    @Override
    public EInvoiceResult report(Invoice invoice) {
        byte[] facturX = renderCompliantArtifact(invoice);
        return pdpClient.transmit(invoice, facturX);
    }

    @Override
    public byte[] renderCompliantArtifact(Invoice invoice) {
        return ciiBuilder.build(invoice).getBytes(StandardCharsets.UTF_8);
    }
}
