# Architecture — Import de templates multi-standards (Baitly Studio)

> Doc de conception. **Aucun code n'est écrit tant que ce doc n'est pas validé.**
> Objectif : permettre d'importer des templates issus de **plusieurs standards externes**
> (Elementor, Gutenberg, WPBakery, GrapesJS, HTML/Bootstrap…) **sans inventer un format
> propriétaire de plus**, en restant **compatible, scalable et extensible**.
> Premier adaptateur de référence retenu : **HTML / Bootstrap** (le plus universel).

---

## 1. Contexte & objectif

Chaque CMS / page builder a son propre système de template. On veut « se câler sur
plusieurs systèmes différents et pouvoir switcher afin d'en importer à l'infini ».

**Décision de cadrage (verdict de l'investigation)** : on ne crée pas un N-ième format, et
on ne jette pas le nôtre. Notre modèle interne est **déjà** la forme convergente de tous les
builders (un arbre de nœuds typés). Il manque :
1. une **couche d'adaptation** (anti-corruption layer) qui normalise chaque format externe
   vers notre modèle ;
2. une petite **évolution du modèle** pour absorber le contenu riche importé ;
3. (levier de scalabilité) l'**unification du rendu** aujourd'hui triplé.

---

## 2. État des lieux (ce qui existe déjà — à réutiliser)

### 2.1 Notre modèle interne (IR = Intermediate Representation)

Arbre de nœuds typés, identique en forme à Elementor / Gutenberg / GrapesJS :

```ts
// clenzy/client/.../studio/builder/DesignBuilder.tsx:34
interface BlockInstance { id: string; type: BlockType; props: BlockProps; children?: BlockInstance[][]; }
// clenzy/client/.../studio/builder/blockRegistry.tsx:70
type BlockProps = Record<string, string | number | boolean>;          // ⚠️ scalaire uniquement
// WidgetComposer.tsx:25
interface WidgetInstance { id: string; type: WidgetType; props: WidgetProps; children?: WidgetInstance[]; }
```

- **16–17 types de blocs** (`hero, bookingWidget, propertyGrid, gallery, amenities, stats,
  pricing, testimonial, logos, faq, video, map, section, columns, richText, cta, footer`)
  — `blockRegistry.tsx:37`.
- **17 types de micro-widgets** (`citySearch, dates, guests, …, group`) — `widgetRegistry.tsx:23`.
- Définition déclarative par type via `BlockDef { type, label, icon, defaultProps, fields,
  slotsOf?, render }` — `blockRegistry.tsx:144`.

### 2.2 Persistance (déjà en place)

| Donnée | Colonne / entité | Format |
|---|---|---|
| Layout de page | `BookingEngineConfig.page_layout` | JSON `BlockInstance[]` (sérialisé) |
| Widget principal + lib | `BookingEngineConfig.component_config` | JSON `{ widgetLayout, styleMode, savedWidgets }` |
| Pages du site | `SitePage.blocks` / `published_blocks` | JSON `BlockInstance[]` (brouillon + publié) |
| Catalogue de templates | `SiteTemplate.content_json` (scope **GLOBAL**/**ORG**) | JSON `template.json` complet (thème + pages + CSS) |

### 2.3 Import déjà existant (à généraliser, pas à refaire)

- `parseImportedTemplate(...)` dans `DesignBuilder.tsx` (~l.101–167) : JSON collé → validation
  → normalisation (`parseLayout` → `serializeLayout`) → persistance. **C'est le point d'entrée
  à faire évoluer en registre d'adaptateurs.**

### 2.4 Faiblesses à corriger

- **F1 — `props` scalaire.** `Record<string, string|number|boolean>` ne peut pas porter des
  settings imbriqués (Elementor `settings{}`, attributs Gutenberg, styles GrapesJS).
- **F2 — rendu triplé sans registre commun.** 3 `switch type→rendu` parallèles :
  - Studio : `blockRegistry.tsx:879` `renderBlock` → `BlockDef.render`.
  - SSR : `clenzy-sites/src/lib/blocks.tsx` `renderBlock` (switch).
  - SDK : `sdk/BaitlyWidget.ts` `buildLayoutWidget` (switch, vanilla DOM).
  Ajouter/mapper un type = *shotgun surgery* sur 3 fichiers.

---

## 3. Les standards externes (réalité)

**Aucun standard universel d'interchange n'existe.** Mais tous se ramènent au squelette
`{ type, settings, children }` :

| Standard | Format | Sémantique | Importabilité |
|---|---|---|---|
| **Elementor** | JSON `content:[…]` | `elType` (container/section/column/widget) + `widgetType` + `settings{}` | Bonne. Médias = liens externes (non embarqués). |
| **Gutenberg** | HTML + délimiteurs `<!-- wp:ns/name {attrs} --> … <!-- /wp:ns/name -->` | bloc + attributs JSON + `innerBlocks` | Bonne. Grammaire officielle (parser `@wordpress/block-serialization-default-parser`). |
| **GrapesJS** | JSON `{ pages, components[], styles[] }` | `tagName/type/attributes` + CSS séparé | Excellente (HTML/CSS portable — standard embarquable de facto). |
| **WPBakery** | shortcodes `[vc_row][vc_column]…[/vc_column][/vc_row]` | balises imbriquées | Moyenne (regex, fragile, legacy). |
| **HTML / Bootstrap** | HTML + classes utilitaires | DOM sémantique | Via parseur HTML→IR (socle réutilisé par tous). |

**Vérité à assumer** : l'import **1:1 pixel-perfect est impossible** (couplage runtime
WordPress/plugins/moteur CSS/données dynamiques). Objectif réaliste = **import structurel +
dégradation gracieuse** : on mappe ce qu'on comprend, **le reste tombe dans un bloc `rawHtml`**
(jamais perdu, jamais bloquant), avec un **rapport de compatibilité** post-import.

---

## 4. Architecture cible

```
Standards externes ─▶ Couche d'adaptation ─▶ Modèle canonique (IR) ─▶ 3 surfaces de rendu
(Elementor/Gutenberg/   (detect·parse·            (arbre typé             (Studio / SDK / SSR)
 WPBakery/GrapesJS/HTML)  normalise·fallback)      {type,props,children})
```

### 4.1 Interface d'adaptateur (le cœur — Open/Closed)

```ts
// clenzy/client/.../studio/builder/import/TemplateImporter.ts (nouveau)
export interface ImportResult {
  blocks: BlockInstance[];            // l'IR normalisé
  report: ImportReport;               // compat : mappés vs rawHtml
}
export interface ImportReport {
  source: string;                     // 'html' | 'gutenberg' | 'elementor' | 'grapesjs' | …
  total: number;
  mapped: number;
  rawFallback: { type: string; count: number }[];   // types externes tombés en rawHtml
  warnings: string[];
}
export interface TemplateImporter {
  id: string;                         // identifiant stable du standard
  label: string;                      // libellé UI
  /** Reconnaît le format à partir de l'entrée (rapide, sans tout parser). */
  detect(input: string): boolean;
  /** Parse l'entrée vers l'IR. NE LANCE PAS sur type inconnu → fallback rawHtml. */
  parse(input: string): ImportResult;
}
```

### 4.2 Registre (extensibilité = +1 fichier)

```ts
// import/registry.ts
const IMPORTERS: TemplateImporter[] = [htmlImporter, gutenbergImporter, elementorImporter, /*…*/];
export function detectImporter(input: string): TemplateImporter | null {
  return IMPORTERS.find((i) => i.detect(input)) ?? null;
}
export function importTemplate(input: string, forceId?: string): ImportResult { /* detect→parse */ }
```

Ajouter un standard = écrire **un** fichier `import/<standard>.ts` + l'ajouter au tableau.
Aucun impact sur le cœur ni sur les surfaces de rendu.

### 4.3 Évolution minimale du modèle (corrige F1)

On **ne casse pas** `props` scalaire pour nos blocs sémantiques. On ajoute :

1. **Bloc générique `rawHtml`** (le fallback universel). Son rendu insère le HTML
   **uniquement après sanitization** (voir §4.4) :
   ```ts
   // blockRegistry.tsx — nouveau BlockDef
   {
     type: 'rawHtml', label: 'HTML importé',
     defaultProps: { html: '' }, fields: [{ key: 'html', type: 'textarea' }],
     render: (p) => renderSanitizedHtml(String(p.html)),   // sanitize (DOMPurify) AVANT insertion — jamais de HTML brut
   }
   ```
   `renderSanitizedHtml` enveloppe l'insertion HTML derrière DOMPurify (client) / jsoup
   (serveur). **Aucun HTML non assaini n'atteint le DOM.**
2. **Champ optionnel `data?: unknown`** sur `BlockInstance` pour porter un payload riche
   (settings Elementor, styles GrapesJS) sans le forcer dans `props` scalaire :
   ```ts
   interface BlockInstance { id; type; props; children?; data?: Record<string, unknown>; }
   ```
   `data` est **optionnel et rétrocompatible** (les blocs existants ne l'ont pas).
   Sérialisé tel quel (round-trip), ignoré par les blocs qui ne le lisent pas.

### 4.4 Sécurité (NON négociable — règles projet)

Importer du HTML arbitraire = **risque XSS stocké** (cf. règles `EmailHtmlSanitizer` /
`StringUtils.escapeHtml`, audit Z7-SEC-01/02).

- Tout HTML porté par un bloc `rawHtml` **DOIT être assaini** : au **stockage** ET au **rendu**
  (les deux, pattern `EmailHtmlSanitizer`). Whitelist de balises/attributs, suppression des
  balises de script, des attributs d'événements `on*` et des schémas `javascript:`.
  Côté client : DOMPurify. Côté serveur (SSR / import backend) : jsoup safelist.
- Les **URL d'images/liens importées** : validées (HTTPS, pas de `data:`/`javascript:`),
  jamais d'auto-fetch d'URL fournie par le template (SSRF — cf. `ICalImportService`).
- Le SSR (`clenzy-sites`) doit assainir **côté serveur** avant rendu (pas seulement le Studio).

---

## 5. Adaptateur de référence P1 : HTML / Bootstrap

Le plus universel (et socle de fallback réutilisé par les autres). Stratégie : parse DOM →
descente récursive → mapping heuristique vers nos blocs sémantiques, sinon `rawHtml`.

| Élément HTML détecté | → Bloc IR |
|---|---|
| `<section>` / `<div class="container/row">` | `section` (conteneur) |
| `<div class="row">` + `col-*` | `columns` (n = nb de colonnes Bootstrap) |
| `<h1>/<h2>` + `<p>` groupés | `richText` (ou `hero` si en tête de page) |
| `<img>` multiples en grille | `gallery` |
| `<button>/<a class="btn">` | `cta` |
| `<footer>` | `footer` |
| tout le reste | **`rawHtml`** (assaini) + entrée dans le rapport |

- Parsing : `DOMParser` (dispo navigateur, pour le Studio). Pour un import **backend**
  (upload de fichier), prévoir un parseur HTML serveur + sanitizer (jsoup côté Java).
- Heuristiques volontairement simples au départ (P1) ; on affine au fil des retours.
- **Aucune perte** : un nœud non reconnu n'est jamais jeté → `rawHtml`.

---

## 6. Mapping par standard (P2+)

| Standard | Détection (`detect`) | Mapping clé → IR |
|---|---|---|
| **Gutenberg** | présence de `<!-- wp:` | `core/heading|paragraph|image|columns|group|button…` → nos blocs ; `innerBlocks` → `children` ; bloc inconnu → `rawHtml` (on garde le HTML interne). |
| **Elementor** | JSON avec `content[].elType` | `section/container` → `section` ; `column` → colonne ; `widget` selon `widgetType` (`heading→richText`, `image→gallery`, `button→cta`…) ; `settings{}` → `data`. |
| **GrapesJS** | JSON avec `components[]` + `styles[]` | composants → IR ; CSS `styles[]` → `customCss` (ou `rawHtml` enveloppant). Candidat pour devenir le moteur du mode « HTML libre ». |
| **WPBakery** | présence de `[vc_row]` | parse shortcodes (regex) → `section/columns` ; legacy, priorité basse. |

Chaque mapping vit dans **son** fichier d'adaptateur. La table est locale à l'adaptateur
(pas de couplage global).

---

## 7. Levier de scalabilité — unifier le rendu (corrige F2)

Aujourd'hui : 3 `switch type→rendu` (Studio / SSR / SDK). Tant qu'ils restent séparés, chaque
type mappé est écrit 3×. Cible :

- **Contrat de rendu unique** par type (un registre partagé), consommé par les 3 surfaces.
  Réaliste : extraire la **table type→primitives** dans un module partageable
  (`clenzy/client` ↔ `clenzy-sites` via package ou copie générée), le SDK restant vanilla mais
  piloté par le même contrat de données.
- À défaut d'unification totale (coût), au minimum : **un seul endroit** qui définit
  `type → { studioRender, ssrRender, sdkBuild }` pour éviter l'oubli d'une surface.

> Ce chantier est **indépendant** de l'import : il peut être fait en P4, mais sans lui le coût
> marginal d'un nouveau type mappé reste élevé.

---

## 8. Réversibilité (P4, optionnel)

Exporteur `IR → HTML` (et éventuellement `IR → Gutenberg`) pour ne pas enfermer l'utilisateur
et permettre le copier-coller vers d'autres outils. Symétrique des adaptateurs.

---

## 9. Plan par phases

| Phase | Contenu | Livrable vérifiable |
|---|---|---|
| **P0** | Fondations : interface `TemplateImporter` + registre + bloc `rawHtml` (+ sanitizer) + champ `data?` + `ImportReport` + UI « rapport de compatibilité ». Brancher `parseImportedTemplate` existant dessus. | Import d'un JSON natif passe par le registre ; rapport affiché. tsc 0. |
| **P1** | Adaptateur **HTML / Bootstrap** (détection + parse + heuristiques + fallback rawHtml). | Coller du HTML → blocs dans le Studio, rendu Studio + SSR, rapport « X mappés / Y rawHtml ». |
| **P2** | Adaptateur **Gutenberg** (parser délimiteurs) + **Elementor** (JSON). | Import de templates WP réels ; `data` porte les settings. |
| **P3** | Adaptateur **GrapesJS** (+ étude « embarquer GrapesJS » pour le mode HTML libre). | Import projet GrapesJS ; CSS rattaché. |
| **P4** | Unification du rendu (registre partagé) + exporteur HTML. | Ajout d'un type = 1 endroit ; export HTML d'une page. |

---

## 10. Risques & décisions ouvertes

- **R1 — fidélité visuelle.** L'import est structurel, pas pixel-perfect. À communiquer dans
  l'UI (rapport + aperçu avant validation). **Décision** : assumer la dégradation gracieuse.
- **R2 — XSS / sécurité.** Bloquant : sanitizer obligatoire stockage+rendu, côté client ET
  serveur. **Décision** : pas de P1 sans sanitizer (cf. §4.4).
- **R3 — `data?` vs props scalaire.** Risque de dérive (tout mettre dans `data`). **Décision** :
  `data` réservé au payload importé non mappé ; nos blocs natifs gardent `props` scalaire.
- **R4 — import backend vs client.** Le Studio peut parser en navigateur (`DOMParser`), mais un
  upload de fichier ou un import à grande échelle voudra un parseur serveur (jsoup + sanitizer).
  **Ouvert** : périmètre P1 = client only ? à trancher.
- **R5 — médias externes.** Elementor/Gutenberg référencent des médias par URL. **Décision** :
  garder les URL telles quelles en P1–P2 ; rapatriement vers la médiathèque = phase ultérieure.

---

## 11. Fichiers impactés (prévision)

- **Nouveaux** : `studio/builder/import/TemplateImporter.ts`, `import/registry.ts`,
  `import/html.ts` (P1), `import/gutenberg.ts` / `import/elementor.ts` (P2), `import/grapesjs.ts` (P3),
  `import/sanitizeHtml.ts`.
- **Modifiés** : `blockRegistry.tsx` (bloc `rawHtml`), `DesignBuilder.tsx` (`parseImportedTemplate`
  → registre + UI rapport), `BlockInstance` (champ `data?`), `clenzy-sites/src/lib/blocks.tsx`
  (rendu `rawHtml` + sanitize serveur), `sdk/BaitlyWidget.ts` (si `rawHtml` doit s'afficher en widget).

---

*Décision suite : doc validé → implémenter **P0 + adaptateur HTML/Bootstrap (P1)**.*
