# BAITLY-UI-CONTRACT.md — Contrat de peinture des écrans

> Ce fichier vit à côté de `baitly-ui.css` et de `baitly-nova.css`, qu'il décrit.
> Il est **suivi par git**, contrairement aux `PLAN-*.md` de la racine (`.gitignore` exclut `/*.md`).
>
> Il consigne ce qu'il faut savoir pour peindre un écran Baitly sans réintroduire un défaut
> déjà corrigé. Chaque règle vient d'un bug **mesuré**, pas d'une préférence.

---

## 1. Les deux systèmes qui coexistent

MUI a disparu du client (0 import `@mui/*`). Ce qu'il en reste est sa **couche de peinture** :

- **tokens « Signature »** — `theme/signature/tokens.css` : `--ink`, `--accent`, `--line`, `--card`,
  `--faint`, `--ok/--warn/--err/--info`… ;
- **classes `cn-text-*`** — `baitly-nova.css`, shim des variantes `Typography` de MUI.

La cible est **Baitly UI** : la palette `--bui-*` (`baitly-ui.css`) exposée en utilities Tailwind
sémantiques (`bg-card`, `text-muted-foreground`, `bg-primary-soft`, `text-success-ink`…) et les
composants de `components/ui/` + `components/baitly/`.

---

## 2. Correspondance des tokens

### Surfaces, lignes, texte

| Legacy | Baitly UI |
|---|---|
| `var(--bg)` | `bg-background` |
| `var(--card)`, `var(--surface-2)` | `bg-card` |
| `var(--hover)` | `hover:bg-muted` |
| `var(--line)`, `var(--line-2)` | `border-border` |
| `var(--field)` / `var(--field-line)` | `bg-field` / `border-field-line` |
| `var(--ink)`, `var(--body)` | `text-foreground` |
| `var(--muted)` | `text-muted-foreground` |
| `var(--faint)` | `text-faint` |
| `var(--accent-soft)` | `bg-primary-soft` |
| `var(--on-accent)` | `text-primary-foreground` |

### La règle la plus importante : `-ink` / teinte vive / `-soft`

Chaque famille sémantique a **trois** jetons, non interchangeables :

- **`-ink`** → **TEXTE uniquement**. En clair, la teinte vive plafonne à ~2,2:1 sur `bg-card`.
- **teinte vive** → fonds pleins, bordures, icônes décoratives, barres de progression, pastilles.
- **`-soft`** → fonds pastel des pastilles et encarts.

| Legacy | Texte | Fond pastel | Aplat / icône / bordure |
|---|---|---|---|
| `--ok` | `text-success-ink` | `bg-success-soft` | `bg-success` / `text-success` |
| `--warn` | `text-warning-ink` | `bg-warning-soft` | `bg-warning` / `text-warning` |
| `--err` | `text-destructive-ink` | `bg-destructive-soft` | `bg-destructive` / `text-destructive` |
| `--info` | `text-info-ink` | `bg-info-soft` | `bg-info` / `text-info` |

**Une correspondance « fidèle » de token ne garantit rien.** Les en-têtes de tableau tenaient
`--faint` à 2,48:1 ; `--bui-faint`, son équivalent apparent, donne 2,41:1. Il a fallu monter d'un
cran vers `--bui-muted-foreground` (4,80:1). Toujours **mesurer**, jamais traduire mécaniquement.

### Typographie — sortie de `cn-text-*`

| Legacy | Baitly UI |
|---|---|
| `cn-text-h4` | `text-base font-semibold tracking-tight text-balance` |
| `cn-text-h5` | `text-sm font-semibold tracking-tight` |
| `cn-text-h6` | `text-sm font-semibold` |
| `cn-text-subtitle1` / `subtitle2` | `text-sm font-medium` / `text-xs font-medium` |
| `cn-text-body1` / `body2` | `text-sm` / `text-xs` |
| `cn-text-caption` | `text-xs text-muted-foreground` |
| `cn-text-overline` | `text-2xs font-semibold uppercase tracking-wide text-muted-foreground` |

Valeurs numériques (KPI, montants, dates, compteurs) : `tabular-nums`.

---

