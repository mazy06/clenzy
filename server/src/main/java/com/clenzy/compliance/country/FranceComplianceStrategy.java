package com.clenzy.compliance.country;

import com.clenzy.compliance.CountryComplianceStrategy;
import com.clenzy.model.DocumentType;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Strategie de conformite pour la France — norme NF 525.
 *
 * Exigences :
 * - Numerotation sequentielle sans trous (FACTURE, DEVIS)
 * - 7 mentions obligatoires sur les factures
 * - Immutabilite des documents (SHA-256 + verrouillage)
 * - SIRET obligatoire sur les factures
 * - Penalites de retard : 3x taux d'interet legal
 */
@Component
public class FranceComplianceStrategy implements CountryComplianceStrategy {

    private static final String COUNTRY_CODE = "FR";

    @Override
    public String getCountryCode() {
        return COUNTRY_CODE;
    }

    @Override
    public String getStandardName() {
        return "NF 525";
    }

    @Override
    public Map<String, Object> resolveComplianceTags(DocumentType type, String legalNumber) {
        Map<String, Object> tags = new LinkedHashMap<>();

        tags.put("numero_legal", legalNumber != null ? legalNumber : "");
        // date_emission est ajoute par le service appelant via getDateFormatPattern()

        if (type == DocumentType.FACTURE) {
            tags.putIfAbsent("conditions_paiement",
                "Paiement a reception. Penalites de retard : 3 fois le taux d'interet legal.");
        } else if (type == DocumentType.DEVIS) {
            tags.putIfAbsent("duree_validite",
                "Ce devis est valable 30 jours a compter de sa date d'emission.");
        }

        return tags;
    }

    @Override
    public Map<String, List<String>> buildMentionTagMapping() {
        Map<String, List<String>> mapping = new LinkedHashMap<>();

        // Facture
        mapping.put("numero_facture", List.of("nf.numero_legal", "${nf.numero_legal}"));
        mapping.put("date_emission", List.of("nf.date_emission", "system.date", "${nf.date_emission}", "${system.date}"));
        mapping.put("identite_vendeur", List.of("entreprise.nom", "entreprise.adresse", "entreprise.siret",
            "${entreprise.nom}", "${entreprise.adresse}", "${entreprise.siret}"));
        mapping.put("identite_acheteur", List.of("client.nom", "client.nom_complet",
            "${client.nom}", "${client.nom_complet}"));
        mapping.put("designation_prestations", List.of("intervention.titre", "intervention.description",
            "${intervention.titre}", "${intervention.description}"));
        mapping.put("montant_total", List.of("paiement.montant", "intervention.cout_reel",
            "${paiement.montant}", "${intervention.cout_reel}"));
        mapping.put("conditions_paiement", List.of("nf.conditions_paiement", "${nf.conditions_paiement}"));

        // Devis
        mapping.put("numero_devis", List.of("nf.numero_legal", "${nf.numero_legal}"));
        mapping.put("duree_validite", List.of("nf.duree_validite", "${nf.duree_validite}"));

        // Bon d'intervention
        mapping.put("identite_intervenant", List.of("technicien.nom", "technicien.nom_complet",
            "${technicien.nom}", "${technicien.nom_complet}"));
        mapping.put("description_travaux", List.of("intervention.description", "${intervention.description}"));
        mapping.put("date_intervention", List.of("intervention.date_debut", "intervention.date_fin",
            "${intervention.date_debut}", "${intervention.date_fin}"));

        return mapping;
    }

    @Override
    public String getDateFormatPattern() {
        return "dd/MM/yyyy";
    }

    @Override
    public boolean requiresLegalNumber(DocumentType type) {
        return type == DocumentType.FACTURE || type == DocumentType.DEVIS;
    }

    @Override
    public String getDefaultPrefix(DocumentType type) {
        return switch (type) {
            case FACTURE -> "FAC";
            case DEVIS -> "DEV";
            default -> null;
        };
    }
}
