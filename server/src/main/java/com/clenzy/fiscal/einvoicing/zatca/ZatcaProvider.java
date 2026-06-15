package com.clenzy.fiscal.einvoicing.zatca;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import com.clenzy.fiscal.einvoicing.EInvoicingProvider;
import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Provider e-invoicing Arabie Saoudite — ZATCA Fatoora (CLZ-P0-20), branché sur l'abstraction
 * {@code EInvoicingProvider} (CLZ-P0-04). Résolu pour les pays dont
 * {@code Country.einvoicingProvider == "zatca"} (KSA).
 *
 * <p>Mode {@link EInvoicingMode#ZATCA_REPORTING} (facture simplifiée B2C — cas majoritaire en
 * location courte durée ; reporting &lt; 24h). La clearance B2B reste disponible via
 * {@link #clear}. Rend l'UBL 2.1 puis délègue à {@link ZatcaApiClient}. Signature XAdES, QR
 * (tags 6-9), chaîne PIH/ICV et CSID = sous-tâches crypto (HP-10).</p>
 */
@Component
public class ZatcaProvider implements EInvoicingProvider {

    public static final String CODE = "zatca";

    private final ZatcaUblMapper ublMapper;
    private final ZatcaApiClient apiClient;

    public ZatcaProvider(ZatcaUblMapper ublMapper, ZatcaApiClient apiClient) {
        this.ublMapper = ublMapper;
        this.apiClient = apiClient;
    }

    @Override
    public String providerCode() {
        return CODE;
    }

    @Override
    public EInvoicingMode mode() {
        return EInvoicingMode.ZATCA_REPORTING;
    }

    @Override
    public EInvoiceResult clear(Invoice invoice) {
        return apiClient.clear(invoice, renderCompliantArtifact(invoice));
    }

    @Override
    public EInvoiceResult report(Invoice invoice) {
        return apiClient.report(invoice, renderCompliantArtifact(invoice));
    }

    @Override
    public byte[] renderCompliantArtifact(Invoice invoice) {
        return ublMapper.toUbl(invoice).getBytes(StandardCharsets.UTF_8);
    }
}
