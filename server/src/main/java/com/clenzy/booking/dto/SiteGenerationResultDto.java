package com.clenzy.booking.dto;

import java.util.List;

/**
 * Résumé renvoyé par {@code SiteGenerationService.generateSite} : les pages créées (en BROUILLON) et si
 * un thème a été dérivé et appliqué. Aucune entité JPA exposée (audit règle #5) — uniquement ce résumé.
 *
 * @param pagesCreated  pages générées et persistées en {@code DRAFT} ({@code ai_generated=true}).
 * @param themeApplied  {@code true} si des design tokens ont été dérivés du brief et appliqués au site.
 */
public record SiteGenerationResultDto(
    List<GeneratedPageSummary> pagesCreated,
    boolean themeApplied
) {
    /** Résumé d'une page générée (pas l'entité). */
    public record GeneratedPageSummary(
        Long id,
        String path,
        String type,
        String title,
        String status
    ) {}
}
