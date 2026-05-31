package com.clenzy.compliance.country;

import com.clenzy.model.DocumentType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires pour {@link SaudiComplianceStrategy} (ZATCA Phase 1).
 *
 * <h2>Focus</h2>
 * <ul>
 *   <li>Identite : code pays SA, standard ZATCA</li>
 *   <li>Format date ISO 8601</li>
 *   <li>Numerotation legale requise UNIQUEMENT pour FACTURE</li>
 *   <li>Prefix par defaut INV (FACTURE), null pour les autres</li>
 *   <li>Tags de conformite incluent numero_legal + conditions_paiement (FACTURE)</li>
 *   <li>Mention -> tag mapping pour factures et devis</li>
 * </ul>
 */
class SaudiComplianceStrategyTest {

    private final SaudiComplianceStrategy strategy = new SaudiComplianceStrategy();

    @Test
    @DisplayName("getCountryCode returns SA")
    void getCountryCode_returnsSA() {
        assertThat(strategy.getCountryCode()).isEqualTo("SA");
    }

    @Test
    @DisplayName("getStandardName returns ZATCA")
    void getStandardName_returnsZatca() {
        assertThat(strategy.getStandardName()).isEqualTo("ZATCA");
    }

    @Test
    @DisplayName("getDateFormatPattern returns ISO 8601 (yyyy-MM-dd)")
    void getDateFormatPattern_returnsIsoFormat() {
        assertThat(strategy.getDateFormatPattern()).isEqualTo("yyyy-MM-dd");
    }

    @Test
    @DisplayName("requiresLegalNumber returns true ONLY for FACTURE")
    void requiresLegalNumber_factureOnly() {
        assertThat(strategy.requiresLegalNumber(DocumentType.FACTURE)).isTrue();
        assertThat(strategy.requiresLegalNumber(DocumentType.DEVIS)).isFalse();
        assertThat(strategy.requiresLegalNumber(DocumentType.MANDAT_GESTION)).isFalse();
        assertThat(strategy.requiresLegalNumber(DocumentType.AUTORISATION_TRAVAUX)).isFalse();
        assertThat(strategy.requiresLegalNumber(DocumentType.BON_INTERVENTION)).isFalse();
        assertThat(strategy.requiresLegalNumber(DocumentType.VALIDATION_FIN_MISSION)).isFalse();
        assertThat(strategy.requiresLegalNumber(DocumentType.JUSTIFICATIF_PAIEMENT)).isFalse();
        assertThat(strategy.requiresLegalNumber(DocumentType.JUSTIFICATIF_REMBOURSEMENT)).isFalse();
        assertThat(strategy.requiresLegalNumber(DocumentType.BON_COMMANDE)).isFalse();
    }

    @Test
    @DisplayName("getDefaultPrefix returns INV for FACTURE, null for others")
    void getDefaultPrefix_factureReturnsInv_othersNull() {
        assertThat(strategy.getDefaultPrefix(DocumentType.FACTURE)).isEqualTo("INV");
        assertThat(strategy.getDefaultPrefix(DocumentType.DEVIS)).isNull();
        assertThat(strategy.getDefaultPrefix(DocumentType.MANDAT_GESTION)).isNull();
        assertThat(strategy.getDefaultPrefix(DocumentType.BON_INTERVENTION)).isNull();
        assertThat(strategy.getDefaultPrefix(DocumentType.JUSTIFICATIF_PAIEMENT)).isNull();
        assertThat(strategy.getDefaultPrefix(DocumentType.BON_COMMANDE)).isNull();
    }

    @Test
    @DisplayName("resolveComplianceTags FACTURE includes numero_legal and conditions_paiement")
    void resolveComplianceTags_facture_includesConditionsPaiement() {
        Map<String, Object> tags = strategy.resolveComplianceTags(DocumentType.FACTURE, "INV-2026-001");

        assertThat(tags).containsEntry("numero_legal", "INV-2026-001");
        assertThat(tags).containsKey("conditions_paiement");
        assertThat(tags.get("conditions_paiement").toString()).contains("Payment due upon receipt");
    }

