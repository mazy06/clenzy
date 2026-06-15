package com.clenzy.fiscal.einvoicing.moroccodgi;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import com.clenzy.fiscal.einvoicing.EInvoicingProvider;
import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Provider e-invoicing Maroc — clearance DGI Simpl-TVA (CLZ-P0-MA), branché sur l'abstraction
 * {@code EInvoicingProvider} (CLZ-P0-04). Résolu pour les pays dont
 * {@code Country.einvoicingProvider == "dgi_ma"} (le Maroc).
 *
 * <p>Mode {@link EInvoicingMode#DGI_CLEARANCE} : le Maroc fonctionne en pré-validation (CTC) —
 * une facture doit être validée par la DGI avant d'être légalement valide. Rend l'UBL 2.1 puis
 * délègue à {@link DgiClearanceClient}. Le raccordement réel à l'API Simpl-TVA (auth, endpoint,
 * cycle de vie) + l'exigence ICE côté {@code MoroccoComplianceStrategy} sont différés (HP-16,
 * spec API DGI en cours de publication).</p>
 */
@Component
public class MoroccoDgiProvider implements EInvoicingProvider {

    public static final String CODE = "dgi_ma";

    private final MoroccoUblMapper ublMapper;
    private final DgiClearanceClient clearanceClient;

    public MoroccoDgiProvider(MoroccoUblMapper ublMapper, DgiClearanceClient clearanceClient) {
        this.ublMapper = ublMapper;
        this.clearanceClient = clearanceClient;
    }

    @Override
    public String providerCode() {
        return CODE;
    }

    @Override
    public EInvoicingMode mode() {
        return EInvoicingMode.DGI_CLEARANCE;
    }

    @Override
    public EInvoiceResult clear(Invoice invoice) {
        return clearanceClient.clear(invoice, renderCompliantArtifact(invoice));
    }

    @Override
    public EInvoiceResult report(Invoice invoice) {
        // Le Maroc est en modèle clearance ; pas de canal de reporting différé distinct.
        return EInvoiceResult.notRequired();
    }

    @Override
    public byte[] renderCompliantArtifact(Invoice invoice) {
        return ublMapper.toUbl(invoice).getBytes(StandardCharsets.UTF_8);
    }
}
