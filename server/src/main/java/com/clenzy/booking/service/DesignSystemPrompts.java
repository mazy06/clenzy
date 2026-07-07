package com.clenzy.booking.service;

/**
 * Prompts de génération d'un {@link com.clenzy.booking.model.DesignSystem} par IA. Le LLM produit une
 * DIRECTION de design : un {@code DESIGN.md} en prose (atmosphère, palette & rôles, typo, layout,
 * composants, motion, iconographie, VOIX & TON, cas limites) + le contrat de tokens {@code --bt-*}.
 * Un seul prompt système, trois modes d'entrée (marque / site web / DESIGN.md collé).
 */
final class DesignSystemPrompts {

    private DesignSystemPrompts() {}

    static final int MAX_TOKENS = 8000;

    static final String SYSTEM_PROMPT = """
        Tu es un directeur artistique. Tu produis un SYSTÈME DE DESIGN pour un site vitrine de réservation
        de location courte durée (conciergeries, hôtes). Réponds UNIQUEMENT par un objet JSON strict, sans
        aucun texte autour, de la forme :
        {
          "designMarkdown": "<un DESIGN.md complet en Markdown>",
          "tokens": { "--bt-color-primary": "<hex>", ... }
        }

        ── designMarkdown (la DIRECTION, en prose — c'est ce qui rend le rendu distinctif) ──
        Un vrai DESIGN.md : un titre H1 (nom de la direction), une citation « > Catégorie : … » + pitch en
        une phrase, puis des sections H2 numérotées :
        ## 1. Thème visuel & atmosphère
        ## 2. Palette de couleurs & rôles
        ## 3. Typographie
        ## 4. Layout & espacement
        ## 5. Composants
        ## 6. Motion & interaction
        ## 7. Iconographie & imagerie
        ## 8. Voix & ton
        ## 9. Cas limites & variations
        Sois concret et évocateur (matières, ambiance, registre de langue), pas générique.

        ── tokens (contrat --bt-*, cohérent avec la direction) ──
        Pose TOUTES ces clés, chaque valeur = une valeur CSS SIMPLE (pas de ';' ni '{}' ni 'url()') :
        --bt-color-primary, --bt-color-primary-hover, --bt-color-on-primary, --bt-color-accent,
        --bt-color-bg, --bt-color-surface, --bt-color-surface-2, --bt-color-text, --bt-color-text-muted,
        --bt-color-border, --bt-color-divider,
        --bt-font-heading, --bt-font-body,
        --bt-text-xs, --bt-text-sm, --bt-text-md, --bt-text-lg, --bt-text-xl, --bt-text-2xl, --bt-text-3xl,
        --bt-weight-normal, --bt-weight-medium, --bt-weight-semibold, --bt-weight-bold, --bt-heading-weight,
        --bt-leading-tight, --bt-leading-normal, --bt-leading-relaxed,
        --bt-tracking-tight, --bt-tracking-normal, --bt-tracking-wide,
        --bt-space-1, --bt-space-2, --bt-space-3, --bt-space-4, --bt-space-5, --bt-space-6,
        --bt-section-y, --bt-container,
        --bt-radius-sm, --bt-radius-md, --bt-radius-lg, --bt-radius-pill,
        --bt-radius-button, --bt-radius-card, --bt-radius-input,
        --bt-shadow-sm, --bt-shadow-md, --bt-shadow-lg, --bt-shadow-card, --bt-border-width,
        --bt-button-padding-x, --bt-button-padding-y, --bt-button-transform, --bt-control-height,
        --bt-duration, --bt-ease.
        Jamais de #000 ni #fff purs : teinte vers la couleur de marque.
        """;

    /**
     * Prompt COMBINÉ (modèle open-design) : agrège TOUT le contexte fourni — marque, DESIGN.md collé,
     * HTML/CSS d'un site — en une seule synthèse. Chaque source non vide est incluse ; l'IA les combine
     * sans en ignorer aucune. Les réglages manuels (tokens) sont appliqués APRÈS, côté service.
     */
    static String buildCombined(String brand, String html, String css, String markdown) {
        StringBuilder sb = new StringBuilder();
        sb.append("Compose UN système de design cohérent à partir de TOUT le contexte fourni ci-dessous ")
          .append("(combine les sources, n'en ignore aucune) :\n\n");
        if (!safe(brand).isBlank()) {
            sb.append("── MARQUE (voix, contexte, positionnement) ──\n").append(brand.trim()).append("\n\n");
        }
        if (!safe(markdown).isBlank()) {
            sb.append("── DESIGN.md fourni (à respecter et normaliser) ──\n").append(markdown.trim()).append("\n\n");
        }
        if (!safe(html).isBlank()) {
            sb.append("── SITE — HTML (capture la direction visuelle : couleurs, typo, ambiance) ──\n")
              .append(truncate(html, 16000)).append("\n\n");
        }
        if (!safe(css).isBlank()) {
            sb.append("── SITE — CSS ──\n").append(truncate(css, 12000)).append("\n\n");
        }
        sb.append("Respecte STRICTEMENT le format JSON.");
        return sb.toString();
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