    @Test
    @DisplayName("resolveComplianceTags FACTURE with null legalNumber uses empty string")
    void resolveComplianceTags_facture_nullLegalNumber_emptyString() {
        Map<String, Object> tags = strategy.resolveComplianceTags(DocumentType.FACTURE, null);

        assertThat(tags).containsEntry("numero_legal", "");
        assertThat(tags).containsKey("conditions_paiement");
    }

    @Test
    @DisplayName("resolveComplianceTags DEVIS does NOT add conditions_paiement")
    void resolveComplianceTags_devis_noConditionsPaiement() {
        Map<String, Object> tags = strategy.resolveComplianceTags(DocumentType.DEVIS, "DEV-001");

        assertThat(tags).containsEntry("numero_legal", "DEV-001");
        assertThat(tags).doesNotContainKey("conditions_paiement");
    }

    @Test
    @DisplayName("resolveComplianceTags non-FACTURE document includes only numero_legal")
    void resolveComplianceTags_otherDocumentType_onlyNumeroLegal() {
        Map<String, Object> tags = strategy.resolveComplianceTags(DocumentType.BON_INTERVENTION, "BI-001");

        assertThat(tags).containsEntry("numero_legal", "BI-001");
        assertThat(tags).doesNotContainKey("conditions_paiement");
        assertThat(tags).hasSize(1);
    }

    @Test
    @DisplayName("buildMentionTagMapping contains all expected facture mentions")
    void buildMentionTagMapping_factureMentions() {
        Map<String, List<String>> mapping = strategy.buildMentionTagMapping();

        assertThat(mapping).containsKey("numero_facture");
        assertThat(mapping).containsKey("date_emission");
        assertThat(mapping).containsKey("identite_vendeur");
        assertThat(mapping).containsKey("identite_acheteur");
        assertThat(mapping).containsKey("designation_prestations");
        assertThat(mapping).containsKey("montant_total");
        assertThat(mapping).containsKey("vat_number");
        assertThat(mapping).containsKey("qr_code");
    }

    @Test
    @DisplayName("buildMentionTagMapping contains all expected devis mentions")
    void buildMentionTagMapping_devisMentions() {
        Map<String, List<String>> mapping = strategy.buildMentionTagMapping();

        assertThat(mapping).containsKey("numero_devis");
        assertThat(mapping).containsKey("duree_validite");
    }

    @Test
    @DisplayName("buildMentionTagMapping numero_facture maps to legal number tags")
    void buildMentionTagMapping_numeroFactureTagList() {
        Map<String, List<String>> mapping = strategy.buildMentionTagMapping();

        List<String> tags = mapping.get("numero_facture");
        assertThat(tags).contains("nf.numero_legal", "${nf.numero_legal}");
    }

    @Test
    @DisplayName("buildMentionTagMapping date_emission maps to date + system.date alternatives")
    void buildMentionTagMapping_dateEmission_acceptsMultipleSources() {
        Map<String, List<String>> mapping = strategy.buildMentionTagMapping();

        List<String> tags = mapping.get("date_emission");
        assertThat(tags).contains("nf.date_emission", "system.date",
                "${nf.date_emission}", "${system.date}");
    }

    @Test
    @DisplayName("buildMentionTagMapping vat_number maps to entreprise vat tags")
    void buildMentionTagMapping_vatNumber() {
        Map<String, List<String>> mapping = strategy.buildMentionTagMapping();

        List<String> tags = mapping.get("vat_number");
        assertThat(tags).contains("entreprise.vat_number", "${entreprise.vat_number}");
    }

    @Test
    @DisplayName("buildMentionTagMapping qr_code is mapped (Phase 1 optional)")
    void buildMentionTagMapping_qrCode_isMappedOptional() {
        Map<String, List<String>> mapping = strategy.buildMentionTagMapping();

        List<String> tags = mapping.get("qr_code");
        assertThat(tags).contains("nf.qr_code", "${nf.qr_code}");
    }

    @Test
    @DisplayName("buildMentionTagMapping is not modifying the same instance per call (stateless contract)")
    void buildMentionTagMapping_isStateless() {
        Map<String, List<String>> mapping1 = strategy.buildMentionTagMapping();
        Map<String, List<String>> mapping2 = strategy.buildMentionTagMapping();

        // Equal content but not necessarily same instance (LinkedHashMap built each call)
        assertThat(mapping1).isEqualTo(mapping2);
    }
}
