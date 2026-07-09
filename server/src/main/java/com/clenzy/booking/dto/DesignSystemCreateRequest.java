package com.clenzy.booking.dto;

/**
 * Création d'un système de design. {@code sourceType} pilote la source de la direction :
 * <ul>
 *   <li>{@code MANUAL} — {@code designMarkdown} et/ou {@code tokensJson} fournis directement.</li>
 *   <li>{@code BRAND}  — {@code brandDescription} → le LLM génère prose + tokens.</li>
 *   <li>{@code PASTE}  — {@code designMarkdown} (un DESIGN.md) collé → le LLM en dérive les tokens.</li>
 *   <li>{@code URL}    — {@code websiteUrl} analysée → prose + tokens.</li>
 * </ul>
 * {@code scope} : "GLOBAL" (staff plateforme) ou "ORG" (privé, défaut).
 */
public record DesignSystemCreateRequest(
    String name,
    String category,
    String description,
    String scope,
    String sourceType,
    String brandDescription,
    String websiteUrl,
    String designMarkdown,
    String tokensJson
) {}
