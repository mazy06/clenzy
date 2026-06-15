package com.clenzy.fiscal.einvoicing.francepdp;

import com.clenzy.fiscal.einvoicing.EInvoiceResult;
import com.clenzy.model.Invoice;
import org.springframework.stereotype.Component;

/**
 * Implémentation par défaut tant qu'aucun partenaire PDP n'est branché (CLZ-P0-19) :
 * le XML Factur-X est généré mais la transmission reste {@code PENDING}. Remplacée
 * par un client PDP réel (marqué {@code @Primary}) au branchement du partenaire.
 */
@Component
public class UnconfiguredPdpTransmissionClient implements PdpTransmissionClient {

    @Override
    public EInvoiceResult transmit(Invoice invoice, byte[] facturXXml) {
        return EInvoiceResult.pending(
            "PDP non configuree : XML Factur-X genere, transmission en attente de partenaire PDP");
    }
}
