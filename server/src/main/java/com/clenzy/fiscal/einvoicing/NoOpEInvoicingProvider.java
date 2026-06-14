package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

/**
 * Provider e-invoicing par defaut (mode {@link EInvoicingMode#NONE}) : pays sans contrainte
 * legale d'e-invoicing, ou provider d'un pays pas encore implemente. Ne casse jamais le flux
 * de facturation existant (CLZ-P0-04). Repli du {@link EInvoicingProviderRegistry}.
 */
@Component
public class NoOpEInvoicingProvider implements EInvoicingProvider {

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
