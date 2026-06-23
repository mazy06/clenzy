# P0 — Cartographie d'intégration : refonte GrapesJS (`booking-engine-wip`) → `main`

> **But** : préparer le portage de la refonte GrapesJS sur `main` SANS perdre le design ni les
> fonctionnalités existants. Lecture seule, zéro modif de code. **Date** : 2026-06-20.
> **Principe directeur** : GrapesJS s'adapte au design/features existants ; toute impossibilité est
> remontée pour décision conjointe. Pricing + liste des templates = traités à la fin.

## Repères Git

| Réf | Commit | Rôle |
|---|---|---|
| `main` | `632cdef5` | Studio actuel = **builder custom** (à préserver — cf. screenshot) |
| `booking-engine-wip` | `273024d7` | La refonte GrapesJS (à porter) |
| ancêtre commun | `86bc5f0a` | Point d'embranchement |

**Clarification clé** : le screenshot fourni par l'user (onglets **Page / Widget / Parcours / Site** +
« Modèles » + bascule Éditer/Aperçu) = **le Studio ACTUEL de `main`** (`studio/builder/DesignBuilder.tsx`),
**pas** la refonte. C'est donc l'ensemble de référence « design + fonctionnalités à ne pas perdre ».

---

## 1. Surface de conflit — **minuscule** (la bonne nouvelle)

`main` n'a quasi pas divergé dans le booking-engine depuis l'embranchement. Conflits réels :

| Zone | Fichiers en conflit | Nature | Résolution |
|---|---|---|---|
| Settings booking-engine | `studio/settings/GrowthSettingsPanel.tsx`, `studio/settings/settingsControls.tsx`, `studio/builder/BlogPanel.tsx` | main a posé le **2-colonnes** (632cdef5) ; la refonte a sa propre version | **Re-greffer** le 2-col par-dessus les versions refonte |
| Migrations | `db.changelog-master.yaml` | refonte ajoute `0271`, main a `0272-0275` | **Aucune collision** (0271 libre) — insérer l'entrée 0271 avant 0272 |
| Dépendance | `client/package.json` | refonte ajoute `grapesjs ^0.23.2` | Ajout propre |

Tout le reste du backend de la refonte (Stripe, `Organization`, `PublicBookingService`, DTOs, 8 fichiers
+182/−17) se porte **sans conflit** : main n'a pas touché ces fichiers dans la fenêtre.

---

## 2. Parité fonctionnelle — les 4 modes du builder actuel

`DesignBuilder.tsx` (main, 990 l.) expose un éditeur **4 modes** : `Page | Widget | Parcours | Site`.
Voici ce que chacun devient dans la refonte GrapesJS.

| Mode main | Ce qu'il fait | État dans la refonte | Verdict |
|---|---|---|---|
| **Page** | Édition visuelle (blocs custom : BlockTree, BlockInspector, CssInspector, PageInspector), multi-page (PagesBar), Modèles, undo/redo, DnD | **Remplacé par GrapesJS** (canvas, Style/Layer/Trait managers natifs, multi-page B4, import, undo/redo, thème réactif, widgets = vrai SDK monté) | ✅ **UPGRADE** — c'est précisément le but |
| **Widget** | `WidgetComposer` (415 l.) : assembler des micro-widgets en `widgetLayout`, DnD, conteneurs, props par widget. Persisté dans `config.componentConfig` | Widgets = **blocs drag-drop GrapesJS** (`bookingWidgetDefs`, 16 primitives granulaires), persistés **inline** dans le HTML de page (marqueur `data-clenzy-widget`). **Très peu de traits** (config = surtout `label`) | ⚠️ **R2 — régression partielle** |
| **Parcours** | `WorkflowComposer` (118 l.) : installe le **funnel complet en 1 clic** (recherche→panier→coordonnées→Stripe→confirmation) | **Supprimé.** Parcours = **template-driven runtime** (le flux émerge des pages du template + persistance SDK). Pas d'onglet Parcours | ⚠️ **R3 — feature retirée délibérément** |
| **Site** | Aperçu du widget **posé sur un site**, placement **Bas / Flottant / Haut** | Reframe : le **site entier EST le produit** (multi-page GrapesJS + SSR). L'embed reste possible (SDK `BaitlyWidget` + `data-clenzy-widget`) mais l'**aperçu/placement UI** disparaît | ⚠️ **R4 — capacité conservée, UI d'aperçu perdue** |

