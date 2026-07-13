# Baitly Studio — Blueprint de refonte frontend (« Baitly Signature »)

> Refonte de l'outil admin où l'hôte/conciergerie **conçoit** son booking engine et ses sites de réservation directe via templates, à travers les **3 modes de distribution** (site hébergé SSR · widget embarquable · SDK headless).
> Nouvelle identité visuelle **Baitly Signature** — inspirée des meilleurs builders (Webflow, Framer, Wix Studio, Shopify admin) et des outils-référence du registre **product** (Linear, Figma, Notion, Raycast, Stripe).
> Conforme CLAUDE.md (skills design obligatoires, registre product, accessibilité). Préparé le 2026-06-14. Approche : **blueprint d'abord, build incrémental**.

---

## A. Vision & principes

**Thèse produit** : un hôte non-technicien doit pouvoir **concevoir, prévisualiser et publier** un site/booking engine de réservation directe en minutes, à partir de templates, sans toucher au code — et le diffuser sur les 3 modes depuis un seul endroit.

**Test de qualité (product slop test, impeccable)** : un utilisateur fluent dans Webflow/Framer/Shopify s'assoit devant Baitly Studio et **fait confiance** à l'interface immédiatement — il ne bute sur aucun composant « subtilement faux ». L'outil **disparaît dans la tâche**.

