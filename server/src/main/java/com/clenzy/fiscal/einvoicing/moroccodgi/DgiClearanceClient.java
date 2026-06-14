package com.clenzy.fiscal.einvoicing.moroccodgi;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.model.Invoice;

/**
 * Client de clearance DGI Maroc (portail Simpl-TVA) — CLZ-P0-MA.
 *
 * <p>Soumet l'UBL 2.1 à la DGI et attend la pré-validation. L'implémentation réelle (auth,
 * endpoint Simpl-TVA, gestion du cycle de vie) est à caler sur la publication finale de l'API
 * DGI ; en attendant, {@link UnconfiguredDgiClearanceClient} renvoie {@code PENDING}.</p>
 */
public interface DgiClearanceClient {

    /**
     * Soumet la facture (UBL 2.1) à la clearance DGI. Appel HTTP externe → hors transaction DB,
     * idempotent par numéro de facture (audit #2).
     */
    EInvoiceResult clear(Invoice invoice, byte[] ublXml);
}
