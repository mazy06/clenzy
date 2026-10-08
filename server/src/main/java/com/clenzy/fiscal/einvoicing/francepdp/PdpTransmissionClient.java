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

    default boolean configured() { return false; }

    /** Contrôles locaux avant de marquer la soumission comme commencée. Aucun appel réseau. */
    default String readinessIssue(Invoice invoice, byte[] cii) { return null; }

    default boolean supportsReconciliation() { return false; }

    default EInvoiceResult reconcile(Invoice invoice, String externalRef) {
        return new EInvoiceResult(com.clenzy.fiscal.einvoicing.EInvoiceStatus.PENDING, externalRef,
            "Vérification auprès du partenaire requise");
    }

    EInvoiceResult transmit(Invoice invoice, byte[] facturXXml);
}
