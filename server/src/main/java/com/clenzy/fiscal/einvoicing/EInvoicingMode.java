package com.clenzy.fiscal.einvoicing;

/**
 * Mode d'e-invoicing applicable a un pays (CLZ-P0-04).
 *
 * <ul>
 *   <li>{@link #NONE} : aucune contrainte legale d'e-invoicing (PDF classique).</li>
 *   <li>{@link #FACTURX_PDP} : France — Factur-X transmis via une PDP (reporting/transmission).</li>
 *   <li>{@link #DGI_CLEARANCE} : Maroc — clearance DGI.</li>
 *   <li>{@link #ZATCA_CLEARANCE} : KSA — clearance temps reel (factures standard B2B).</li>
 *   <li>{@link #ZATCA_REPORTING} : KSA — reporting &lt; 24h (factures simplifiees B2C).</li>
 * </ul>
 */
public enum EInvoicingMode {
    NONE,
    FACTURX_PDP,
    DGI_CLEARANCE,
    ZATCA_CLEARANCE,
    ZATCA_REPORTING
}
