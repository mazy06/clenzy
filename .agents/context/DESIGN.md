# DESIGN.md — Baitly UI

> Système de design consommé par le skill `impeccable`. Décrit ce qui EXISTE dans
> le code, pas une intention. Source de vérité des valeurs :
> `client/src/theme/baitly-ui.css` (tokens `--bui-*`) et
> `client/src/theme/baitly-nova.css` (classes `cn-*` des composants).
>
> ⚠️ Deux systèmes coexistent. `client/src/theme/signature/tokens.css` (`--accent`,
> `--ink`, `--card`…) sert la couche **MUI legacy**. Tout code neuf passe par la
> couche **Baitly UI** (`--bui-*` + utilities Tailwind v4) décrite ici.

## Couleur

Stratégie : **Restrained**. Neutres teintés + un accent, jamais plus.

### Identité

Primaire = **bleu nuit #1B2A35**, la couleur du wordmark. Inversée en sombre
(#E8EEF5 sur navy), comme le wordmark. Décidée le 2026-07-23, en rupture avec le
bleu-gris Clenzy #6B8A9A.

### Surfaces

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| `background` | `#F4F7F9` | `#0A1120` | Fond de page |
| `card` | `#FBFCFD` | `#111B31` | **Surface surélevée** |
| `muted` | `#EEF3F7` | `#16223A` | Fond de survol, blocs enfoncés |
| `border` | `#E2E8F0` | `#1E293F` | Filets d'1px |

**Règle de surface** : `card` est TOUJOURS le cran au-dessus de `background`.
En clair il est plus clair, en sombre il est plus clair aussi. Un élément qui doit
se détacher prend `card` ; en `muted` il s'enfonce.

### États

`success` `#14B8A6` / `warning` `#D4A574` / `info` `#2563EB` / `destructive` `#C97A7A`,
chacun avec sa variante `-soft` (fond pastel).

⚠️ **Les teintes d'état ne sont PAS des couleurs de texte en thème clair.**
`text-warning` donne 2,17:1 et `text-success` 2,42:1 sur `card`, très en dessous du
seuil AA de 4,5:1. Pour écrire, utiliser les encres :

- `--bui-warning-ink` : `#7A5320` en clair (6,6:1), `#E0B483` en sombre (9:1)
- (`--bui-success-ink` : même principe)

Le couple **fond pastel + encre foncée** est celui des tags Notion. Les teintes
claires restent pour les fonds, pastilles, anneaux et traits SVG.

### Interdits couleur

- `#000` et `#fff` purs. L'encre est le bleu nuit, jamais le noir.
- Plus d'un accent actif sur une surface. Les états « normaux » (actif, auto,
  synchronisé) restent gris : on colore l'exception.
- Une couleur d'identité par entité (agent, canal…) qui détourne un token
  sémantique : un point vert doit vouloir dire « sain », pas « c'est Sync ».

## Typographie

Pile système : `ui-sans-serif, system-ui, sans-serif`. Une seule famille, pas de
pairing display/body. (La couche MUI legacy utilise encore Plus Jakarta Sans et
Space Grotesk.)

**Plancher à 12px** (`text-xs`). `text-2xs` (10px) existe mais ne doit plus porter
d'information : la densité vient du rythme des lignes, pas du rapetissement.

Hiérarchie par **échelle + graisse**, jamais par la couleur seule. `font-medium`
(500) pour les libellés, `font-semibold` (600) réservé à ce qui doit ressortir.

`tabular-nums` obligatoire sur tout chiffre : montants, compteurs, pourcentages,
dates. `[text-wrap:balance]` sur les titres.

## Rayons

Échelle : `sm` 6px · `md` 8px · `lg` 10px · `xl` 14px · `2xl` 18px.

Blocs de contenu et puces : 6–8px. Le `xl` (14px) fait « web-app 2021 » sur un bloc
de contenu. `rounded-full` réservé aux pastilles, avatars et nœuds de diagramme.
Pas de pilule sur les badges.

## Élévation

**Pas d'ombre sur les éléments en flux.** La hiérarchie passe par la surface
(`card` vs `background`) et par les filets. Les ombres sont réservées aux couches
flottantes (popover, dropdown, dialog, drawer).

## Mouvement

Registre product : **150–250 ms** sur la plupart des transitions.

- Survol / retour instantané : 100–150 ms
- Changement d'état, révélation : 150–250 ms
- Easing : `cubic-bezier(.25, 1, .5, 1)` (ease-out-quart). Jamais de rebond ni
  d'élastique.

**Aucune animation infinie au repos**, sauf si elle porte un état que l'utilisateur
doit remarquer (une file qui attend une décision). Pas de chorégraphie au montage :
l'utilisateur arrive dans une tâche, il ne regarde pas l'écran se charger.

`prefers-reduced-motion` : **supprimer** l'animation décorative (`display: none`),
pas la ralentir. Dégrader vers l'état statique lisible.

## Composants

Kit shadcn/ui porté dans `client/src/components/ui` (~60 composants, style « Nova »),
plus les primitives métier dans `client/src/components/baitly`
(`PageHeader`, `StatusChip`, `StatTile`, `EmptyState`, `Money`, `PageTabs`…).

Ne pas réinventer une primitive existante. Pour les pages multi-onglets, utiliser
`PageHeaderActionsContext` (cf. CLAUDE.md).

Chaque composant interactif doit avoir : défaut, survol, focus, actif, désactivé,
chargement, erreur. Squelettes plutôt que spinners. États vides qui enseignent
l'interface, jamais une bordure pointillée centrée.

## RTL

L'arabe est une langue supportée. **Propriétés logiques exclusivement** : `ps-*`
`pe-*` `ms-*` `me-*` `start-*` `end-*` `text-start` `border-s-*`. Le physique
(`left`, `right`) n'est toléré que sur un schéma géométrique qui ne se miroite pas,
et doit alors être commenté.

## Checklist avant livraison

- [ ] Aucun emoji en guise d'icône
- [ ] `cursor: pointer` sur tout ce qui est cliquable
- [ ] Contraste texte ≥ 4,5:1 **en clair ET en sombre** (vérifier par le calcul,
      pas à l'œil : les teintes d'état échouent en clair)
- [ ] Focus visible au clavier
- [ ] `prefers-reduced-motion` respecté
- [ ] Testé 375 / 768 / 1024 / 1440
- [ ] `tabular-nums` sur les valeurs numériques
- [ ] Aucune affordance accessible au seul survol
- [ ] Pas de `#000` ni de `#fff`
