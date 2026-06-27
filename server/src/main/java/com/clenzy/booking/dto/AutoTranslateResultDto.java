package com.clenzy.booking.dto;

import java.util.List;

/**
 * Résultat d'une auto-traduction IA (P1) : les variantes localisées créées EN BROUILLON (DRAFT,
 * {@code aiGenerated=true}) pour relecture, et les locales ignorées (variante déjà existante ou locale
 * source). Jamais publié automatiquement : l'exploitant relit puis publie (cf. workflow blog 2.13).
 *
 * @param createdPages variantes de page créées (vide si la cible est un article)
 * @param createdPosts variantes d'article créées (vide si la cible est une page)
 * @param skippedLocales locales cibles ignorées (déjà traduites / == source)
 */
public record AutoTranslateResultDto(
    List<SitePageDto> createdPages,
    List<BlogPostDto> createdPosts,
    List<String> skippedLocales
) {
    public static AutoTranslateResultDto forPages(List<SitePageDto> created, List<String> skipped) {
        return new AutoTranslateResultDto(created, List.of(), skipped);
    }

    public static AutoTranslateResultDto forPosts(List<BlogPostDto> created, List<String> skipped) {
        return new AutoTranslateResultDto(List.of(), created, skipped);
    }
}
