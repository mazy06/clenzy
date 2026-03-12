package com.clenzy.dto;

import java.time.LocalDateTime;

/**
 * Status d'une cle API IA pour un provider donne.
 * Retourne au frontend — la cle complete n'est jamais exposee.
 *
 * @param provider          nom du provider ("openai" ou "anthropic")
 * @param configured        true si l'org a sa propre cle configuree
 * @param maskedApiKey      cle masquee (ex: "****abcd"), null si pas de cle org
 * @param modelOverride     modele personnalise (null si defaut)
 * @param valid             true si la cle a ete validee avec succes
 * @param lastValidatedAt   date de derniere validation
 * @param source            "PLATFORM" ou "ORGANIZATION"
 */
public record OrgAiApiKeyStatusDto(
        String provider,
        boolean configured,
        String maskedApiKey,
        String modelOverride,
        boolean valid,
        LocalDateTime lastValidatedAt,
        String source
) {
    /**
     * Factory pour un provider sans cle org (utilise la cle plateforme).
     */
    public static OrgAiApiKeyStatusDto platformDefault(String provider) {
        return new OrgAiApiKeyStatusDto(provider, false, null, null, false, null, "PLATFORM");
    }
}
