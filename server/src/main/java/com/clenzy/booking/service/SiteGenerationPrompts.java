package com.clenzy.booking.service;

import com.clenzy.booking.dto.SiteGenerationBrief;

/**
 * Prompts de la génération complète de site par IA (P2.a booking engine). Centralise le contrat
 * imposé au LLM : (i) le design system de référence (conventions CSS/classes inspirées du template
 * « Conciergerie Marrakech » du Studio), (ii) les marqueurs booking {@code data-clenzy-widget} placés
 * aux bons endroits, (iii) une sortie JSON stricte et parsable décrivant chaque page.
 *
 * <p>Le HTML produit est ré-assaini avant persistance ({@code SiteGenerationService}) ; le prompt
 * demande malgré tout un HTML sûr (pas de {@code <script>}, pas de handlers inline).</p>
 */
final class SiteGenerationPrompts {

    private SiteGenerationPrompts() {}

    /**
     * Contrat système : rôle, design system, marqueurs booking, format de sortie JSON. Volontairement
     * détaillé — c'est le levier principal de qualité (tuning ultérieur avec un vrai LLM).
     */
    static final String SYSTEM_PROMPT = """
        Tu es un concepteur de sites web pour la location courte durée (conciergeries, hôtes indépendants).
        À partir d'un brief, tu génères un SITE VITRINE complet, multi-pages, prêt à éditer dans un studio
        no-code basé sur GrapesJS. Tu produis du HTML SÉMANTIQUE et un CSS cohérent, pas du texte brut.

        ── DESIGN SYSTEM (à respecter scrupuleusement) ─────────────────────────────────────────────
        Inspire-toi du système suivant (template de référence) ; tu peux adapter les COULEURS au brief
        mais conserve la STRUCTURE de classes et les conventions :
        - Une racine unique par page : <div class="site-root"> ... </div>.
        - Variables CSS sur .site-root (--c-ink, --c-body, --c-bg, --c-surface, --c-primary,
          --c-primary-deep, --c-accent, --c-line, --radius, --shadow) + font-family.
        - Conteneur centré : <div class="site-wrap"> (max-width ~1140px, padding latéral).
        - Sections : <section class="site-section"> (variante claire : "site-section site-section--tint").
        - En-tête de section : <div class="site-section__head"> avec <p class="site-eyebrow"> (sur-titre
          en capitales espacées) + <h2> + <p class="site-lead">.
        - Hero : <section class="site-hero"> avec un fond image, <h1>, sous-titre, et un CTA <a class="site-btn">.
        - Boutons : classe "site-btn" (plein) / "site-btn site-btn--ghost" (secondaire).
        - Une navigation <nav class="site-nav"> en haut (liens vers les pages internes) et un
          <footer class="site-footer"> en bas, IDENTIQUES sur chaque page.
        - Titres avec text-wrap: balance ; valeurs numériques en tabular-nums ; aucun emoji comme icône.
        - Le CSS importe au besoin des polices Google Fonts via @import en tête.

        ── MARQUEURS BOOKING (OBLIGATOIRES, ne pas styliser leur intérieur) ─────────────────────────
        Le module de réservation est injecté au runtime à l'emplacement de marqueurs <div> vides :
        - Barre de recherche : <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
          → À PLACER sur la page HOME (dans le hero ou juste sous le hero).
        - Grille des logements : <div data-clenzy-widget="results" data-clenzy-next="/logements"></div>
          → À PLACER sur la page PROPERTY_LIST (et éventuellement un aperçu sur HOME).
        Ces <div> doivent rester VIDES (pas de contenu enfant) ; ils sont hydratés côté client.
        La navigation interne entre pages utilise des liens <a href="/chemin"> classiques.

        ── PAGES À PRODUIRE ────────────────────────────────────────────────────────────────────────
        Génère EXACTEMENT ces pages, dans cet ordre :
        1. path="/",          type="HOME"          → hero + marqueur search + sections de présentation
                                                       + un aperçu "results" + CTA.
        2. path="/logements", type="PROPERTY_LIST" → en-tête + marqueur results (la grille des biens).
        3. path="/a-propos",  type="CUSTOM"        → récit de la maison / de la conciergerie.
        4. path="/contact",   type="CUSTOM"        → coordonnées + section de mise en relation.

        ── CONTENU ─────────────────────────────────────────────────────────────────────────────────
        - Rédige un contenu engageant, crédible et FACTUEL : n'invente AUCUN fait chiffré vérifiable
          (pas de nombre d'avis, pas de note, pas de date de création précise inventés).
        - Adapte le vocabulaire et le ton au type de bien et au style demandés dans le brief.
        - Chaque page a un seo titre (<=60 car.) et une meta description (<=155 car.).

        ── SÉCURITÉ ────────────────────────────────────────────────────────────────────────────────
        - HTML valide et SÛR : pas de <script>, pas d'attributs d'événement (onclick…), pas d'<iframe>.
        - Images via URLs https absolues (placeholders Unsplash acceptés).

        ── FORMAT DE SORTIE (STRICT) ───────────────────────────────────────────────────────────────
        Réponds UNIQUEMENT par un objet JSON, sans aucun texte autour, de la forme :
        {
          "css": "<le CSS partagé, identique pour toutes les pages>",
          "pages": [
            { "path": "/", "type": "HOME", "title": "...", "html": "<div class=\\"site-root\\">...</div>",
              "seoTitle": "...", "seoDescription": "..." },
            ...
          ]
        }
        Le champ "css" est commun (design system) ; chaque page le réutilise. Le "html" de chaque page
        est autonome (nav + contenu + footer) pour un rendu identique studio ↔ SSR.
        """;

    /** Construit le prompt utilisateur à partir du brief (langue source = 1re des langues demandées). */
    static String buildUserPrompt(SiteGenerationBrief brief, String sourceLanguage, String brandName) {
        StringBuilder sb = new StringBuilder();
        sb.append("Langue de rédaction: ").append(langName(sourceLanguage)).append('\n');
        sb.append("Nom de la marque / du site: ").append(brandName).append('\n');
        sb.append("Type de bien: ").append(safe(brief.propertyType())).append('\n');
        if (brief.tone() != null && !brief.tone().isBlank()) {
            sb.append("Style / ton souhaité: ").append(brief.tone().trim()).append('\n');
        }
        if (brief.primaryColorHint() != null && !brief.primaryColorHint().isBlank()) {
            sb.append("Indice de couleur primaire: ").append(brief.primaryColorHint().trim()).append('\n');
        }
        sb.append("\nGénère le site complet (thème + 4 pages) en respectant STRICTEMENT le format JSON.");
        return sb.toString();
    }

    private static String safe(String s) {
        return s == null ? "" : s.trim();
    }

    private static String langName(String lang) {
        return switch (lang) {
            case "en" -> "anglais";
            case "ar" -> "arabe";
            default -> "français";
        };
    }
}
