package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

/**
 * Exemption explicitement configurée (mode {@link EInvoicingMode#NONE}).
 * Un raccordement absent ou inconnu reste en attente dans le registre Baitly ;
 * il ne doit jamais être converti en exemption par défaut.
 */
@Component
public class NoOpEInvoicingProvider implements EInvoicingProvider {
    @Override public boolean configured() { return true; }

    public static final String CODE = "noop";

    @Override
    public String providerCode() {
        return CODE;
    }

    @Override
    public EInvoicingMode mode() {
        return EInvoicingMode.NONE;
    }

    @Override
    public EInvoiceResult clear(Invoice invoice) {
        return EInvoiceResult.notRequired();
    }

    @Override
    public EInvoiceResult report(Invoice invoice) {
        return EInvoiceResult.notRequired();
    }

    @Override
    public byte[] renderCompliantArtifact(Invoice invoice) {
        return new byte[0];
    }
}
