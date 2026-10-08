# Baitly — Icônes

Stack icônes (migration Lucide → Reicon) :

- **[Reicon](https://reicon.dev)** (primaire) — glyphes 24 px dessinés en aplats, graisse **duotone privilégiée** (aplat à 50 % + trait plein). Contour quand Reicon n'a pas de duotone pour le glyphe, variante pleine sur demande (`fill`).
- **[Iconify](https://icon-sets.iconify.design)** (fallback) — pour les rares pictos absents de Reicon (fer à repasser, escalier, porte coulissante, logos de marque).

Les données SVG viennent de [`@iconify-icons/reicon`](https://www.npmjs.com/package/@iconify-icons/reicon) (un module par glyphe : tree-shaking et découpage par route préservés). Les paquets `reicon-react` officiels n'exposent que Outline/Filled : le duotone n'est disponible que dans le jeu Iconify.

## Usage côté composant

```tsx
import { Edit, Delete, Save, ChevronRight } from '../../icons';

<Edit size={16} />
<Delete size={16} color="var(--danger)" />
<Save size={18} />
<ChevronRight size={14} />
```

Les écrans qui importaient directement `lucide-react` importent désormais `src/icons/glyphs` : ce module expose les **noms historiques Lucide** (`Trash2`, `CheckCircle`, `XIcon`, `Loader2`…) branchés sur des glyphes Reicon, pour que la migration n'ait rien changé au JSX.

### Props

| Prop | Défaut | Rôle |
|------|--------|------|
| `size` | 24 | largeur + hauteur |
| `color` | `currentColor` | teinte du glyphe |
| `weight` | `duotone` | `'duotone' \| 'outline' \| 'filled'` — repli automatique si la variante n'existe pas |
| `fill` | — | compat Lucide : `"none"`/`"transparent"` → contour, toute autre valeur → variante pleine (teintée de cette valeur si ≠ `currentColor`) |
| `strokeWidth` | — | compat Lucide, **sans effet** (glyphes en aplats) |
| `className`, `style`, props SVG | — | relayés sur le `<svg>` |

Types : `IconComponent` (ex-`LucideIcon`) et `IconProps` (ex-`LucideProps`), exportés par `src/icons/glyphs`.

Les classes Tailwind `fill-*` / `stroke-*` n'ont pas d'effet sur un glyphe Reicon : utiliser `text-*` (teinte) et `fill` / `weight` (graisse).

### Fallback Iconify

```tsx
import { IconifyIcon } from '../../icons';

<IconifyIcon icon="mdi:hot-tub" width={16} />
```

## Ajouter une icône

1. Chercher le glyphe sur https://reicon.dev (préférer un glyphe qui existe en `-duotone`).
2. L'ajouter à `client/scripts/reicon/glyph-map.json` (`"NomComposant": "nom-reicon"`, sans suffixe).
3. Régénérer : `node scripts/reicon/generate-glyphs.mjs` (depuis `client/`). Le script échoue si le glyphe n'existe pas.
4. Exporter un nom sémantique depuis `index.ts` si l'icône a vocation à être partagée.

Glyphes hors Reicon écrits à la main (listés dans `custom` de `glyph-map.json`, conservés par le générateur) : `SaudiRiyal`.

## Conventions

### Tailles standards
- **14** : micro-UI (chips, tooltips, badges inline)
- **16** : actions de table, IconButton dense
- **18** : actions par défaut, boutons standards
- **20** : titres de section
- **22-24** : headers, tabs principaux
- **40+** : empty states, hero illustrations

### Graisse
- **duotone** (défaut) : toute l'interface.
- **filled** : notation (étoiles, cœurs) et pastilles très petites (`BroomFill`, `CreditCardFill`…).
- **outline** : états « vides » (étoile non cochée) ou glyphes sans duotone.

## Historique

| Phase | Périmètre | Statut |
|-------|-----------|--------|
| 1-9 | Migration `@mui/icons-material` → Lucide + barrel `@/icons` | ✅ |
| 10 | Lucide + Tabler → Reicon duotone (app, site vitrine, studio GrapesJS) | ✅ |