**5 principes Baitly Signature**
1. **Earned familiarity** — patterns de builder établis (3-pane, canvas + inspector, palette de commandes), pas de réinvention « pour le style ».
2. **Preview-first** — ce que l'hôte voit = ce que le voyageur verra (WYSIWYG, multi-breakpoint, multi-langue/RTL, multi-devise).
3. **Progressive disclosure** — surface simple par défaut, profondeur à la demande (l'inspector révèle les options avancées sans noyer).
4. **Un moteur, trois sorties** — le même contenu/config alimente site hébergé, widget et SDK ; la diffusion est un commutateur, pas trois produits.
5. **Restraint + 1 signature** — couleur restrained (registre product), un seul accent Baitly pour action/sélection/état ; densité maîtrisée, zéro décoration gratuite.

---

## B. Langage visuel « Baitly Signature »

> Registre **product** : sobre, dense, pro. Couleur *Restrained* par défaut ; **une** surface peut être *Committed* (écran de bienvenue/onboarding « drenched »). Accent réservé aux actions primaires, à la sélection et aux états — jamais décoratif.

### Couleur (OKLCH, à valider)
| Rôle | Light | Dark | Usage |
|---|---|---|---|
| **Signature (accent)** | `oklch(0.55 0.17 274)` (~#5654D8 indigo-violet) | `oklch(0.68 0.16 274)` | Action primaire, sélection, focus, états actifs **uniquement** |
| Signature soft | `oklch(0.95 0.03 274)` | `oklch(0.30 0.06 274)` | Fonds de sélection, hovers |
| Surface contenu | `oklch(0.99 0.004 270)` (near-white tinté) | `oklch(0.17 0.01 270)` | Canvas, contenu |
| **2e couche neutre** (panneaux) | `oklch(0.975 0.005 270)` | `oklch(0.21 0.012 270)` | Sidebars, toolbars, inspector (légèrement + froid) |
| Bordure | `oklch(0.92 0.006 270)` | `oklch(0.28 0.01 270)` | Séparateurs 1px |
| Texte | `oklch(0.25 0.01 270)` | `oklch(0.96 0.005 270)` | ≥ 4.5:1 |
| Texte secondaire | `oklch(0.50 0.01 270)` | `oklch(0.70 0.01 270)` | Labels, meta |
| Hospitality (2nd accent) | `oklch(0.74 0.13 55)` (warm sand/amber) | idem | **Illustration/marketing only**, jamais en UI d'action |
| Sémantiques | success `oklch(0.60 0.14 150)` · warning `oklch(0.75 0.14 75)` · error `oklch(0.58 0.20 25)` · info = signature | standardisés | États : hover/focus/active/disabled/selected/loading/error/warning/success/info |

> Pas de `#000`/`#fff` purs (tinter vers la teinte 270). Pas de gradient text, pas de glassmorphism par défaut, pas de side-stripe >1px (bans absolus impeccable).

### Typographie
- **Une famille UI** : `Inter` (variable) avec repli `system-ui` — registre product, lisible en dense. Échelle **rem fixe** (pas de fluid), ratio **1.2** : 12 / 13 / 14(base) / 16 / 20 / 24 / 30.
- **Wordmark/marketing** : un display géométrique distinctif (ex. `Outfit`) **réservé** au logotype Baitly + écrans d'accueil — **jamais** dans les labels/boutons/données (ban product).
- `tabular-nums` sur prix, dates, métriques. `text-wrap: balance` sur les titres. Line-height 1.5 (prose), 1.3 (UI dense).

### Espacement, rayons, élévation, motion
- **Grille 4px** ; espacements 4/8/12/16/24/32/48. Rayons : 6 (contrôles), 10 (cartes/panneaux), 14 (modales).
- **Élévation teintée** (jamais ombre noire générique) : `oklch(0.25 0.02 274 / 0.08)` — 3 niveaux (panneau, popover, modal).
- **Motion 150–250ms**, `ease-out-quart` ; transforme `transform`/`opacity` uniquement ; convoie un **état** (sélection, ouverture, feedback), jamais de chorégraphie au chargement. `prefers-reduced-motion` respecté.
- **Icônes** : `lucide-react` (jeu unique, 24×24, échelle via `useIconSize`). Aucune emoji.

### États & vides (obligatoire)
Chaque composant interactif : default / hover / focus / active / disabled / loading / error. **Skeletons** (pas de spinner au centre du contenu). **Empty states qui enseignent** (« Crée ta première page » avec action), jamais « rien ici ».

---

## C. Architecture d'information du Studio

```
Baitly Studio
├── Accueil / "Mes booking engines"   (liste des sites/engines de l'org + statut + mode actif)
│     └── [+ Créer]  → Galerie de templates  → nouveau projet
└── Éditeur d'un booking engine  (le "Studio" proprement dit)
      ├── Design        → Builder par blocs (pages, sections, thème, tokens)
      ├── Contenu       → Propriétés affichées, Blog, Pages custom, IA contenu/SEO
      ├── Réservation   → Devises, politiques d'annulation, caution/anti-fraude, panier, upsells
      ├── Croissance    → SEO (meta/schema/sitemap/hreflang), Leads & email, abandoned-cart, analytics
      ├── Diffusion     → 3 modes : Site hébergé (domaine), Widget (snippet), SDK/API (clés, doc, webhooks)
      └── Paramètres    → Langues/RTL, paiement, conformité, équipe
```

**Navigation** : barre supérieure (projet courant + sélecteur de breakpoint + langue/devise de preview + Publier) ; **rail latéral gauche** par sections (Design/Contenu/Réservation/Croissance/Diffusion). **Palette de commandes** (⌘K) pour tout atteindre. Fil d'Ariane `Projet › Section › Sous-écran` (chevron typographique).

---

## D. UX cœur du builder (3-pane, preview-first)

Layout de référence des builders, décliné Baitly Signature :

```
┌───────────────────────────────────────────────────────────────────────┐
│ Topbar : ‹ Projet ▾   [Design]  ⌘K   📱💻 breakpoint  🌐 fr/en/ar  €/MAD  [Publier ▾] │
├───────────┬───────────────────────────────────────────────┬───────────┤
│ LEFT       │  CANVAS / PREVIEW (WYSIWYG, le rendu réel)     │ INSPECTOR │
│ Pages +    │  - sélection d'un bloc -> halo signature       │ Propriétés│
│ structure  │  - drag pour réordonner les blocs              │ du bloc / │
│ (arbre de  │  - "+ Ajouter un bloc" (bibliothèque)          │ du thème  │
│  blocs)    │  - multi-breakpoint, RTL, devise live          │ (onglets) │
└───────────┴───────────────────────────────────────────────┴───────────┘
```

- **LEFT** : arbre Pages → Sections/Blocs (réorganisables). Bascule « Pages / Thème / Calques ».
- **CANVAS** : preview réelle (réutilise le moteur de rendu du site/widget). Sélection → inspector. Toolbar flottante par bloc (dupliquer, masquer, supprimer).
- **INSPECTOR** (droite) : propriétés du bloc sélectionné OU du thème global (couleurs/typo/espacement = design tokens). Progressive disclosure (basique ↦ avancé).
- **Bibliothèque de blocs** : Hero, Recherche, Grille de propriétés, Détail propriété, Galerie, Carte, Avis, FAQ, Blog, Newsletter/Lead, CTA, Rich text. (≠ drag-drop freeform — **composeur par blocs**, décision D-3 du blueprint backend.)
- **Galerie de templates** : grille de cartes (preview + vertical : appart urbain, villa, riad/MENA…), filtres, « Utiliser ce template ». RTL/arabe natifs (différenciateur).
- **Palette ⌘K** : naviguer, ajouter un bloc, changer de page, publier, basculer langue/devise.

---

## E. Surfaces par feature (mapping refonte → écrans)

| Feature refonte | Où, dans le Studio | Pattern UI |
|---|---|---|
| Site web inclus / builder / templates | Design → Builder + Galerie | 3-pane + gallery |
| Multi-devise | Topbar (preview) + Réservation → Devises | switcher + toggle devises supportées |
| Panier multi-séjours | Réservation → Panier | toggle + aperçu du flux |
| SEO (meta/schema/sitemap/hreflang) | Croissance → SEO | panneau par page + global, score + preview SERP |
| Blog | Contenu → Blog | liste d'articles + éditeur bloc + IA |
| Anti-fraude / caution | Réservation → Protection | presets caution/waiver + Radar/3DS (toggles) |
| Capture de leads / email | Croissance → Leads & Email | formulaires capturés, consentement, abandoned-cart, séquences |
| SDK / API | Diffusion → SDK/API | clés (créer/révoquer), snippet, lien doc OpenAPI, webhooks (livrés) |
| Outils IA (contenu/SEO/design) | inline (boutons « ✨ Générer » dans inspector/blog/SEO) + Design → IA | génération fr/en/ar, gating budget visible |
| Diffusion 3 modes | Diffusion | 3 cartes : Site hébergé (domaine+TLS), Widget (snippet copier-coller), Headless (clés) |

> Les **boutons IA** sont contextuels (dans l'inspector d'un bloc, l'éditeur de blog, le panneau SEO) — « générer une description », « générer un article », « générer meta+schema » — avec indicateur de budget tokens.

---

## F. Kit de composants « Baitly Signature »

Primitives à créer (réutilisables, états complets) : `StudioShell` (topbar + rail + panes), `BlockTree`, `Canvas`/`PreviewFrame`, `Inspector` (+ champs : ColorField, TokenField, ToggleField, SelectField, SegmentedControl), `BlockLibrary`, `TemplateGallery`/`TemplateCard`, `CommandPalette`, `BreakpointSwitcher`, `LangCurrencySwitcher`, `PublishMenu`, `EmptyState`, `Skeleton`, `Toast`, `AiGenerateButton`, `ScorePill` (SEO), `StatusBadge`. Tous : default/hover/focus/active/disabled/loading/error, focus visible clavier, `cursor:pointer` sur cliquable.

---

## G. Approche technique

- **Stack** : React 18 + TypeScript (existant). Thème **Baitly Signature** = nouveau thème MUI (tokens OKLCH → variables CSS) **dédié à la surface Studio**, coexistant avec le thème Baitly PMS (migration progressive possible vers tout le PMS plus tard).
- **Preview** : le canvas réutilise le **moteur de rendu** du widget/site (mêmes blocs que la sortie publique) → vrai WYSIWYG, pas une simulation.
- **Données** : le Studio lit/écrit la config booking engine via l'API admin existante (`BookingEngineConfig`) étendue par les modèles de la refonte (Site/SitePage/BlogPost/SiteTemplate… — Lot 1 backend) ; les features Lot 0 (devises, leads, caution, IA contenu, webhooks) sont **déjà câblées** côté API.
- **Dépendances builder** : drag/réordonnancement (dnd-kit), pas de lib lourde de page-builder (composeur par blocs maison = contrôle + cohérence Baitly Signature).
- **a11y** : WCAG AA, navigation clavier complète (le builder doit être utilisable au clavier), `prefers-reduced-motion`.

---

## H. Roadmap phasée (build incrémental, écran par écran)

| Phase | Livrable | Dépend |
|---|---|---|
| **F0 — Fondation Baitly Signature** | Thème MUI (tokens OKLCH + dark), kit de primitives de base (boutons/champs/badges/empty/skeleton), `StudioShell` (topbar + rail), palette ⌘K | — |
| **F1 — Accueil + Galerie de templates** | « Mes booking engines » (liste/statut) + galerie de templates + création de projet | F0 |
| **F2 — Builder cœur** | 3-pane (BlockTree + Canvas/preview + Inspector) + bibliothèque de blocs + thème/tokens | F0, moteur de rendu |
| **F3 — Croissance & Réservation** | panneaux SEO (score+preview), Leads/abandoned-cart, Devises, Caution/anti-fraude (features Lot 0 câblées) | F2 |
| **F4 — Contenu & IA** | Blog (éditeur bloc) + boutons IA contextuels (contenu/SEO) | F2, F3 |
| **F5 — Diffusion 3 modes** | 3 cartes (site hébergé/widget/SDK) + clés/snippet/webhooks/doc | F1, Lot 1 (site SSR) |

> F0–F2 sont buildables sur l'existant (thème + Studio shell + builder sur la config actuelle). F3/F4 branchent les features Lot 0 (déjà livrées). F5 (site hébergé) dépend de la fondation SSR (Lot 1 backend).

---

## I. Décisions arrêtées (2026-06-14)

- **D-1. Hue signature** : ✅ **indigo-violet** `oklch(~0.55 0.17 274)` (~#5654D8) — vibe builder moderne (Webflow/Framer/Linear).
- **D-2. Wordmark** : display géométrique (Outfit) réservé au logotype — logotype Baitly à affiner (non bloquant pour F0).
- **D-3. Thème** : ✅ **tout le PMS d'emblée** — Baitly Signature devient le thème PMS (remplace le thème Baitly). Les primitives consommant les tokens du thème adoptent la nouvelle identité automatiquement ; les couleurs hardcodées seront migrées au fil de l'eau.
- **D-4. Mode clair/sombre** : ✅ **clair ET sombre dès F0** (les deux jeux de tokens), **polir/valider le clair en premier**.
- **D-5. Drag** : ✅ **composeur par blocs** (réordonnancement vertical) ; freeform différé.
- **D-6. Densité** : ✅ **équilibrée** (pro mais accessible — audience hôte/conciergerie).
