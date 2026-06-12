# DESIGN_BASELINE — Référentiel « Baitly Signature » (source de vérité)

> Extrait UNIQUEMENT des éléments déjà redesignés ET FINALISÉS de la branche
> `design/refonte-pms`. Tout nouveau redesign DOIT se construire à partir de ce
> référentiel. Si un besoin visuel n'est couvert par aucun pattern ci-dessous :
> NE PAS improviser — le signaler à l'orchestrateur.
>
> Statuts : Planning et Sidebar sont ⚠️ PARTIELS — seules leurs parties listées
> ici comme finalisées font référence.

## 0. Fichiers sources de vérité (dans le repo)

| Fichier | Rôle |
|---|---|
| `client/src/theme/signature/tokens.css` | TOKENS CSS (clair + sombre + 7 teintes `[data-accent]` + section `--nav-*` sidebar). Importé global. |
| `client/src/theme/signature/signatureTheme.ts` | Couche thème MUI (boutons, icon-buttons, paper/menus/popovers, DIALOGS globaux, champs, tables, chips, tooltips). Dernière couche de `createBaitlyTheme`. |
| `client/src/theme/signature/accent.ts` | Teinte d'accent : `ACCENT_OPTIONS`, `setAccent`, `data-accent` sur `<html>` (persisté `STORAGE_KEYS.ACCENT`). |
| `client/src/components/PageHeader.tsx` | En-tête de page standard (titre display, sous-titre, slots filters/actions — les slots héritent du thème global). |
| `client/src/components/PageTabs.tsx` | Onglets niveau 1 soulignés accent. |
| `client/src/components/StatTile.tsx` | Carte KPI (plate hairline r14, valeur display tabular-nums, label overline). |
| `client/src/components/EmptyState.tsx` | État vide (icône faint, titre display, tip warn-soft). |
| `client/src/components/FilterChipRow.tsx` | Chips de filtre pilules (actif accent-soft/accent). |
| Références HTML/CSS externes (specs exactes) | `~/Downloads/refonte_pms/**` (tokens, signature.css galerie, pl-grid, messagerie/), `~/Downloads/Référence de la barre latérale.html`, `~/Downloads/Référence des états des icônes de boutons.html`, `~/Downloads/Modale Nouvelle Réservation.html`, `~/Downloads/planning-grid-reference.css` |

## 1. Tokens (rôles — TOUJOURS via `var(--…)`, jamais de hex en dur si un token existe)

### Surfaces & lignes
`--bg` fond app · `--card` surface carte/panneau · `--surface-2` surface élevée discrète (entêtes, pieds de modale) · `--line` séparateur fin · `--line-2` bordure de contrôle · `--hover` survol de ligne/surface.

### Texte
`--ink` titres · `--body` corps · `--muted` secondaire · `--faint` tertiaire/labels overline.

