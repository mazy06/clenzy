package com.clenzy.compliance.country;

import com.clenzy.compliance.CountryComplianceStrategy;
import com.clenzy.model.DocumentType;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Strategie de conformite pour l'Arabie Saoudite — norme ZATCA.
 *
 * Phase 1 (simplified) :
 * - Numerotation sequentielle (FACTURE uniquement)
 * - QR code sur les factures simplifiees (optionnel Phase 1)
 * - Format de date ISO (yyyy-MM-dd)
 * - VAT registration number (15 digits)
 *
 * TODO Phase 2 :
 * - E-invoicing XML (Fatoora)
 * - QR code obligatoire
 * - Integration ZATCA API pour clearance
 * - Support arabe/anglais bilingue
 */
@Component
public class SaudiComplianceStrategy implements CountryComplianceStrategy {

    private static final String COUNTRY_CODE = "SA";

    @Override
    public String getCountryCode() {
        return COUNTRY_CODE;
    }

    @Override
    public String getStandardName() {
        return "ZATCA";
    }

    @Override
    public Map<String, Object> resolveComplianceTags(DocumentType type, String legalNumber) {
        Map<String, Object> tags = new LinkedHashMap<>();

        tags.put("numero_legal", legalNumber != null ? legalNumber : "");

        if (type == DocumentType.FACTURE) {
            // ZATCA n'a pas de conditions de paiement standard imposees,
            // mais on peut fournir un defaut raisonnable
            tags.putIfAbsent("conditions_paiement",
                "Payment due upon receipt. Late payment penalties apply as per applicable regulations.");
        }

        // TODO Phase 2: generate QR code data (TLV format)
        // tags.put("qr_code", generateZatcaQrCode(...));

        return tags;
    }

    @Override
    public Map<String, List<String>> buildMentionTagMapping() {
        Map<String, List<String>> mapping = new LinkedHashMap<>();

        // Facture
        mapping.put("numero_facture", List.of("nf.numero_legal", "${nf.numero_legal}"));
        mapping.put("date_emission", List.of("nf.date_emission", "system.date", "${nf.date_emission}", "${system.date}"));
        mapping.put("identite_vendeur", List.of("entreprise.nom", "entreprise.adresse",
            "${entreprise.nom}", "${entreprise.adresse}"));
        mapping.put("identite_acheteur", List.of("client.nom", "client.nom_complet",
            "${client.nom}", "${client.nom_complet}"));
        mapping.put("designation_prestations", List.of("intervention.titre", "intervention.description",
            "${intervention.titre}", "${intervention.description}"));
        mapping.put("montant_total", List.of("paiement.montant", "intervention.cout_reel",
            "${paiement.montant}", "${intervention.cout_reel}"));
        mapping.put("vat_number", List.of("entreprise.vat_number", "${entreprise.vat_number}"));
        // QR code is optional in Phase 1
        mapping.put("qr_code", List.of("nf.qr_code", "${nf.qr_code}"));

        // Devis
        mapping.put("numero_devis", List.of("nf.numero_legal", "${nf.numero_legal}"));
        mapping.put("duree_validite", List.of("nf.duree_validite", "${nf.duree_validite}"));

        return mapping;
    }

    @Override
    public String getDateFormatPattern() {
        // ZATCA requires ISO 8601 date format
        return "yyyy-MM-dd";
    }

    @Override
    public boolean requiresLegalNumber(DocumentType type) {
        // Only invoices require legal numbering in ZATCA Phase 1
        return type == DocumentType.FACTURE;
    }

    @Override
    public String getDefaultPrefix(DocumentType type) {
        return switch (type) {
            case FACTURE -> "INV";
            default -> null;
        };
    }
}
