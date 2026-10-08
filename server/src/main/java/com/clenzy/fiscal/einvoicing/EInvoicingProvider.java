package com.clenzy.fiscal.einvoicing;

import com.clenzy.model.Invoice;

/**
 * Abstraction d'emission/transmission de facture electronique par pays (CLZ-P0-04).
 *
 * <p>Socle commun pour Factur-X (FR), DGI (MA) et ZATCA (KSA). Une implementation par
 * provider, resolue via {@link EInvoicingProviderRegistry} a partir de
 * {@code Country.einvoicingProvider}. Le flux de facturation NF existant
 * (numerotation, PDF) n'est pas modifie : ce contrat ajoute la conformite e-invoicing
 * par-dessus.</p>
 *
 * <p><b>Important</b> : les implementations reelles effectuent des appels reseau (autorites
 * fiscales) — elles doivent etre invoquees <b>hors transaction DB</b>, de maniere
 * idempotente (cle {@code organizationId + invoiceNumber}), le resultat etant persiste
 * separement (cf. {@link EInvoicingService} + audit #2).</p>
 */
public interface EInvoicingProvider {

    /** Code unique du provider (ex. {@code factur_x}, {@code dgi_ma}, {@code zatca}, {@code noop}). */
    String providerCode();

    /** Mode d'e-invoicing pris en charge. */
    EInvoicingMode mode();

    /** Un adaptateur doit déclarer explicitement son raccordement avant tout envoi. */
    default boolean configured() { return false; }

    /** Contrôles locaux uniquement, avant la réservation durable de l'envoi. */
    default String readinessIssue(Invoice invoice) { return null; }

    default boolean supportsReconciliation() { return false; }

    /** Relit un dépôt identifié ; ne doit jamais réémettre la facture. */
    default EInvoiceResult reconcile(Invoice invoice, String externalRef) {
        return new EInvoiceResult(EInvoiceStatus.PENDING, externalRef, "Vérification auprès du partenaire requise");
    }

    /** Clearance temps reel (validation par l'autorite avant remise). */
    EInvoiceResult clear(Invoice invoice);

    /** Reporting differe (declaration a l'autorite). */
    EInvoiceResult report(Invoice invoice);

    /** Rend l'artefact legal conforme (XML UBL/CII signe, PDF/A-3...) ; vide si non applicable. */
    byte[] renderCompliantArtifact(Invoice invoice);
}
