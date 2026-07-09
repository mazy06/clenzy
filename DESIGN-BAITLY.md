# DESIGN-BAITLY.md — Contrat d'authoring des templates de booking engine

> **À quoi sert ce fichier.** C'est le **contrat unique** que Claude Code (CLI) doit respecter pour
> produire un template de site de réservation **directement ingérable** dans le catalogue Baitly
> (`SiteTemplate`), puis servable tel quel via le SSR et hydratable par le SDK — **sans retouche**.
>
> **Comment l'utiliser.** En session d'authoring, ouvre `claude` à la racine du repo et donne ce
> fichier en contexte : « Génère un template conforme à `DESIGN-BAITLY.md` pour \<brief\> ». Le
> template produit passe ensuite par le **validateur** (P1) puis l'**ingestion** (P2) → catalogue.
>
> **Pourquoi si strict.** Les widgets de réservation sont injectés au runtime sur des **marqueurs**
> précis, et l'habillage pages↔widgets repose sur un **jeu de tokens `--bt-*` unique**. Toute
> déviation casse l'hydratation ou la cohérence visuelle. Ce contrat est dérivé du chemin de
> génération déjà éprouvé (`SiteGenerationPrompts`) et du SDK (`mountPrimitive`).

---

## 1. Ce qu'est un template (format de sortie)

Un template = **un thème partagé** (tokens + CSS) + **N pages autonomes**. Sortie = **un seul objet
JSON**, sans texte autour :

```json
{
  "meta": {
    "name": "Riad Concierge Marrakech",
    "slug": "riad-concierge-marrakech",
    "category": "conciergerie",
    "archetype": "overlay",
    "theme": "marrakech",
    "defaultLocale": "fr",
    "thumbnailUrl": "https://…/thumb.jpg",
    "description": "Site vitrine haut de gamme pour conciergerie de riads."
  },
  "designVars": { "--bt-color-primary": "#…", "…": "…" },
  "css": "<CSS PARTAGÉ : pose les --bt-* sur .site-root et les utilise partout>",
  "pages": [
    {
      "path": "/",
      "type": "HOME",
      "title": "Accueil",
      "html": "<div class=\"site-root\">…</div>",
      "seoTitle": "…",
      "seoDescription": "…"
    }
  ]
}
```

- `designVars` est le **contrat de design UNIQUE** : il pilote **à la fois** le CSS des pages **et**
  l'habillage des widgets de réservation. Le remplir **exhaustivement** (§4).
- `css` est **commun à toutes les pages** ; il pose les `--bt-*` sur `.site-root` et les utilise partout.
- Chaque `html` de page est **autonome** (nav + contenu + footer) pour un rendu **identique Studio ↔ SSR**.
- L'ingestion convertit chaque page en enveloppe `GrapesEnvelope`
  (`{ format:'grapesjs', html, css, projectData:null }`) et l'ensemble en `SiteTemplate`.

---

## 2. Pages — types & chemins

`type` ∈ **`HOME` · `PROPERTY_LIST` · `PROPERTY_DETAIL` · `BLOG` · `CUSTOM`** (enum `SitePageType`).

Chemins recommandés (stables, réutilisés par la navigation) :

| Rôle | `path` | `type` |
|---|---|---|
| Accueil | `/` | `HOME` |
| Liste des logements | `/logements` | `PROPERTY_LIST` |
| Détail d'un logement | `/logement` | `PROPERTY_DETAIL` |
| À propos | `/a-propos` | `CUSTOM` |
| Contact | `/contact` | `CUSTOM` |
| Blog | `/blog` | `BLOG` |
| FAQ | `/faq` | `CUSTOM` |
| Avis | `/avis` | `CUSTOM` |
| Galerie | `/galerie` | `CUSTOM` |
| Expériences | `/experiences` | `CUSTOM` |
| Tarifs | `/tarifs` | `CUSTOM` |

**Set minimal d'un template complet** : `HOME` + `PROPERTY_LIST` + `PROPERTY_DETAIL` +
(`/a-propos` ou `/contact`). Un template peut en proposer plus.

---

