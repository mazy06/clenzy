package com.clenzy.fiscal.einvoicing.zatca;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.model.Invoice;

/**
 * Client de l'API ZATCA Fatoora (CLZ-P0-20) : clearance (B2B standard, temps réel) et
 * reporting (B2C simplifiée, &lt; 24h). Appels réseau → hors transaction, idempotents (audit #2).
 *
 * <p>L'implémentation réelle (signature XAdES, CSID, chaîne PIH, sandbox) est une sous-tâche
 * crypto — voir HP-10 et {@code tech/ZATCA-implementation-spec.md}.</p>
 */
public interface ZatcaApiClient {

    EInvoiceResult clear(Invoice invoice, byte[] ublXml);

    EInvoiceResult report(Invoice invoice, byte[] ublXml);
}
