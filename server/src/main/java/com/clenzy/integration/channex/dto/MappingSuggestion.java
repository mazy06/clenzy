package com.clenzy.integration.channex.dto;

/**
 * Suggestion d'appariement entre une propriété Clenzy non-mappée et une propriété Channex
 * non-mappée (CLZ Domaine 1 / mapping). Aide l'admin à créer le mapping sans saisie manuelle.
 *
 * @param clenzyPropertyId  id de la propriété Clenzy
 * @param clenzyName        nom de la propriété Clenzy
 * @param channexPropertyId id de la propriété Channex
 * @param channexTitle      titre de la propriété Channex
 * @param confidence        "HIGH" (nom identique normalisé) ou "MEDIUM" (correspondance partielle)
 * @param reason            justification lisible
 */
public record MappingSuggestion(
    Long clenzyPropertyId,
    String clenzyName,
    String channexPropertyId,
    String channexTitle,
    String confidence,
    String reason
) {
}
