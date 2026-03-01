package com.clenzy.compliance;

import com.clenzy.model.DocumentType;

import java.util.List;
import java.util.Map;

/**
 * Interface Strategy pour la conformite reglementaire par pays.
 * Chaque pays implemente ses propres regles de conformite documentaire.
 *
 * Implementations :
 * - FranceComplianceStrategy  : NF 525 (numerotation sequentielle, mentions legales, immutabilite)
 * - MoroccoComplianceStrategy : DGI (ICE, mentions legales marocaines)
 * - SaudiComplianceStrategy   : ZATCA Phase 1 (e-invoicing simplifie, QR code)
 */
public interface CountryComplianceStrategy {

    /**
     * Code ISO 3166-1 alpha-2 du pays (FR, MA, SA).
     */
    String getCountryCode();

    /**
     * Nom lisible de la norme de conformite (ex: "NF 525", "DGI", "ZATCA").
     */
    String getStandardName();

    /**
     * Resout les tags de conformite a injecter dans le contexte de generation de document.
     * Ces tags sont accessibles dans les templates via ${nf.*}.
     *
     * @param type        Type de document
     * @param legalNumber Numero legal genere (peut etre null)
     * @return Map des tags de conformite
     */
    Map<String, Object> resolveComplianceTags(DocumentType type, String legalNumber);

    /**
     * Construit le mapping mention legale → tags attendus dans le template.
     * Utilise par checkTemplateCompliance() pour verifier que le template
     * contient les tags correspondant aux mentions obligatoires.
     *
     * @return Map cle_mention → liste de tags acceptes
     */
    Map<String, List<String>> buildMentionTagMapping();

    /**
     * Pattern de format de date utilise pour les documents dans ce pays.
     * Ex: "dd/MM/yyyy" (FR, MA), "yyyy-MM-dd" (SA/ZATCA).
     */
    String getDateFormatPattern();

    /**
     * Determine si un type de document requiert une numerotation legale dans ce pays.
     */
    boolean requiresLegalNumber(DocumentType type);

    /**
     * Retourne le prefixe par defaut pour un type de document.
     * Peut etre override par FiscalProfile.invoicePrefix.
     *
     * @return Prefixe (ex: "FAC", "DEV") ou null si pas de numerotation
     */
    String getDefaultPrefix(DocumentType type);
}
