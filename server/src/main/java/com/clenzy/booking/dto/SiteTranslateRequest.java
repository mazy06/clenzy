package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Corps de la traduction IA d'un fragment HTML de page (Studio multi-langue, P2). Le client envoie le
 * HTML de la page SOURCE (langue par défaut) et la langue cible ; le serveur traduit le texte visible
 * en préservant la structure (cf. {@code SiteContentAiService.translatePageHtml}).
 */
public record SiteTranslateRequest(
    @NotBlank @Size(max = 200_000) String html,
    @NotBlank @Size(max = 8) String targetLocale
) {}