### Accent (THÉMABLE — ne lire QUE ces 3 vars)
`--accent` · `--accent-deep` (hover fort) · `--accent-soft` (fond doux/actif) · `--on-accent` (#fff). 7 teintes via `[data-accent="emeraude|terracotta|ambre|indigo|violet|ocean|slate"]` ; sombre auto via `[data-theme="dark"]`.

### Champs
`--field` fond (gris dé-bleui) · `--field-line` bordure.

### Sémantique (désaturée)
`--ok`/`--ok-soft` · `--warn`/`--warn-soft` · `--err`/`--err-soft` · `--info`/`--info-soft`.

### Canaux
`--airbnb`/`-soft`/`-ink` · `--booking`/`-soft`/`-ink` · `--direct*` (= accent). Messagerie (constantes locales validées) : WhatsApp `#25A36F`, Email `#7BA3C2`, SMS `#C28A52`.

### Statuts réservation (constantes locales `modules/planning/constants.ts` — validées)
confirmée `#3E9C80` · en attente `#C28A52` · check-in `#4F86C6` · check-out `#9A7FA3` · annulée = fantôme hachuré. Ménage `#2F9E8D`, maintenance `#4F86C6`. Ligne « maintenant » `#E5484D`.

### Sidebar (`--nav-*`)
`--nav-bg`/`--nav-bg2` (dégradé vertical) · `--nav-line` · `--nav-txt` · `--nav-strong` · `--nav-faint` · `--nav-hover` · `--nav-userbg`.

### Rayons
9px compacts/segments · 11px boutons/champs · 12px popovers/menus · 13-14px cartes/panneaux · 18px modales/drawer hero · pilule 9999.

### Ombres (teintées encre, parcimonieuses)
`--shadow-card` (hover de carte cliquable uniquement — JAMAIS au repos) · `--shadow-pop` (popovers/menus) · modale : `0 30px 70px -24px rgba(21,36,45,.5)` · glow item actif sidebar : `0 6px 18px -6px color-mix(in srgb, var(--accent) 55%, transparent)`.

### Typo
`--font-display` 'Space Grotesk' (titres, CHIFFRES, KPIs — avec `font-variant-numeric: tabular-nums` sur les nombres) · `--font-sans` 'Plus Jakarta Sans' (UI/corps) · arabe : Tajawal (couche RTL du thème, prime sur Signature).
Échelle dense : 10.5px overline/labels (fw700, letterSpacing .05-.08em, uppercase, `--faint`) · 11.5px secondaires · 12.5px corps UI/boutons · 13px corps · 13.5px items forts · display : 14 (jour), 16-18 (titres de panneau/modale), 20 (entité), 22+ (h1 écran).

### Mouvement
Transitions .12-.2s ; easing `cubic-bezier(.16,1,.3,1)` pour les entrées ; **press tactile boutons `scale(.97)`** ; modale : translateY(12px)+scale(.985)→none .22s ; `prefers-reduced-motion: reduce` TOUJOURS respecté (transition none, anneaux statiques).

### Breakpoints
MUI standards (`md` bascule compacte des PageHeader actions → icon-only). Sidebar : 240px / 68px réduit. Densité responsive historique supprimée des éléments refaits (valeurs FIXES des références).

## 2. Primitives & composants (variantes/états)

### Boutons (thème global MuiButton — réf .s-btn)
Base h38, padding 0 17, r11, 12.5px fw600, gap 8, icône 15px, press .97, disabled opacity .45.
- `contained` (primaire) = **CONTOUR accent** (transparent, border+texte `--accent`, hover `--accent-soft`) — JAMAIS d'aplat plein.
- `outlined` (secondaire) = fond `--card`, border `--line-2`, texte `--body`, hover border `--faint`.
- `text` (ghost) = `--body`, hover `--hover`.
- sémantiques (error/success/warning, contained ou outlined) = contour couleur + hover fond `-soft`.
- `size="small"` h32 px12 12px r9 icône 13 · `size="large"` h44 px22 13.5px.
- Soft (fond accent-soft + texte accent) : pattern ponctuel via sx (réf .s-btn--soft).
IconButton global : r9, `--muted`, hover `--hover` + `--ink`.

### Champs (thème global MuiOutlinedInput)
r11, fond `--field`, border `--field-line`, hover `--faint`, focus border `--accent` 1px. Variante modale (.rm-input, locale) : h44 + label flottant sur l'encoche + focus ring `0 0 0 3px var(--accent-soft)` + fond `--card`.

### Cartes (MuiCard global)
r14, border 1px `--line`, AUCUNE ombre au repos, hover border `--line-2` (+ `--shadow-card` si cliquable). Pas de cartes dans des cartes.

### KPI (StatTile)
Carte plate, valeur display fw600 tabular-nums `--ink`, label overline 10.5 `--faint`, hint `--muted`, badge icône piloté par prop color → fond soft assorti.

### Chips/badges (MuiChip global + patterns)
Pilule r999 10.5px fw700 h22. Statuts = texte couleur + fond `-soft`. Chips de filtre (.pl-chip / FilterChipRow) : carte hairline r8, padding 5px 10px, 11.5px fw600, désélection = `opacity .4` (PAS de grisé grayscale), hauteur uniforme (minHeight si contenus hétérogènes), dot statut 9px r3, logo 15px.

### Onglets
Niveau 1 (PageTabs) : soulignés, indicator 2px accent, labels fw600 `--muted`→`--accent`, conteneur hairline. Niveau 2 (sous-onglets) : pilules — fond `--field`, ACTIF = fond `--accent` BLANC (réf messagerie .mg-subtab) ou accent-soft/accent (réf .s-subtab) selon contexte liste vs page. Segmented (bascule de vue) : conteneur `--field` border `--field-line` r10 p3, bouton actif fond `--card` + texte accent + ombre 0 1px 3px.

### Tableaux (thème global)
Entêtes overline 10.5 `--faint` uppercase, lignes hairline `--line`, hover `--hover`, valeurs 12.5px, chiffres tabular-nums.

### Modales (thème global MuiDialog — réf .s-modal/.rm-*)
Paper r18 hairline + ombre profonde, backdrop `rgba(10,18,24,.5)` + blur 3px, Title display 18 fw600 + filet (padding 18 22), Content padding 22, Actions padding 14 22 fond `--surface-2` + filet, animation d'entrée .22s. Grande modale 2 colonnes : 980px, colonnes padding 22 gap 18, gauche border-right, sections overline `.rm-sec`, alerte pleine largeur `-soft` + border color-mix 30%. ✕ : 34px r10 hairline, hover `--err`.

### Tooltips (global)
Fond `--ink`, texte `--bg` (s'inversent avec le thème), r8, 11.5px fw600.

### Menus/Popovers (global)
Paper hairline `--line`, r12, `--shadow-pop`.

### Toggle (pattern .rm-toggle — pas encore global)
Track 42×24 r99 `--line-2`→`--accent`, pouce 20px blanc.

### Compteur (pattern .rm-count)
Conteneur `--field` r10 p3, boutons 30 r8 fond `--card`, valeur display 15.

### Messagerie (modules/messaging — FINALISÉ)
Liste 340px (.mg-conv : avatar 44 r13 initiales display + pastille canal 18 r7 border 2px `--card`, propriété 11px accent, badge non-lus 18px accent) ; fil fond `--bg`, entête h62, bulles .mg-b max-w 74% r15 (in carte hairline coin bas-gauche 5 / out accent blanc coin bas-droit 5), séparateur jour pilule ; compose `--field` r13, send 36 r11 accent PLEIN (exception validée). Détail formulaire .fr-* (tuiles, chips, pcards, docs, statut pilule, IP mono).

### Sidebar (⚠️ PARTIEL — parties FINALISÉES qui font référence)
Conteneur 240/68 dégradé `--nav-bg→--nav-bg2` ; logo 62px (mark 26 + wordmark display 20) ; groupes overline 10px .1em → « · » en réduit ; items 36px r9 13px fw500, ACTIF = fond accent blanc + glow ; compteurs 18px `--warn` → point 8px en réduit ; carte user (fond `--nav-userbg` r12, avatar 34 r10 accent initiales display) ; footer 4 boutons 32px, cloche à point `--err`. NE PAS dériver de nouveaux patterns d'autres aspects de la sidebar sans validation.

### Planning (⚠️ PARTIEL — parties FINALISÉES qui font référence)
Grille .pl-grid (conteneur card r14, coin/colonne 188px, entête `--surface-2`, jours wd 9.5/dn display 14, today carré 24 r8 accent, we teintés, piste 54px, ligne maintenant) ; brique .pl-bar 36px (avatar 26, pastilles 21 r7 fond blanc icône 13, +N combo display, annulée hachurée, anneau sélection card+accent, animations data-wizz + plRing) ; chips filtres ; popovers réservation/logement ; drawer 4 onglets ; modale Nouvelle réservation .rm-*. Le RESTE du module = à terminer.

## 3. États systématiques (obligatoires sur tout livrable)
hover (doux, jamais de scale-transform layout-shifting) · focus-visible clavier (`outline 2px var(--accent) offset 2px` ou ring accent-soft) · actif/sélection (accent ou accent-soft + barre/anneau selon pattern) · désactivé (opacity .45, cursor not-allowed, pas de press) · loading (spinner .7s linear / skeletons à privilégier) · vide (EmptyState) · erreur (tokens `--err*`, message clair). Dark mode : AUCUN style spécifique à écrire — passer par les tokens (le `[data-theme="dark"]` les redéfinit).

## 4. Accessibilité & interactions (conventions observées)
`cursor: pointer` sur tout cliquable · `aria-pressed` sur les toggles-chips · tooltips sur icon-only · contrastes ≥ 4.5:1 (les tokens y veillent) · navigation clavier (Échap ferme modales/popovers MUI natif) · `prefers-reduced-motion` partout · icônes lucide via barrel `../icons` (size/strokeWidth 1.75, actif 2) · JAMAIS d'emoji comme icône · pas de `#000`/`#fff` purs hors `--on-accent`.

## 5. Centralisé vs local (quoi réutiliser)
- **Centralisé (réutiliser d'office)** : tokens.css, signatureTheme (tout MUI de base), primitives §0, helpers accent.
- **Local validé (copier le pattern, pas le code)** : constantes statuts/canaux planning & messagerie, .rm-* (champs flottants modale), .mg-*/.fr-*, planningUrgency.css (keyframes), interventionAttachment.
- **Anti-patterns interdits** : aplat plein primaire, side-stripe >1px, dégradés décoratifs, glassmorphism, grain/texture de fond, hero-metric template, cartes identiques en rang sans hiérarchie, icon-badge plein au-dessus des headings, ombre noire générique, valeurs en dur doublonnant un token, scale au hover, emojis-icônes.

## 6. Registre de couverture (Phase 0bis)

### ✅ Finalisés (INTOUCHABLES sauf incohérence signalée)
Tokens/thème/accent · PageHeader + slots · PageTabs · StatTile · EmptyState · FilterChipRow · boutons & icon-buttons globaux · modales globales (skin) · Dashboard (modules/dashboard, 13 fichiers) · Messagerie unifiée (modules/messaging) · Modale Nouvelle réservation · fond plat (grain supprimé).

### ⚠️ Partiels (compléter SANS dénaturer ; en cas de doute → signaler)
- **Planning** (modules/planning) : fait = grille/brique/filtres/popovers/drawer/modale/header. À auditer : vues Semaine/Mois en profondeur, mode Liste absent, sélection plage/ghost drag, dialogs secondaires (Bloquer, CreateServiceRequestDialog…), pagination, états vides/loading, responsive/mobile.
- **Sidebar** (components/Sidebar*) : fait = conteneur/logo/items/badges/user/footer/menu Apparence. À auditer : drawer mobile, états de chargement du menu, RTL, scrollbars, sous-menus éventuels.

### ❌ À redesigner (vagues)
**Vague 1 — primitives restantes** : compléments thème global (TextField/Select/Autocomplete/Checkbox/Radio/Switch toggle 42×24/Alert/Snackbar/Skeleton/Progress/Pagination/Divider/Accordion/Stepper si utilisés) + composants partagés (LoadingStates, FilterSearchBar, bannières Offline/PWA/Update, dialogs de confirmation customs, DataTable wrappers).
**Vague 2 — composites + finalisation partiels** : Planning ⚠️, Sidebar ⚠️, formulaires composites partagés, tables composites.
**Vague 3 — écrans** (ordre d'impact) : Propriétés + Fiche logement → Facturation/Invoices/Finance → Analytics/Rapports → Settings → Interventions (+ details/edit) → Voyageurs/Guests + Demandes (service-requests) → Documents → Channels + Boutique + Contrats + Tarification/Pricing → Réservations/Calendar → Connected-objects → Admin (monitoring, sync, users/orgs déjà PageHeader-isés mais contenus ❌) → Auth/public (register profil distinct — à arbitrer) → divers (welcome-guide admin, booking-engine, automation, teams, portfolios, organization, directory, guest-experience, prospection, vouchers, payments, invitations).

## 7. Patterns manquants détectés (à arbitrer — liste vivante)
- Toggle/Switch global MUI (pattern .rm-toggle local seulement).
- Datepickers/calendriers hors modale résa (un seul pattern calendrier validé).
- Tables denses avec tri/sélection multiple (pattern entêtes overline OK, mais toolbar de table non spécifiée).
- Wizard/Stepper, Accordion, Upload/dropzone, éditeur riche : aucun pattern.
- Pages publiques (login déjà « Signature-origine », autres pages publiques non couvertes).
- Violet « IA » #8B5CF6/#7C3AED hors palette (settings ×5) — token dédié ou rattachement accent à arbitrer.
- Palette catégorielle 10 teintes saturées de l'inventaire (`InventoryItemsSection.tsx:85-94`) — désaturer ou valider comme couleurs data.
- `FEATURE_META` dupliqué entre `AiSettings` et `PlatformAiConfigSection` (couleurs/icônes par feature IA) — centraliser.
- Lightbox photo (visionneuse plein écran) : aucun pattern validé.
- FAB mobile : dérivation contour accent appliquée — à valider (le baseline ne couvre pas le FAB).
- Chip statut NEUTRE : pas de token dédié (usage actuel `--muted`/`--hover` ad hoc) — à formaliser.
- Légende de chart riche + labels sur Pie : aucun pattern chart validé.
- `DashboardDateFilter` : chips vs segmented — deux patterns concurrents pour la même fonction, trancher.
- `softChipSx`/`statusUtils` legacy + couleurs data des `services/api` (PAYOUT/EXPENSE/CHANNEX_STATUS_META, hex saturés ~:886) — migrer vers tokens sémantiques ou valider comme couleurs data.
