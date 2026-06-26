package com.clenzy.dto;

/**
 * Requête pour lister le catalogue LIVE d'un provider (GET /models).
 *
 * <p>Permet à « Add a model » de proposer les IDs réellement servis au lieu d'un
 * champ texte libre (→ on ne configure que des modèles existants).</p>
 *
 * <p>{@code apiKey} optionnel : si absent, on réutilise la clé d'un modèle déjà
 * configuré pour ce provider (utile en édition où la clé est masquée).</p>
 */
public record ProviderCatalogRequest(String provider, String apiKey, String baseUrl) {}
