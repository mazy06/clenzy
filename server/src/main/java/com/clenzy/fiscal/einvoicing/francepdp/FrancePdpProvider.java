package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.fiscal.einvoicing.EInvoicingMode;
import com.clenzy.fiscal.einvoicing.EInvoicingProvider;
import com.clenzy.fiscal.einvoicing.BaitlyInvoiceFiscalDocuments;
import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

/**
 * Provider e-invoicing France (CLZ-P0-19), branché sur l'abstraction {@code EInvoicingProvider}
 * (CLZ-P0-04). Mode historique {@link EInvoicingMode#FACTURX_PDP} : transmission d'un XML
 * CII préparé et archivé par Baitly via une plateforme agréée. Ce XML n'est pas un PDF hybride.
 *
 * <p>Résolu pour les pays dont {@code Country.einvoicingProvider == "factur_x"} (la France).</p>
 */
@Component
public class FrancePdpProvider implements EInvoicingProvider {

    public static final String CODE = "factur_x";

    private final BaitlyInvoiceFiscalDocuments documents;
    private final PdpTransmissionClient pdpClient;
    private final BaitlyCiiValidator validator;

    public FrancePdpProvider(BaitlyInvoiceFiscalDocuments documents, PdpTransmissionClient pdpClient, BaitlyCiiValidator validator) {
        this.documents = documents;
        this.pdpClient = pdpClient;
        this.validator = validator;
    }

    @Override
    public String providerCode() {
        return CODE;
    }

    @Override
    public EInvoicingMode mode() {
        return EInvoicingMode.FACTURX_PDP;
    }

    @Override public boolean configured() { return pdpClient.configured(); }

    @Override public String readinessIssue(Invoice invoice) {
        byte[] artifact=renderCompliantArtifact(invoice);
        if(artifact.length==0)return "Préparation fiscale interne requise dans le détail de la facture";
        var local=validator.validateFrance(new String(artifact,java.nio.charset.StandardCharsets.UTF_8));
        if(!local.isEmpty())return "Règles fiscales françaises à compléter avant transmission : "+local.stream().map(BaitlyCiiValidator.Issue::code).distinct().limit(5).collect(java.util.stream.Collectors.joining(", "));
        return pdpClient.readinessIssue(invoice, artifact);
    }

    @Override public boolean supportsReconciliation() { return pdpClient.supportsReconciliation(); }

    @Override public EInvoiceResult reconcile(Invoice invoice, String externalRef) {
        return pdpClient.reconcile(invoice, externalRef);
    }

    @Override
    public EInvoiceResult clear(Invoice invoice) {
        // La France fonctionne en reporting/transmission PDP, pas en clearance temps réel.
        return EInvoiceResult.notRequired();
    }

    @Override
    public EInvoiceResult report(Invoice invoice) {
        String issue=readinessIssue(invoice);
        if(issue!=null)return EInvoiceResult.pending(issue);
        byte[] facturX = renderCompliantArtifact(invoice);
        if(facturX.length==0)return EInvoiceResult.pending("Préparation fiscale interne requise dans le détail de la facture");
        return pdpClient.transmit(invoice, facturX);
    }

    @Override
    public byte[] renderCompliantArtifact(Invoice invoice) {
        // Seule l'archive interne est utilisable : aucun repli sur le générateur historique partiel.
        return documents.preparedArtifact(invoice);
    }
}
