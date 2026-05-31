package com.clenzy.compliance.country;

import com.clenzy.model.DocumentType;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MoroccoComplianceStrategyTest {

    private final MoroccoComplianceStrategy strategy = new MoroccoComplianceStrategy();

    @Test
    void getCountryCode_returnsMA() {
        assertThat(strategy.getCountryCode()).isEqualTo("MA");
    }

    @Test
    void getStandardName_returnsDgi() {
        assertThat(strategy.getStandardName()).isEqualTo("DGI");
    }

    @Test
    void getDateFormatPattern_returnsDdMmYyyy() {
        assertThat(strategy.getDateFormatPattern()).isEqualTo("dd/MM/yyyy");
    }

    @Test
    void requiresLegalNumber_factureAndDevis_true() {
        assertThat(strategy.requiresLegalNumber(DocumentType.FACTURE)).isTrue();
        assertThat(strategy.requiresLegalNumber(DocumentType.DEVIS)).isTrue();
    }

    @Test
    void requiresLegalNumber_otherTypes_false() {
        assertThat(strategy.requiresLegalNumber(DocumentType.BON_INTERVENTION)).isFalse();
        assertThat(strategy.requiresLegalNumber(DocumentType.MANDAT_GESTION)).isFalse();
        assertThat(strategy.requiresLegalNumber(DocumentType.AUTORISATION_TRAVAUX)).isFalse();
    }

    @Test
    void getDefaultPrefix_factureReturnsFac() {
        assertThat(strategy.getDefaultPrefix(DocumentType.FACTURE)).isEqualTo("FAC");
    }

    @Test
    void getDefaultPrefix_devisReturnsDev() {
        assertThat(strategy.getDefaultPrefix(DocumentType.DEVIS)).isEqualTo("DEV");
    }

    @Test
    void getDefaultPrefix_otherType_returnsNull() {
        assertThat(strategy.getDefaultPrefix(DocumentType.BON_INTERVENTION)).isNull();
        assertThat(strategy.getDefaultPrefix(DocumentType.JUSTIFICATIF_PAIEMENT)).isNull();
    }

    @Test
    void resolveComplianceTags_factureContainsLegalNumberAndConditionsPaiement() {
        Map<String, Object> tags = strategy.resolveComplianceTags(DocumentType.FACTURE, "FAC-001");
        assertThat(tags).containsEntry("numero_legal", "FAC-001");
        assertThat(tags).containsKey("conditions_paiement");
        assertThat(tags.get("conditions_paiement").toString())
                .contains("Paiement a 30 jours");
    }

    @Test
    void resolveComplianceTags_devisContainsDureeValidite() {
        Map<String, Object> tags = strategy.resolveComplianceTags(DocumentType.DEVIS, "DEV-1");
        assertThat(tags).containsEntry("numero_legal", "DEV-1");
        assertThat(tags).containsKey("duree_validite");
        assertThat(tags.get("duree_validite").toString())
                .contains("30 jours");
    }

    @Test
    void resolveComplianceTags_nullLegalNumber_storedAsEmpty() {
        Map<String, Object> tags = strategy.resolveComplianceTags(DocumentType.FACTURE, null);
        assertThat(tags).containsEntry("numero_legal", "");
    }

    @Test
    void resolveComplianceTags_otherTypeDoesNotAddExtras() {
        Map<String, Object> tags = strategy.resolveComplianceTags(DocumentType.BON_INTERVENTION, "BI-7");
        assertThat(tags).containsEntry("numero_legal", "BI-7");
        assertThat(tags).doesNotContainKey("conditions_paiement");
        assertThat(tags).doesNotContainKey("duree_validite");
    }

    @Test
    void buildMentionTagMapping_containsFactureKeys() {
        Map<String, List<String>> mapping = strategy.buildMentionTagMapping();
        assertThat(mapping).containsKey("numero_facture");
        assertThat(mapping).containsKey("date_emission");
        assertThat(mapping).containsKey("identite_vendeur");
        assertThat(mapping).containsKey("identite_acheteur");
        assertThat(mapping).containsKey("montant_total");
        assertThat(mapping).containsKey("ice_vendeur");
        assertThat(mapping).containsKey("conditions_paiement");
    }

    @Test
    void buildMentionTagMapping_containsIceVendeurTag() {
        Map<String, List<String>> mapping = strategy.buildMentionTagMapping();
        assertThat(mapping.get("ice_vendeur"))
                .contains("entreprise.ice")
                .contains("${entreprise.ice}");
    }

    @Test
    void buildMentionTagMapping_devisAndInterventionMappings() {
        Map<String, List<String>> mapping = strategy.buildMentionTagMapping();
        assertThat(mapping).containsKey("numero_devis");
        assertThat(mapping).containsKey("duree_validite");
        assertThat(mapping).containsKey("identite_intervenant");
        assertThat(mapping).containsKey("description_travaux");
        assertThat(mapping).containsKey("date_intervention");
        // Order preserved (LinkedHashMap)
        assertThat(mapping.keySet().iterator().next()).isEqualTo("numero_facture");
    }
}