## 3. Ce qu'il ne faut **PAS** migrer

### Palettes de domaine, sans équivalent sémantique

`--airbnb*`, `--booking*`, `--vrbo*`, `--expedia*`, `--direct*` (couleurs de marque désaturées),
`--paid` / `--unpaid`, `--chrome-*` / `--nav-*` (coquille de sidebar), `--st-*` / `--pl-*`
(statuts de planning), `--font-display`.

### `--accent` est une **préférence utilisateur**, pas de la dette

Posé sur `<html data-accent>` par `hooks/useAccent`. *(État au 2026-08-06 : l'identité est
monochrome, le sélecteur a été retiré de la sidebar et `AccentProvider` démonté ; `--accent`
n'est plus lu que par le logo et quelques surfaces. Vérifier avant de s'y fier.)*

### Les noms legacy **redéfinis dans un autre scope**

Trois surfaces redéfinissent des noms identiques aux tokens Signature, pour un thème qui n'est pas
celui du PMS. Un `grep var(--ink)` les fera remonter ; les migrer casse le thème.

| Surface | Tokens redéfinis | Par quoi | Ce que ça thème |
|---|---|---|---|
| Livret d'accueil (`modules/welcome-guide/`) | `--ink`, `--ink-faint`, `--line`, `--bg`, `--raised`, `--terra*`, `--gold` | `welcomeBookThemes.ts` (5 thèmes) | la page vue par le **voyageur**, thémée par logement |
| Réservation publique (`booking-engine/public/PublicBookingPage.tsx`) | `--accent`, `--card`, `--ink`, `--muted`, `--line`, `--radius-*`, `--shadow-card` | `themeVars()` ← `DesignTokens` du site | le site de réservation **du client**, à sa marque |
| Sites générés (Studio / SDK) | `--bt-*` | contrat `DESIGN-BAITLY.md` | idem |

**Test avant de migrer un token qui ressemble à du legacy** : est-il *défini* quelque part dans le
module ? Si oui, il appartient à ce scope.

### `--radius-md`

Résout vers Signature (11 px), mais il est aussi lu par `grapesStudio.css` et **écrasé par site**
dans `PublicBookingPage` : c'est le mécanisme de thématisation des sites clients. Ne pas le
redéfinir globalement. `--radius` (base shadcn), lui, est défini dans `baitly-ui.css`.

---

## 4. Pièges que ni le typecheck ni le build ne voient

### Tokens interpolés

`` `var(--bui-${severity}-soft)` `` n'est vérifié par **rien**. Si le fragment ne correspond à aucun
token réel, la propriété est ignorée et l'élément perd sa couleur, en silence.

Cas réel : `ConfirmationModal` composait `` `var(--${severityToken}-soft)` `` après un renommage vers
`destructive`/`warning` — or `--destructive-soft` et `--warning-soft` n'existent nulle part. Le
bandeau serait devenu transparent.

**Après tout renommage** : vérifier que chaque valeur possible correspond à un token réellement
défini, en clair **et** en sombre.

### Variables inexistantes dans la feuille du kit

`baitly-nova.css` composait `var(--secondary)`, `var(--foreground)`, `var(--primary)`, `var(--radius)`,
`var(--sidebar-border)`, `var(--sidebar-accent)` — **aucune n'était définie**. Mesuré :
`color-mix(in oklch, var(--secondary), var(--foreground) 5%)` s'évaluait en `rgba(0,0,0,0)` ; ces
états de survol étaient morts.

**Toujours viser les `--bui-*`** : ce sont de vraies propriétés de `:root`. Les variables de thème
Tailwind ne le sont pas toutes — `@theme inline` n'émet pas tout (constaté : `--color-muted` présente
au runtime, `--color-secondary` absente).

### Classes qui ne compilent pas

- Une classe Tailwind **ne peut pas naître d'une variable** : elle est émise à la compilation par
  scan des sources. Couleur calculée à l'exécution → garder une valeur CSS (`var(--bui-…)`).
