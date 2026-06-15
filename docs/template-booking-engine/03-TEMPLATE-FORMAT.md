# 03 — Format des templates & import dans le Studio

> Schéma JSON : repo **`clenzy-site-templates`** → `schema/template.schema.json`. Un template **valide**
> contre ce schéma + n'utilisant que les blocs/props ([01](01-BLOCKS.md)) et tokens ([02](02-DESIGN-TOKENS.md))
> documentés est garanti compatible avec le booking engine (Studio + page publique SSR).

## Structure `template.json`
```json
{
  "id": "conciergerie-marrakech",          // slug unique [a-z0-9-]
  "name": "Conciergerie Marrakech",
  "description": "…",
  "register": "product",                    // product (défaut) | brand
  "preview": "preview.png",                 // optionnel
  "theme": { "primaryColor": "…", "fontFamily": "…", "designTokens": { … } },
  "customCss": "…",                          // optionnel — CSS appliqué au site (widget/SPA + SSR)
  "customJs": "…",                           // optionnel — JS du site (code de confiance ; injecté SSR)
  "pages": [
    {
      "path": "/",                          // chemin de la page
      "type": "HOME",                        // HOME | PROPERTY_LIST | CUSTOM | BLOG | PROPERTY_DETAIL
      "title": "Accueil",                    // sert de label de navigation
      "seoTitle": "…",                       // optionnel
      "seoDescription": "…",                 // optionnel
      "blocks": [ { "type": "hero", "props": { … } }, … ]
    }
  ]
}
```

## Pages : types & conventions
- **`HOME`** (obligatoire, `path: "/"`) : page d'accueil. Miroir de `config.pageLayout`. Contient le `hero`
  (avec `showSearch: true`) — la barre + le widget de réservation (`#reserver`) sont injectés par le moteur.
- **`PROPERTY_LIST`** (`/logements`) : page listant les biens via un bloc `propertyGrid` (les vraies fiches
  sont injectées au rendu → cartes cliquables vers `/logement/{id}`).
- **`CUSTOM`** (`/a-propos`, `/experiences`, `/contact`, `/faq`…) : pages libres composées de blocs.
- **`BLOG`** : **NE PAS** créer de page blog ici — l'index `/blog` et les articles `/blog/{slug}` sont des
  **routes SSR dédiées** (alimentées par les `BlogPost`). Pour pointer vers le journal, mettre un `cta`/lien.
- **`PROPERTY_DETAIL`** : **jamais** authored — les fiches `/logement/{id}` sont **dynamiques** (générées par le SSR).

### Navigation (⚠️ pas de bloc navbar)
Le header de navigation (`SiteNav`) est **généré automatiquement** à partir des pages (`HOME` / `PROPERTY_LIST` /
`BLOG` / `CUSTOM`), triées par ordre, labellisées par `title`, + un bouton « Réserver » (logo & marque depuis
les réglages du booking engine). Donc : **1 page = 1 entrée de menu** ; soigne les `title`. **NE crée PAS de
bloc navbar/header** (il n'en existe pas et il ferait doublon). Cette nav est désormais aussi **rendue dans
l'aperçu du Studio** (en tête de la page) — l'aperçu correspond donc au site déployé.

### Réservation
Le widget de réservation est **monté automatiquement** sur chaque page (section `#reserver`) dès que l'org a
un booking engine. Les blocs `hero(showSearch)` et `cta` (lien défaut `#reserver`) y renvoient. **Ne pas**
créer de faux formulaire de réservation en blocs.

### CSS / JS custom (fidélité du design)
Pour le style qui dépasse les blocs + tokens (nuances de mise en page, polish), utilise **`customCss`** au
niveau racine du template : appliqué au **widget (Shadow DOM)**, à la **page publique SPA** ET injecté dans
le **SSR** (cible les classes `bkly-*` / `cb-*` et les variables de thème `--accent`, `--ink`, `--card`…).
`customJs` (optionnel) est injecté côté client — **code de confiance uniquement** (config propriétaire).
Privilégie les **tokens** ([02](02-DESIGN-TOKENS.md)) ; `customCss` est l'échappatoire pour le reste.

## Contraintes de validité (rappel)
1. Uniquement des `type` du registre ([01](01-BLOCKS.md)) ; uniquement des `props` documentées.
2. `props` = primitifs ; multi-lignes via `\n` ; paires via `Libellé | Valeur`.
3. `theme.designTokens` : **clés exactes** ([02](02-DESIGN-TOKENS.md)) — pas de clé inventée.
4. Images : URLs absolues atteignables (placeholders Unsplash OK pour un template de démo) ou `""`.
5. `columns` : enfants dans `children` (un tableau par colonne), pas dans `props`.

## Validation locale
```bash
# Depuis le repo clenzy-site-templates (ajv-cli ou tout validateur JSON Schema 2020-12) :
npx ajv-cli validate -s schema/template.schema.json -d templates/<slug>/template.json --spec=draft2020
```

## Import dans le Studio & vérification dans l'aperçu
Workflow (« importer → aperçu ») :
1. Produire le `template.json` (le déposer dans `templates/<slug>/template.json` + `templates/index.json` pour l'archiver).
2. Dans le Studio : bouton **« Modèles »** → en bas du sélecteur, **« Importer un template (JSON) »** → coller le
   `template.json` → **Importer**. Le moteur : applique `theme` (primaryColor / fontFamily / designTokens) à la
   config + crée/met à jour une `SitePage` par entrée `pages[]` (la page `HOME` alimente aussi `pageLayout`) ;
   les pages existantes hors-template sont conservées (non destructif).
3. **Aperçu** : l'import bascule automatiquement en mode **Aperçu**. Segmented **Page / Réservation** : « Page »
   rend la composition avec le thème, « Réservation » vérifie le widget. La page publique SSR (`clenzy-sites`)
   rend la même composition + nav multi-pages + fiches `/logement/{id}`.

> ✅ **Implémenté** (2026-06-15) : import **multi-page** d'un `template.json` collé via le sélecteur de templates
> (`SiteTemplatePicker` → `DesignBuilder.handleImportTemplate` → `useSitePages.importPages`). Les blocs sont
> normalisés (types/props inconnus retirés, défauts appliqués) ; les pages `PROPERTY_DETAIL` sont ignorées
> (dynamiques). Repli mono-page (pas de site) : seul l'accueil est appliqué.
