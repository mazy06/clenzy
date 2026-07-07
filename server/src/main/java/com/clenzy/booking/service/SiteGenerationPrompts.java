package com.clenzy.booking.service;

import com.clenzy.booking.dto.SiteGenerationBrief;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Prompts de la génération complète de site par IA (P2.a booking engine). Centralise le contrat
 * imposé au LLM : (i) le design system de référence (conventions CSS/classes inspirées du template
 * « Conciergerie Marrakech » du Studio), (ii) les marqueurs booking {@code data-clenzy-widget} placés
 * aux bons endroits, (iii) une sortie JSON stricte et parsable décrivant chaque page.
 *
 * <p>Les pages produites ne sont PLUS figées : le brief ({@link SiteGenerationBrief#pages()}) pilote le
 * set généré, dérivé du {@link #PAGE_CATALOG} (clé → chemin / type / rôle). Un brief sans pages retombe
 * sur le set par défaut ({@link #DEFAULT_PAGES}).</p>
 *
 * <p>Le HTML produit est ré-assaini avant persistance ({@code SiteGenerationService}) ; le prompt
 * demande malgré tout un HTML sûr (pas de {@code <script>}, pas de handlers inline).</p>
 */
final class SiteGenerationPrompts {

    private SiteGenerationPrompts() {}

    /** Spécification d'une page du catalogue : chemin public, type {@code SitePageType}, rôle (prompt). */
    record PageSpec(String path, String type, String description) {}

    /**
     * Catalogue des pages générables (clé stable → spec). L'ordre d'insertion sert de repli d'affichage ;
     * l'ordre RÉEL de génération suit l'ordre des clés du brief.
     */
    static final Map<String, PageSpec> PAGE_CATALOG = buildCatalog();

    private static Map<String, PageSpec> buildCatalog() {
        Map<String, PageSpec> m = new LinkedHashMap<>();
        m.put("accueil", new PageSpec("/", "HOME",
            "hero OBLIGATOIRE avec <h1> (nom de marque), sous-titre et CTA, PUIS sections de présentation ; "
                + "place le marqueur \"search\" dans/sous le hero et un aperçu \"results\". La page DOIT contenir "
                + "du vrai texte rédactionnel — JAMAIS uniquement des marqueurs widget"));
        m.put("logements", new PageSpec("/logements", "PROPERTY_LIST",
            "en-tête + le marqueur \"results\" (grille des biens)"));
        m.put("a-propos", new PageSpec("/a-propos", "CUSTOM",
            "récit de la maison / de la conciergerie"));
        m.put("contact", new PageSpec("/contact", "CUSTOM",
            "coordonnées + section de mise en relation"));
        m.put("blog", new PageSpec("/blog", "BLOG",
            "liste d'articles / actualités en cartes (sans dates inventées)"));
        m.put("faq", new PageSpec("/faq", "CUSTOM",
            "questions fréquentes (titres + réponses concises)"));
        m.put("avis", new PageSpec("/avis", "CUSTOM",
            "témoignages clients (sans note chiffrée ni nombre d'avis inventés)"));
        m.put("galerie", new PageSpec("/galerie", "CUSTOM",
            "galerie photos en grille (images Unsplash placeholder)"));
        m.put("experiences", new PageSpec("/experiences", "CUSTOM",
            "expériences & activités locales à proximité"));
        m.put("tarifs", new PageSpec("/tarifs", "CUSTOM",
            "formules / informations tarifaires (sans prix chiffré inventé)"));
        return m;
    }

    /** Titre PROPRE par chemin (override du titre verbeux que le LLM dérive parfois du brief). */
    private static final Map<String, String> CLEAN_TITLES = Map.ofEntries(
        Map.entry("/", "Accueil"),
        Map.entry("/logements", "Nos logements"),
        Map.entry("/a-propos", "À propos"),
        Map.entry("/contact", "Contact"),
        Map.entry("/blog", "Blog"),
        Map.entry("/faq", "FAQ"),
        Map.entry("/avis", "Avis"),
        Map.entry("/galerie", "Galerie"),
        Map.entry("/experiences", "Expériences"),
        Map.entry("/tarifs", "Tarifs"));

    /** Titre court et propre pour {@code path} (catalogue) ; sinon {@code fallback} (titre LLM). */
    static String cleanTitle(String path, String fallback) {
        return path != null && CLEAN_TITLES.containsKey(path) ? CLEAN_TITLES.get(path) : fallback;
    }

    /** Set par défaut quand le brief ne précise pas de pages (comportement historique). */
    static final List<String> DEFAULT_PAGES = List.of("accueil", "logements", "a-propos", "contact");

    /**
     * Contrat système : rôle, design system, marqueurs booking, format de sortie JSON. Volontairement
     * détaillé — c'est le levier principal de qualité (tuning ultérieur avec un vrai LLM). Les pages à
     * produire sont listées dans le prompt utilisateur (section « PAGES À PRODUIRE »), pas ici.
     */
    static final String SYSTEM_PROMPT = """
        Tu es un concepteur de sites web pour la location courte durée (conciergeries, hôtes indépendants).
        À partir d'un brief, tu génères un SITE VITRINE complet, multi-pages, prêt à éditer dans un studio
        no-code basé sur GrapesJS. Tu produis du HTML SÉMANTIQUE et un CSS cohérent, pas du texte brut.

        ── DESIGN SYSTEM (à respecter scrupuleusement) ─────────────────────────────────────────────
        Tu définis D'ABORD un SYSTÈME DE DESIGN COMPLET en variables CSS (objet "designVars" du format de
        sortie : couleurs + rôles, échelle typographique, graisses, interlignes, tracking, espacements,
        rayons, ombres, bordures, boutons/contrôles, transitions) PUIS tu l'appliques PARTOUT. Pose TOUTES
        ces variables `--bt-*` sur .site-root et UTILISE-les dans tout le CSS (couleurs, tailles de police,
        paddings, gaps, rayons, ombres, transitions…) — n'écris JAMAIS une valeur en dur quand un token
        existe. CE MÊME contrat `--bt-*` habille aussi les widgets de réservation → cohérence visuelle
        TOTALE pages ↔ widgets (exigée).
        RÈGLE CRITIQUE — ZÉRO STYLE INLINE : n'utilise JAMAIS l'attribut style="..." dans le HTML. L'éditeur
        no-code (GrapesJS) SUPPRIME les styles inline à l'import → fonds image, couleurs et mises en page
        seraient perdus (site cassé en édition manuelle). TOUT le style — FONDS IMAGE COMPRIS — vit dans le
        "css" via des CLASSES. Le HTML ne porte que des attributs `class` (et href/src/data-*).
        Conserve la STRUCTURE de classes :
        - Une racine unique par page : <div class="site-root"> ... </div>, portant TOUTES les variables `--bt-*`.
        - Conteneur centré : <div class="site-wrap"> (max-width ~1140px, padding latéral).
        - Sections : <section class="site-section"> (variante claire : "site-section site-section--tint").
        - En-tête de section : <div class="site-section__head"> avec <p class="site-eyebrow"> (sur-titre
          en capitales espacées) + <h2> + <p class="site-lead">.
        - Hero : <section class="site-hero site-hero--{page}"> (h1 + sous-titre + CTA <a class="site-btn">). Le
          FOND IMAGE du hero est défini DANS le "css" via la classe modificatrice (ex.
          `.site-hero--accueil{ background-image: linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.45)), url('...'); }`
          avec overlay sombre pour la lisibilité du texte clair) — JAMAIS en style inline. Varie l'image par
          page via `--{page}` (accueil, logements, a-propos…).
        - Boutons : classe "site-btn" (plein) / "site-btn site-btn--ghost" (secondaire).
        - Une navigation <nav class="site-nav"> en haut (liens vers les pages internes RÉELLEMENT générées)
          et un <footer class="site-footer"> en bas, IDENTIQUES sur chaque page.
        - Titres avec text-wrap: balance ; valeurs numériques en tabular-nums ; aucun emoji comme icône.
        - Le CSS importe au besoin des polices Google Fonts via @import en tête.

        ── MARQUEURS BOOKING (le module de réservation est injecté au runtime) ──────────────────────
        Place ces <div> VIDES (jamais de contenu enfant ; hydratés côté client) UNIQUEMENT là où c'est
        pertinent selon les pages demandées :
        - Barre de recherche : <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
          → sur la page de type HOME (dans le hero ou juste sous le hero), si une telle page est demandée.
        - Grille des logements : <div data-clenzy-widget="results" data-clenzy-next="/logements"></div>
          → sur la page de type PROPERTY_LIST, si demandée (et éventuellement un aperçu sur la HOME).
        IMPORTANT : un marqueur widget est TOUJOURS entouré de texte rédactionnel — il ne constitue JAMAIS le
        seul contenu d'une page. La HOME en particulier COMMENCE par un hero <h1> + sous-titre + CTA (texte réel).
        Si ni HOME ni PROPERTY_LIST ne sont demandées, n'inclus aucun marqueur. La navigation interne
        utilise des liens <a href="/chemin"> classiques (uniquement vers des pages réellement générées).

        ── PAGES ───────────────────────────────────────────────────────────────────────────────────
        Génère EXACTEMENT les pages listées dans la section « PAGES À PRODUIRE » du brief, dans l'ordre
        indiqué, en respectant pour chacune son `path`, son `type` et le rôle décrit. N'ajoute ni ne
        retire aucune page.

        ── RICHESSE & SECTIONS (obligatoire — un site premium, pas une page nue) ────────────────────
        Chaque page comporte PLUSIEURS sections VARIÉES (pas seulement un hero + un widget). Vise 5–7
        sections par page, avec une alternance visuelle (fonds clairs / teintés, pleine largeur / colonnes).
        Compose selon la page et le brief à partir de :
        - Hero immersif (fond image en classe + overlay + h1 + sous-titre + CTA).
        - Présentation / récit (2–3 paragraphes, souvent en 2 colonnes texte + image).
        - Grille d'atouts / services : 3–4 cartes `.site-card` (titre + court texte, sans emoji).
        - Galerie d'images : grille responsive 2–3 colonnes `.site-gallery` (utilise les images fournies).
        - Repères SANS invention (ex. « check-in autonome », « conciergerie 7j/7 ») en pastilles `.site-pills`.
        - Témoignages : 2–3 citations `.site-quote` (sans note ni nombre d'avis inventés).
        - FAQ : 3–5 questions/réponses concises `.site-faq`.
        - Bandeau CTA final `.site-cta` + `<footer class="site-footer">` riche (liens de nav, contact, mentions).
        CSS RICHE et responsive OBLIGATOIRE : CSS Grid / Flexbox pour grilles et colonnes ; media-queries
        (mobile ≤ 640px → colonnes empilées) ; états `:hover` sur cartes et boutons ; images en
        `object-fit: cover` ; transitions via `--bt-duration`/`--bt-ease`. Le tout piloté par les `--bt-*`.
        La HOME contient AU MINIMUM : hero + présentation + grille d'atouts + galerie + (témoignages OU FAQ)
        + bandeau CTA + footer.

        ── CONTENU ─────────────────────────────────────────────────────────────────────────────────
        - Rédige un contenu engageant, crédible et FACTUEL : n'invente AUCUN fait chiffré vérifiable
          (pas de nombre d'avis, pas de note, pas de date de création précise inventés).
        - Adapte le vocabulaire et le ton au type de bien, à la clientèle, au niveau de gamme et au
          style demandés dans le brief ; mets en avant les points forts fournis.
        - Chaque page a un seo titre (<=60 car.) et une meta description (<=155 car.).

        ── SÉCURITÉ ────────────────────────────────────────────────────────────────────────────────
        - HTML valide et SÛR : pas de <script>, pas d'attributs d'événement (onclick…), pas d'<iframe>.
        - Images : si des « IMAGES RÉELLES DES LOGEMENTS » sont fournies dans le brief, UTILISE-LES en PRIORITÉ
          (fond du hero, galerie, cartes) ; sinon des placeholders Unsplash https absolus. TOUJOURS via une
          classe CSS dans le "css" (background-image ou <img class="..." src="...">), JAMAIS en style inline.

        ── EXEMPLE DE STYLE (à imiter, PAS à recopier) ───────────────────────────────────────────────
        Squelette attendu d'une page HOME (à adapter au brief : marque, ville, copie, sections) —
        respecte ces classes et l'emplacement des marqueurs :
        <div class="site-root">
          <nav class="site-nav"><div class="site-wrap"><a href="/">{Marque}</a><a href="/logements">Logements</a><a href="/contact">Contact</a></div></nav>
          <section class="site-hero site-hero--accueil">
            <div class="site-wrap"><h1>{Titre accrocheur}</h1><p>{sous-titre}</p>
              <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
              <a class="site-btn" href="/logements">{CTA aligné sur l'objectif}</a></div>
          </section>
          <section class="site-section site-section--tint"><div class="site-wrap">
            <div class="site-section__head"><p class="site-eyebrow">{SUR-TITRE}</p><h2>{titre}</h2><p class="site-lead">{accroche}</p></div>
            <div data-clenzy-widget="results" data-clenzy-next="/logements"></div>
          </div></section>
          <footer class="site-footer"><div class="site-wrap">© {Marque} — {ville}</div></footer>
        </div>

        ── FORMAT DE SORTIE (STRICT) ───────────────────────────────────────────────────────────────
        Réponds UNIQUEMENT par un objet JSON, sans aucun texte autour, de la forme :
        {
          "designVars": {
            "--bt-color-primary": "<hex = couleur IMPOSÉE>", "--bt-color-primary-hover": "<hex>",
            "--bt-color-on-primary": "<hex>", "--bt-color-accent": "<hex>", "--bt-color-bg": "<hex>",
            "--bt-color-surface": "<hex>", "--bt-color-surface-2": "<hex>", "--bt-color-text": "<hex>",
            "--bt-color-text-muted": "<hex>", "--bt-color-border": "<hex>", "--bt-color-divider": "<hex>",
            "--bt-font-heading": "<police titres + fallback>", "--bt-font-body": "<police corps + fallback>",
            "--bt-text-xs": "0.75rem", "--bt-text-sm": "0.875rem", "--bt-text-md": "1rem", "--bt-text-lg": "1.25rem",
            "--bt-text-xl": "1.75rem", "--bt-text-2xl": "2.25rem", "--bt-text-3xl": "3rem",
            "--bt-weight-normal": "400", "--bt-weight-medium": "500", "--bt-weight-semibold": "600",
            "--bt-weight-bold": "700", "--bt-heading-weight": "<400-800>",
            "--bt-leading-tight": "1.15", "--bt-leading-normal": "1.55", "--bt-leading-relaxed": "1.75",
            "--bt-tracking-tight": "-0.01em", "--bt-tracking-normal": "0", "--bt-tracking-wide": "0.08em",
            "--bt-space-1": "4px", "--bt-space-2": "8px", "--bt-space-3": "12px", "--bt-space-4": "16px",
            "--bt-space-5": "24px", "--bt-space-6": "40px", "--bt-section-y": "80px", "--bt-container": "1140px",
            "--bt-radius-sm": "6px", "--bt-radius-md": "12px", "--bt-radius-lg": "20px", "--bt-radius-pill": "999px",
            "--bt-radius-button": "<ex. 999px>", "--bt-radius-card": "<ex. 16px>", "--bt-radius-input": "<ex. 10px>",
            "--bt-shadow-sm": "0 1px 2px rgba(0,0,0,.06)", "--bt-shadow-md": "0 8px 24px rgba(0,0,0,.10)",
            "--bt-shadow-lg": "0 18px 48px rgba(0,0,0,.16)", "--bt-shadow-card": "<ombre des cartes>",
            "--bt-border-width": "1px", "--bt-button-padding-x": "20px", "--bt-button-padding-y": "12px",
            "--bt-button-transform": "<none|uppercase>", "--bt-control-height": "48px",
            "--bt-duration": "150ms", "--bt-ease": "ease"
          },
          "css": "<le CSS partagé : pose les --bt-* sur .site-root et les utilise partout>",
          "pages": [
            { "path": "/", "type": "HOME", "title": "...", "html": "<div class=\\"site-root\\">...</div>",
              "seoTitle": "...", "seoDescription": "..." },
            ...
          ]
        }
        "designVars" est le CONTRAT DE DESIGN UNIQUE : il pilote À LA FOIS le CSS des pages ET l'habillage
        des widgets de réservation. Remplis-le EXHAUSTIVEMENT (valeurs cohérentes entre elles, chaque valeur
        est une simple valeur CSS — pas de point-virgule ni d'accolade ni d'url()), pose-le sur .site-root
        dans le "css", et utilise les --bt-* partout. Le "css" est commun ; le "html" de chaque page est
        autonome (nav + contenu + footer) pour un rendu identique studio ↔ SSR.
        """;

    /**
     * Construit le prompt utilisateur à partir du brief (langue source = 1re des langues demandées).
     *
     * @param resolvedPrimary couleur primaire résolue (hex) à ÉPINGLER (cohérence widget ↔ page CSS).
     */
    static String buildUserPrompt(SiteGenerationBrief brief, String sourceLanguage, String brandName,
                                  String resolvedPrimary, String designDirection, List<String> imageUrls) {
        StringBuilder sb = new StringBuilder();
        // DS-3 : direction de design imposée (prose DESIGN.md d'un système choisi) — PRIORITAIRE sur les
        // autres indices de style du brief. Placée en tête pour maximiser son poids.
        if (designDirection != null && !designDirection.isBlank()) {
            sb.append("── DIRECTION DE DESIGN À SUIVRE (prioritaire — respecte son atmosphère, sa palette, ")
              .append("sa typographie, sa VOIX & son TON) ──\n")
              .append(designDirection.trim()).append("\n\n");
        }
        sb.append("Langue de rédaction: ").append(langName(sourceLanguage)).append('\n');
        if ("ar".equals(sourceLanguage)) {
            sb.append("Sens d'écriture: RTL (droite→gauche) — ajoute dir=\"rtl\" sur .site-root, aligne le ")
              .append("texte à droite et inverse les paddings/marges directionnels.\n");
        }
        sb.append("Nom de la marque / du site: ").append(brandName).append('\n');
        sb.append("Type de bien: ").append(safe(brief.propertyType())).append('\n');
        appendIf(sb, "Localisation / destination", brief.location());
        appendIf(sb, "Clientèle cible", brief.audience());
        appendIf(sb, "Niveau de gamme", brief.tier());
        appendIf(sb, "Objectif principal / appel à l'action", brief.goal());
        appendIf(sb, "Style / ton souhaité", brief.tone());
        appendIf(sb, "Devise d'affichage", brief.currency());
        if (brief.usps() != null && !brief.usps().isEmpty()) {
            sb.append("Points forts à mettre en avant: ").append(String.join(", ", brief.usps())).append('\n');
        }
        // Couleur primaire épinglée (le widget de réservation utilise la même → cohérence visuelle).
        sb.append("Couleur primaire IMPOSÉE: ").append(resolvedPrimary)
          .append(" — utilise EXACTEMENT cette valeur pour --bt-color-primary ; dérive --bt-color-primary-hover / --bt-color-accent en harmonie.\n");
        // Voix éditoriale synthétisée (registre du contenu, dérivée d'audience/gamme/ton).
        sb.append("Voix éditoriale: écris pour ").append(orDefault(brief.audience(), "des voyageurs"))
          .append(", registre ").append(orDefault(brief.tier(), "standard"))
          .append(", ton ").append(orDefault(brief.tone(), "professionnel et chaleureux")).append(".\n");

        // Photos RÉELLES des logements de l'org (URLs publiques) → le LLM les place en fonds/galeries
        // (via classes CSS) plutôt que des placeholders génériques. Bornées côté service.
        if (imageUrls != null && !imageUrls.isEmpty()) {
            sb.append("\n── IMAGES RÉELLES DES LOGEMENTS (à utiliser en PRIORITÉ, via classes CSS) ──\n");
            for (String u : imageUrls) {
                sb.append("- ").append(u).append('\n');
            }
        }

        sb.append("\n── PAGES À PRODUIRE (dans cet ordre) ──\n");
        int i = 1;
        for (String key : resolvePageKeys(brief)) {
            PageSpec spec = PAGE_CATALOG.get(key);
            if (spec == null) {
                continue;
            }
            sb.append(i++).append(". path=\"").append(spec.path()).append("\", type=\"").append(spec.type())
                .append("\" → ").append(spec.description()).append('\n');
        }

        sb.append("\nGénère le site complet (thème + ces pages) en respectant STRICTEMENT le format JSON.");
        return sb.toString();
    }

    /** Clés de pages retenues : celles du brief (filtrées sur le catalogue), sinon le set par défaut. */
    private static List<String> resolvePageKeys(SiteGenerationBrief brief) {
        if (brief.pages() == null || brief.pages().isEmpty()) {
            return DEFAULT_PAGES;
        }
        List<String> valid = brief.pages().stream()
            .filter(k -> k != null && PAGE_CATALOG.containsKey(k))
            .distinct()
            .toList();
        return valid.isEmpty() ? DEFAULT_PAGES : valid;
    }

    private static void appendIf(StringBuilder sb, String label, String value) {
        if (value != null && !value.isBlank()) {
            sb.append(label).append(": ").append(value.trim()).append('\n');
        }
    }

    private static String orDefault(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value.trim();
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
