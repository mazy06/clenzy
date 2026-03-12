package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Requete de sauvegarde d'une cle API IA pour une organisation.
 *
 * @param provider       nom du provider ("openai" ou "anthropic")
 * @param apiKey         la cle API complete (sera chiffree cote serveur)
 * @param modelOverride  modele personnalise (optionnel, ex: "gpt-4o", "claude-sonnet-4-20250514")
 */
public record SaveAiApiKeyRequestDto(
        @NotBlank(message = "Le provider est requis")
        @Pattern(regexp = "^(openai|anthropic)$", message = "Provider invalide (openai ou anthropic)")
        String provider,

        @NotBlank(message = "La cle API est requise")
        String apiKey,

        String modelOverride
) {
}
