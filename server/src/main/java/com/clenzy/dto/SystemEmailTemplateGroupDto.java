package com.clenzy.dto;

import java.util.Map;

/**
 * Regroupe les langues d'un meme template par {@code templateKey} pour l'UI.
 *
 * @param templateKey   cle logique commune
 * @param recipientType OWNER | GUEST | INTERNAL_TEAM | INVITED_USER (heritage)
 * @param isCustomized  true si l'org a au moins 1 override (badge "Personnalise")
 * @param languages     map locale → contenu (typiquement {fr: ..., en: ..., ar: ...})
 */
public record SystemEmailTemplateGroupDto(
    String templateKey,
    String recipientType,
    boolean isCustomized,
    Map<String, SystemEmailTemplateDto> languages
) {}