- Une classe contenant une espace n'existe pas : `p-[6px 10px]` n'a jamais rien produit.
- `font-[family-name:var(--fw-bold)]` déclare une `font-family` avec une valeur numérique : sans effet.
- `bg-[success.50]` : chemin de palette MUI, jamais compilé.
- **Vérifier une règle exotique dans le CSS bâti** : `grep` dans `dist/assets/*.css`. Attention à la
  forme émise — Tailwind écrit `@container (min-width:20rem)`, pas `(width >= 20rem)`.

### Mise en page

- `min-height: auto` ne vaut la hauteur du contenu **que si `overflow` est `visible`**. Un élément
  flex en `overflow: hidden` a un plancher de **zéro** : il absorbe seul tout le déficit de la
  colonne. Une carte s'est retrouvée à 61 px pour 372 px de contenu.
- `flex-1` (= `flex: 1 1 0%`) se résout à **zéro** quand le conteneur n'a pas de hauteur contrainte.
  Une liste a ainsi disparu, avec 10 éléments et 1071 px de contenu.
- **RTL** : propriétés logiques (`ms`, `ps`, `start`, `text-start`). `tailwind-merge` ne considère
  **pas** `start-*` en conflit avec `left-*` — pour neutraliser un `left-1/2`, écrire `inset-0`.
- Un **commentaire JSX** `{/* … */}` placé dans un emplacement d'expression (juste après `return (`
  ou `&& (`) est une **erreur de syntaxe**. Le mettre au-dessus, ou en `//`.
- Le **contexte React ne suit pas le DOM** : un composant `createPortal`é dans le slot d'un header
  garde le contexte de l'écran qui l'a rendu. Pour qu'un contrôle s'adapte à son emplacement, lui
  faire lire le seuil, pas un contexte.

---

## 5. Composition — réutiliser plutôt que redessiner

| Ce qu'on trouve | Ce qu'on met |
|---|---|
| `<div>` bordé + arrondi + fond carte | `Card` / `CardContent`, ou `Item` pour une ligne |
| Pastille de statut faite main | `Badge` ou `StatusChip` (`tone=` plutôt qu'un couple de tokens) |
| Bloc « libellé + grosse valeur » | `StatTile` |
| Rangée de tuiles KPI | `StatTileRow` — jamais une grille redéclarée par écran |
| Écran vide bricolé | `EmptyState` |
| Bandeau d'erreur | `Alert` + `AlertDescription` |
| En-tête d'écran / onglets | `PageHeader` + `PageTabs` |
| Recherche d'écran | `useScreenSearch` — **jamais** un champ dessiné dans la page |
| Pagination | `PagePagination` |
| Carte + liste | `MapWithSheet` |

**Attention aux primitives en double.** 28 composants existent en `components/X.tsx` (production) et
`components/baitly/X.tsx` (remaster). Un arbitrage complet a conclu : **5 adoptions seulement**
(`StatTile`, `FilterChipRow`, `PeriodSegmented`, `RevenueByChannelCard`, `ServiceRequestCard`).
Les 20 autres remasters sont **appauvris** — `StatusChip` y perd 11 props et l'accès clavier,
`PageTabs` le fil d'Ariane et son portail responsive, `EmptyState` son icône hero. Ne jamais
repointer un import vers `baitly/` sans comparer les API prop par prop.

---

## 6. Interdits produit

Bande latérale colorée > 1 px · texte en dégradé · glassmorphism décoratif · hero-metric ·
grille de cartes identiques · modale en premier réflexe · emoji comme icône (lucide via
`src/icons`) · `#000` / `#fff` purs · `scale()` au survol · tous les boutons en `variant="default"`.

---

## 7. Vérification

```bash
# Le seul typecheck qui fasse foi — `rtk tsc` masque les erreurs fatales.
rtk proxy npx tsc --noEmit --project <repo>/client/tsconfig.json
```

Puis `npm run build` — et pour toute règle CSS inhabituelle, vérifier qu'elle a bien été **émise**
dans `client/dist/assets/*.css`.

Contraste : viser 4,5:1 pour du texte (3:1 pour les icônes et le texte ≥ 24 px). Mesurer sur le
fond **réellement composé** — un fond pastel n'est pas la carte, et un `bg-muted/30` est une couleur
`oklab` à composer, pas du RGB.
