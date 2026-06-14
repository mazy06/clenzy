package com.clenzy.fiscal.einvoicing.zatca;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

/**
 * Implémentation par défaut tant que l'onboarding ZATCA (CSID, sandbox, signature) n'est pas
 * réalisé (CLZ-P0-20) : l'UBL est généré mais la soumission reste {@code PENDING}. Remplacée
 * par un client réel ({@code @Primary}) au branchement Fatoora.
 */
@Component
public class UnconfiguredZatcaApiClient implements ZatcaApiClient {

    private static final String MESSAGE =
        "ZATCA non configure : UBL genere, en attente onboarding CSID + signature XAdES + sandbox Fatoora";

    @Override
    public EInvoiceResult clear(Invoice invoice, byte[] ublXml) {
        return EInvoiceResult.pending(MESSAGE);
    }

    @Override
    public EInvoiceResult report(Invoice invoice, byte[] ublXml) {
        return EInvoiceResult.pending(MESSAGE);
    }
}
