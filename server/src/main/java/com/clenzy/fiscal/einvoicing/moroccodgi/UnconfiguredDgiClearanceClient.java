package com.clenzy.fiscal.einvoicing.moroccodgi;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

/**
 * Implémentation par défaut tant que l'API DGI Simpl-TVA n'est pas raccordée (CLZ-P0-MA) :
 * l'UBL est généré mais la clearance reste {@code PENDING}. Remplacée par un client réel
 * ({@code @Primary}) au branchement Simpl-TVA.
 */
@Component
public class UnconfiguredDgiClearanceClient implements DgiClearanceClient {

    private static final String MESSAGE =
        "DGI Simpl-TVA non configure : UBL genere, en attente de raccordement API clearance";

    @Override
    public EInvoiceResult clear(Invoice invoice, byte[] ublXml) {
        return EInvoiceResult.pending(MESSAGE);
    }
}