## 3. Structure HTML (convention de classes `site-*`)

Chaque page respecte **cette structure** (le CSS partagé la stylise via les `--bt-*`) :

- **Racine unique par page** : `<div class="site-root"> … </div>` — porte **TOUTES** les variables
  `--bt-*`. (Pour l'arabe : `<div class="site-root" dir="rtl">`, texte à droite, paddings inversés.)
- **Conteneur centré** : `<div class="site-wrap">` (max-width ≈ `--bt-container`, padding latéral).
- **Sections** : `<section class="site-section">` (variante teintée : `site-section site-section--tint`).
- **En-tête de section** : `<div class="site-section__head">` avec
  `<p class="site-eyebrow">` (sur-titre capitales espacées) + `<h2>` + `<p class="site-lead">`.
- **Hero** : `<section class="site-hero site-hero--<theme>">` (fond image **via classe CSS**, cf. §5),
  `<h1>`, sous-titre, CTA `<a class="site-btn">`.
- **Boutons** : `site-btn` (plein) / `site-btn site-btn--ghost` (secondaire).
- **Navigation** : `<nav class="site-nav">` en haut + `<footer class="site-footer">` en bas,
  **IDENTIQUES sur chaque page**, liens `<a href="/chemin">` **uniquement vers des pages réellement
  présentes** dans le template.
- Titres avec `text-wrap: balance` ; valeurs numériques en `tabular-nums` ; **aucun emoji comme icône**.
- Polices : `@import` Google Fonts **en tête du `css` partagé** si besoin.

> Les noms de classe `site-*` ne sont pas magiques en soi (le CSS est autonome par template), mais les
> **garder** assure la cohérence de la galerie et facilite l'édition plateforme dans GrapesJS.

---

## 4. Tokens de design `--bt-*` (contrat unique pages ↔ widgets)

Pose **TOUTES** ces variables sur `.site-root` dans le `css`, puis **utilise-les partout** (couleurs,
tailles, paddings, gaps, rayons, ombres, transitions) — **jamais** une valeur en dur quand un token
existe. Chaque valeur est une **valeur CSS simple** (pas de `;`, pas de `{}`, pas d'`url()`).

```
Couleurs & rôles
  --bt-color-primary  --bt-color-primary-hover  --bt-color-on-primary  --bt-color-accent
  --bt-color-bg  --bt-color-surface  --bt-color-surface-2
  --bt-color-text  --bt-color-text-muted  --bt-color-border  --bt-color-divider
Typographie
  --bt-font-heading  --bt-font-body
  --bt-text-xs .. --bt-text-3xl   (xs sm md lg xl 2xl 3xl)
  --bt-weight-normal|medium|semibold|bold   --bt-heading-weight
  --bt-leading-tight|normal|relaxed   --bt-tracking-tight|normal|wide
Espacements & layout
  --bt-space-1 .. --bt-space-6   --bt-section-y   --bt-container
Rayons
  --bt-radius-sm|md|lg|pill   --bt-radius-button  --bt-radius-card  --bt-radius-input
Ombres & bordures
  --bt-shadow-sm|md|lg  --bt-shadow-card   --bt-border-width
Boutons / contrôles
  --bt-button-padding-x  --bt-button-padding-y  --bt-button-transform (none|uppercase)
  --bt-control-height
Transitions
  --bt-duration   --bt-ease
```

Valeurs de référence (à adapter par thème, garder l'échelle) : `--bt-text-md:1rem`,
`--bt-section-y:80px`, `--bt-container:1140px`, `--bt-radius-md:12px`, `--bt-control-height:48px`,
`--bt-duration:150ms`. **La couleur primaire du brief est IMPOSÉE** sur `--bt-color-primary` ; dérive
`--bt-color-primary-hover` / `--bt-color-accent` en harmonie.

> Les widgets de réservation lisent ce même contrat `--bt-*` → **cohérence visuelle totale
> pages ↔ widgets**. C'est non négociable.

---

## 5. Fonds image — RÈGLE DURE (⚠️ ne jamais inline)

**Interdit** : `style="background-image:url(...)"` **inline** sur un élément.
**Obligatoire** : déclarer le fond dans une **classe CSS** du `css` partagé.

```css
/* ✅ correct */
.site-hero--marrakech { background-image: url('https://images.unsplash.com/photo-…'); }
```
```html
<!-- ❌ interdit -->
<section class="site-hero" style="background-image:url('…')">
```

**Pourquoi** : le Studio GrapesJS (édition plateforme) **strippe les `style` inline à l'import** → un
fond posé inline **disparaît**. Tous les templates curés ont été corrigés pour cette raison. Le prompt
de génération IA historique (`SiteGenerationPrompts`) montre encore un exemple inline : **ne pas
l'imiter** pour un template de galerie.

Images : **URLs `https` absolues** uniquement (placeholders Unsplash acceptés). Toujours prévoir une
**couleur de repli** (`background-color`) sous l'image.

---

## 6. Marqueurs de widgets de réservation (hydratés au runtime)

Le module de réservation est injecté au runtime sur des **`<div>` VIDES** portant `data-clenzy-widget`.
**Jamais de contenu enfant** (l'hydratation le remplace) ; toujours **entourés de texte rédactionnel**
— un marqueur ne constitue **jamais** le seul contenu d'une page.

### Vocabulaire des primitives (valeurs `data-clenzy-widget` autorisées à l'authoring)

> ⚠️ Utilise **ce vocabulaire « parcours »**, PAS les ids de blocs Studio (`booking-city-search`…).
> *(Identifiant fonctionnel : le préfixe `clenzy` reste `clenzy` — NE PAS rebrander en `baitly`.)*

| Marqueur | Rôle | Page type cible |
|---|---|---|
| `search` | Barre de recherche (destination/dates/voyageurs) | `HOME` (dans/sous le hero) |
| `results` (≡ `property-list`) | Grille des logements disponibles | `PROPERTY_LIST` (+ aperçu `HOME`) |
| `property` | Détail du logement sélectionné | `PROPERTY_DETAIL` |
| `dates` (≡ `availability`) | Sélecteur de dates | selon parcours |
| `guests` | Sélecteur de voyageurs | selon parcours |
| `currency` | Sélecteur de devise | selon parcours |
| `price` | Fourchette de prix (filtre) | `PROPERTY_LIST` |
| `cart` | Panier multi-séjours | page panier / `PROPERTY_DETAIL` |
| `guest-form` | Coordonnées voyageur → paiement | page checkout |
| `checkout` | Bouton de paiement (Stripe) | page checkout |
| `confirmation` | Écran de confirmation post-réservation | page confirmation |
| `account` | Connexion / compte voyageur | nav / `HOME` |
| `upsells` | Options & extras | `PROPERTY_DETAIL` / checkout |

### Navigation template-driven

Le **template relie ses pages lui-même** via des attributs sur le marqueur :

- `data-clenzy-next="/logements"` → page cible en avançant (ex. `search` → liste, `results` → détail).
- `data-clenzy-return="/logements"` → page de retour.

```html
<!-- HOME : recherche dans le hero, mène à la liste -->
<div data-clenzy-widget="search" data-clenzy-next="/logements"></div>

<!-- PROPERTY_LIST : grille, chaque carte mène au détail -->
<div data-clenzy-widget="results" data-clenzy-next="/logement"></div>

<!-- PROPERTY_DETAIL : retour vers la liste -->
<div data-clenzy-widget="property" data-clenzy-return="/logements"></div>
```

### Config par instance (optionnel)

Props sérialisées en JSON dans `data-clenzy-props` (lu par l'hydratation). Ex. pour `results` :

```html
<div data-clenzy-widget="results"
     data-clenzy-props='{"cardStyle":"overlay","columns":3,"showPrice":true}'
     data-clenzy-next="/logement"></div>
```

Si aucune `data-clenzy-props`, les valeurs par défaut du SDK s'appliquent.

---

## 7. Sécurité du HTML (obligatoire)

- **Pas de `<script>`**, **pas d'attributs d'événement** (`onclick`, `onload`…), **pas d'`<iframe>`**.
- Images uniquement en `https` absolu.
- Le HTML est **ré-assaini** à l'ingestion (`EmailHtmlSanitizer`) — mais produis d'emblée du HTML sûr
  (le sanitizer préserve les `data-clenzy-*`, il supprime le reste non sûr).

---

## 8. Contenu (qualité rédactionnelle)

- Contenu **engageant, crédible et FACTUEL** : **n'invente AUCUN fait chiffré vérifiable** (pas de
  note, pas de nombre d'avis, pas de date de création précise inventés).
- Adapte vocabulaire/ton au **type de bien**, à la **clientèle**, au **niveau de gamme** et au **style**
  du brief ; mets en avant les **points forts** fournis.
- Chaque page : `seoTitle` ≤ 60 caractères, `seoDescription` ≤ 155 caractères.
- La `HOME` **commence** par un hero `<h1>` + sous-titre + CTA (vrai texte), **jamais** par un marqueur.

---

## 9. Squelette de référence — page `HOME` (à adapter, pas à recopier)

```html
<div class="site-root">
  <nav class="site-nav"><div class="site-wrap">
    <a href="/">{Marque}</a>
    <a href="/logements">Logements</a>
    <a href="/a-propos">À propos</a>
    <a href="/contact">Contact</a>
  </div></nav>

  <section class="site-hero site-hero--{theme}">
    <div class="site-wrap">
      <h1>{Titre accrocheur}</h1>
      <p>{sous-titre}</p>
      <div data-clenzy-widget="search" data-clenzy-next="/logements"></div>
      <a class="site-btn" href="/logements">{CTA aligné sur l'objectif}</a>
    </div>
  </section>

  <section class="site-section site-section--tint"><div class="site-wrap">
    <div class="site-section__head">
      <p class="site-eyebrow">{SUR-TITRE}</p>
      <h2>{titre}</h2>
      <p class="site-lead">{accroche}</p>
    </div>
    <div data-clenzy-widget="results" data-clenzy-next="/logement"></div>
  </div></section>

  <footer class="site-footer"><div class="site-wrap">© {Marque} — {ville}</div></footer>
</div>
```

---

## 10. Checklist de conformité (ce que le validateur P1 vérifie)

Un template est **refusé** s'il échoue un seul de ces points :

- [ ] JSON parsable ; `meta`, `designVars`, `css`, `pages[]` présents et non vides.
- [ ] `meta.slug` en kebab-case unique ; `meta.category` / `archetype` / `theme` renseignés.
- [ ] Chaque page a `path`, `type` ∈ enum, `title`, `html`, `seoTitle` (≤60), `seoDescription` (≤155).
- [ ] Exactement **une** `<div class="site-root">` par page ; nav + footer présents et identiques.
- [ ] **Tous** les tokens `--bt-*` du §4 posés sur `.site-root` dans `css`.
- [ ] Aucune valeur de couleur/tour/ombre en dur là où un token existe (heuristique : peu de hex hors `designVars`).
- [ ] **Aucun** `style="background-image` inline (fonds image en classes CSS).
- [ ] `data-clenzy-widget` uniquement dans le **vocabulaire §6** ; marqueurs **vides** ; entourés de texte.
- [ ] Navigation `data-clenzy-next` / `data-clenzy-return` pointe vers des **paths existants** du template.
- [ ] **Aucun** `<script>`, `on*=`, `<iframe>` ; images en `https` absolu.
- [ ] Aucun emoji utilisé comme icône.

---

## 11. Anti-patterns (bans design Baitly — à réécrire systématiquement)

Hérités des règles frontend du projet (register **product**, pas brand) :

- Pas de **gradient text**, pas de **glow néon**, pas de **glassmorphism** par défaut.
- Pas de **side-stripe** coloré > 1px, pas de **3 cards égales** en rang générique.
- Pas de `#000` / `#fff` purs → teinter vers la teinte de marque.
- Pas d'`em dash` décoratif, pas de copy « Elevate / Seamless / Unleash ».
- Contraste texte ≥ 4.5:1 (clair **et** sombre) ; focus clavier visible ; `prefers-reduced-motion` respecté.
