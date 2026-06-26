package com.clenzy.dto;

/**
 * Une entrée du catalogue live d'un provider : l'ID du modèle + une CATÉGORIE
 * dérivée de l'ID (heuristique).
 *
 * <p>Les endpoints {@code /v1/models} (OpenAI-compatible / Anthropic) ne renvoient
 * que des IDs — pas les tags affichés sur build.nvidia.com (API site non
 * officielle). On classe donc l'ID en catégorie pour guider le choix du modèle
 * par agent : {@code chat}, {@code reasoning}, {@code code}, {@code vision},
 * {@code ocr}, {@code embedding}, {@code rerank}, {@code audio}, {@code image},
 * {@code safety}, {@code other}.</p>
 */
public record AiCatalogModelDto(String id, String category) {}
