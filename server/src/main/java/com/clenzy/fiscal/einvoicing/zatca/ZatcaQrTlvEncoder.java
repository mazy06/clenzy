package com.clenzy.fiscal.einvoicing.zatca;

import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Encodeur du QR code ZATCA au format TLV (Tag-Length-Value), Base64 (CLZ-P0-20).
 *
 * <p>Implémente les 5 premiers tags de données (facture simplifiée B2C — cas majoritaire
 * en location courte durée) :</p>
 * <ol>
 *   <li>Nom du vendeur</li>
 *   <li>Numéro de TVA (VAT) du vendeur</li>
 *   <li>Horodatage de la facture (ISO 8601)</li>
 *   <li>Total TTC</li>
 *   <li>Montant de TVA</li>
 * </ol>
 *
 * <p>Les tags 6-9 (hash du XML, signature ECDSA/XAdES, clé publique, signature de la clé)
 * relèvent de la phase cryptographique — voir HP-10 et {@code tech/ZATCA-implementation-spec.md}.</p>
 */
@Component
public class ZatcaQrTlvEncoder {

    private static final int MAX_VALUE_BYTES = 255;

    public String encodeBase64(String sellerName, String vatNumber, String timestampIso,
                               String totalWithVat, String vatAmount) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeTlv(out, 1, sellerName);
        writeTlv(out, 2, vatNumber);
        writeTlv(out, 3, timestampIso);
        writeTlv(out, 4, totalWithVat);
        writeTlv(out, 5, vatAmount);
        return Base64.getEncoder().encodeToString(out.toByteArray());
    }

    private void writeTlv(ByteArrayOutputStream out, int tag, String value) {
        byte[] raw = (value != null ? value : "").getBytes(StandardCharsets.UTF_8);
        int length = Math.min(raw.length, MAX_VALUE_BYTES);
        out.write(tag & 0xFF);
        out.write(length & 0xFF);
        out.write(raw, 0, length);
    }
}
