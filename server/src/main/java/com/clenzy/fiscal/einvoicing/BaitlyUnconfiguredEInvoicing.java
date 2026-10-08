package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.Invoice;

/** L'absence de raccordement ne démontre aucune exemption fiscale. */
final class BaitlyUnconfiguredEInvoicing implements EInvoicingProvider {
    public String providerCode(){return "unconfigured";}
    public EInvoicingMode mode(){return EInvoicingMode.NONE;}
    public EInvoiceResult clear(Invoice invoice){return EInvoiceResult.pending("Raccordement déclaratif à configurer et vérifier");}
    public EInvoiceResult report(Invoice invoice){return clear(invoice);}
    public byte[] renderCompliantArtifact(Invoice invoice){return new byte[0];}
}
