package com.clenzy.dto;

import java.util.Map;

/**
 * DTO regroupant les 3 langues d'un meme template par {@code templateKey}.
 *
 * <p>Format consomme par l'UI Documents > Templates WhatsApp pour afficher
 * une ligne par template-concept avec ses 3 colonnes/onglets de langue.</p>
 *
 * @param templateKey  cle logique commune aux 3 langues
 * @param category     categorie Meta (heritee, identique pour les 3 langues)
 * @param isCustomized true si AU MOINS UNE des 3 langues est un override per-org
 *                     (les autres peuvent rester en defaut systeme). Permet le badge UI
 *                     "Personnalise" vs "Systeme" sans descendre dans le detail.
 * @param languages    map locale → contenu (fr_FR, en_US, ar_AR)
 */
public record WhatsAppTemplateGroupDto(
    String templateKey,
    String category,
    boolean isCustomized,
    Map<String, WhatsAppTemplateContentDto> languages
) {}