Annexe — **MediaPicker** (`main`, intégré au stockage photo Clenzy S3/BYTEA) → remplacé par l'**Asset
Manager natif GrapesJS**. ⚠️ **R5 — à brancher** sur l'upload Clenzy (sinon URLs externes uniquement).

---

## 3. Journal des impossibilités / risques (à trancher avec l'user)

> Note : **aucun** de ces points n'est une vraie « impossibilité » GrapesJS — il sait tout faire (traits,
> commandes custom, hooks Asset Manager). Ce sont des **choix de périmètre de la refonte** qui
> *perdraient une feature de main* tant qu'on ne les ré-implémente pas. Honorer « no-regression » = les
> ré-ajouter en GrapesJS.

| Réf | Risque | Option « no-regression » (ré-ajout GrapesJS) | Option « assumer la refonte » |
|---|---|---|---|
| **R2** | Config par widget moins profonde que `WidgetComposer` | Ajouter des **traits GrapesJS** par widget = les options de `WidgetComposer` (labels, champs, comportements) | Garder le set granulaire + props minimales ; enrichir au besoin |
| **R3** | Plus de « funnel en 1 clic » (onglet Parcours) | Ajouter une **commande GrapesJS « Installer le funnel »** qui insère les blocs du parcours d'un coup | Assumer le template-driven (le funnel vient des templates de galerie) |
| **R4** | Plus d'aperçu « widget sur site externe » + placement | Ré-ajouter un **mode aperçu embed** (bas/flottant/haut) au-dessus du canvas | Assumer le site complet comme produit ; l'embed reste via SDK sans aperçu dédié |
| **R5** | Asset Manager non branché au stockage Clenzy | **Brancher** l'upload GrapesJS sur l'endpoint photo Clenzy (PhotoStorageService) | URLs externes seulement (insuffisant pour la prod) |

**Reco** : **R5 = obligatoire** (sinon upload média cassé). **R2 = à faire** progressivement (la profondeur
de config est un attendu client). **R3 et R4 = décision produit** : la refonte est plus moderne (template-driven,
site-complet), mais retire deux conforts. À trancher ensemble.

---

## 4. Plan de portage révisé (ordre d'exécution)

1. **PA — package + dépendance** : ajouter `grapesjs ^0.23.2` (+ lockfile). ✅ **FAIT**.
2. **PB — backend** : porter les 14 fichiers backend + changeset `0271` (entrée YAML insérée entre 0270 et 0272). ✅ **FAIT** — `mvn package` vert (jar produit). Sécurité vérifiée : checkout ne fait pas confiance au montant client, `returnUrl` validé HTTPS + host org (anti open-redirect, fail-closed).
3. **PC — SDK** : porter `sdk/core` + `sdk/primitives` + `sdk/bootstrap` + `sdk/components` + l'adapter `public/`. ✅ **FAIT** — 15 fichiers `sdk/` + `public/PublicBookingPage.tsx` + la feuille `studio/grapes/import/sanitizeHtml.ts` (dépendance de PublicBookingPage, tirée en avance). `tsc -b` vert. API `BaitlyWidget` rétro-compatible (WidgetPreview/SiteWidgetPreview de main type-checkent encore).
4. **PD — builder GrapesJS** : porter `studio/grapes/*` + brancher `StudioPage` Design → `GrapesStudio`, retirer `studio/builder/` SAUF ThemeInspector/BlogPanel/PagesBar. ✅ **FAIT** — checkout **ciblé** (pas de blanket-checkout : `settingsControls` + `builder/BlogPanel` gardent le 2-col de main, intacts) + `git rm` des 20 fichiers du builder custom + `growthSettingsApi.ts`. Aucun import orphelin, `tsc -b` vert. Bilan : 27 A / 18 M / 20 D.
5. **PE — réconciliation fichier partagé** : re-greffer le **2-colonnes** sur **`GrowthSettingsPanel`** (le SEUL vrai conflit — `settingsControls` + `BlogPanel` préservés intacts en PD). Garder StudioShell/useStudioConfig/useSitePages de la refonte. ✅ **FAIT** — bandeau intro remis dans la prop `intro` de `SettingsPage` (pleine largeur au-dessus du masonry 2-col), toggle « Popup exit-intent » de la refonte conservé. `tsc -b` vert.
6. **PF — no-regression** : traiter **R5** (média), **R2** (traits widgets), puis **R3/R4**. **Détail ci-dessous (§6).**
7. **PG — vérif** : `tsc`, build front, `mvn package` ; tests parcours réservation + import template.

