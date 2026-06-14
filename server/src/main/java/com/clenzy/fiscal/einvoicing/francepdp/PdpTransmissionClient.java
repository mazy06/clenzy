package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.model.Invoice;

/**
 * Transmission d'une facture Factur-X via une Plateforme de Dématérialisation
 * Partenaire (PDP), réforme française e-invoicing (CLZ-P0-19).
 *
 * <p>Appel réseau → à invoquer HORS transaction DB, idempotent (audit #2).</p>
 */
public interface PdpTransmissionClient {

    EInvoiceResult transmit(Invoice invoice, byte[] facturXXml);
}