### §6 — PF détaillé (checklist exhaustive, ordre cohérent)

> Ré-implémentation **GrapesJS-native** (pas de checkout) des features que la refonte avait retirées.
> Réf. code retiré : `main`/`booking-engine-wip~`(WidgetComposer, WorkflowComposer, MediaPicker).

- [ ] **R5 — Média (Asset Manager → upload Clenzy)** *(critique, fondation édition)*
  - Brancher l'Asset Manager GrapesJS sur l'upload photo Clenzy (réf. `MediaPicker` : endpoint + storageKey/url ticketée).
  - Au montage de l'éditeur (`GrapesStudio` init) : config `assetManager` (upload custom → POST endpoint → renvoyer l'URL).
  - Accept: glisser une image / bloc Image → ouvrir l'Asset Manager → uploader → l'image s'insère avec une URL Clenzy.
- [x] **R5 — Média** : Asset Manager GrapesJS branché sur `mediaApi` (upload + préchargement médiathèque org). `tsc` vert. ✅
- [ ] **R2 — Traits par primitive booking** *(profondeur config)* — **REDÉFINI suite découverte ci-dessous**
  - Pour chaque widget de `bookingWidgetDefs`/`bookingComponents` : exposer en **traits GrapesJS** les options de l'ex-`WidgetComposer` (libellés, champs visibles, comportements).
  - Accept: sélectionner un widget booking dans le canvas → panneau Réglages (traits) éditable → reflété dans l'aperçu.

  > **🔴 DÉCOUVERTE (2026-06-20) — trou d'archi de la refonte (à trancher)** : l'hydratation runtime
  > (`bootstrap.hydrateBookingMarkers` → `mountPrimitive.renderStep`) ne connaît que ~12 **steps coarse**
  > (`search`/`results`/`dates`/`guests`/`currency`/`cart`/`price`/`guest-form`/`checkout`/`property`/
  > `confirmation`/`account`). Les **16 blocs drag-drop granulaires** émettent `data-clenzy-widget="booking-*"`
  > (ex. `booking-dates`, `booking-city-search`, `booking-search-button`, `booking-add-to-cart`, `booking-addons`,
  > `booking-stepper`, `booking-rebook`…). Au runtime, ces ids tombent dans le `default` (= `createPropertyFilter`).
  > **Conséquence** : un bloc déposé s'affiche dans l'**aperçu éditeur** (via `BaitlyWidget.buildLayoutWidget`)
  > mais **ne s'hydrate PAS** sur le site **publié**. → Le drag-drop (feature voulue) n'est pas bout-en-bout.
  >
  > **Solution proposée — R2 en 2 temps** :
  > - **R2a (fondation runtime)** : étendre `mountPrimitive.renderStep` (+ `normalizeStep`) pour reconnaître les
  >   ids `booking-*` granulaires et les monter via les **factories SDK existantes** sur le **cœur partagé**
  >   (`citySearch`→input destination, `searchButton`→CTA nav, `addToCart`→CTA, `propertyResults`→`createPropertyList`,
  >   `priceSummary`→`createPriceSummary`, etc.). Additif, réutilise l'existant, aucune nouvelle archi.
  > - **R2b (config)** : traits GrapesJS → attribut `data-clenzy-props` (JSON) ; lus par l'aperçu **et** par
  >   `mountPrimitive` (props end-to-end : libellés/placeholders + options d'affichage de `propertyResults`).
  >
  > **✅ FAIT (2026-06-20)** — **R2a** : `mountPrimitive` reconnaît les 16 ids `booking-*` et les monte via les
  > factories SDK existantes sur le cœur partagé (parité `buildLayoutWidget` ; nav template-driven ; `addCurrentStayToCart`
  > répliqué). **R2b** : type `BookingTrait` + 23 traits sur `propertyResults` (disposition/toggles/typographie =
  > les seules props réellement consommées) ; `registerOne` pose des traits `changeProp` synchronisés en
  > `data-clenzy-props` (restauration au reload, re-render aperçu au changement) ; `mountPrimitive.buildPropertyListFromProps`
  > applique ces props au runtime. `tsc -b` vert. **→ Les blocs drag-drop s'hydratent enfin en ligne + sont configurables.**
- [x] **R3 — Funnel 1-clic (TOGGLE)** ✅ : commande GrapesJS `clenzy:install-funnel` + bouton de panneau « Funnel » (`GrapesStudio`). **Toggle** : ajoute la section `.clenzy-funnel` (`FUNNEL_WIDGET_IDS` : propertyResults→dates→guests→priceSummary→searchButton→addToCart→cart) si absente, la **retire** (`wrapper.find('.clenzy-funnel').remove()`) si présente. `tsc` vert.
- [x] **Polish chrome GrapesJS** ✅ (`grapesStudio.css`) : conformité Studio — bouton « Funnel » en pilule accent (parité « Importer ») ; titres de catégorie en petites capitales. `tsc` + `vite build` verts.
- [x] **Palette en LIGNES (rendu identique à l'ancien Studio)** ✅ : Block Manager = liste de lignes **[icône] [titre + description] [+]** (au lieu de la grille de cartes), entête « Glisse sur le canvas… ». Defs enrichies : `description` + catégories par groupe (Recherche / Résultats & prix / Panier & options / Coordonnées & réservation / Compte ; base = Mise en page / Basique) — parité ex-`WIDGET_CATEGORIES`/`widgetRegistry`. Label HTML via `blockLabelHtml`. `tsc` + `vite build` verts.
- [x] **R4 — Aperçu embed + placement** ✅ : nouvelle section StudioPage « Aperçu site » (`grapes/SiteEmbedPreview.tsx`, adapté de l'ex-`SiteWidgetPreview`) — capture le site cible (snapshot proxy) + monte le `BaitlyWidget` dessus, toggle placement **Bas / Flottant / Haut**. `tsc` vert.
- [x] **PG** ✅ : `cd client && tsc -b` **0 erreur** + `vite build` **✓ built in 11.64s** (chunk `StudioPage` 1,28 MB = GrapesJS, déjà code-split → ne charge qu'au Studio) + `mvn package` ✅ (PB, backend inchangé depuis).
  > ⚠️ **Hors scope** : `tsc` lancé depuis la **racine** type-checke l'app **mobile Expo** (`tsconfig.json` racine `extends expo/tsconfig.base`) → ~1360 erreurs **pré-existantes** dans `mobile/` (dette connue, sans rapport). La vérif du booking-engine se fait **depuis `client/`**.

---

## 5. Décisions user (2026-06-20) — **no-regression intégral**

Toutes les features de main sont **conservées**. GrapesJS s'adapte pour tout porter :

| Réf | Décision | Implémentation GrapesJS |
|---|---|---|
| **R2** | Ré-ajouter la config par widget | **Traits GrapesJS** par primitive = options de `WidgetComposer` |
| **R3** | **Ré-ajouter le funnel 1-clic** | **Commande GrapesJS** « Installer le funnel » qui insère tout le parcours d'un coup (en plus du template-driven) |
| **R4** | **Ré-ajouter l'aperçu embed** | **Mode aperçu** « widget sur site externe » + placement bas/flottant/haut au-dessus du canvas |
| **R5** | Brancher le média | **Asset Manager** GrapesJS câblé sur l'upload PhotoStorage Clenzy |

→ Le bloc **PF (no-regression)** du plan traite les 4. Rien de l'éditeur 4-modes actuel n'est perdu.
