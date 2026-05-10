# Clenzy — Icônes

Stack icônes moderne (migration depuis `@mui/icons-material` terminée en phase 9) :

- **[Lucide](https://lucide.dev)** (primaire) — strokes 2px, ~1600 icônes, look "Linear/Notion/shadcn"
- **[Iconify](https://icon-sets.iconify.design)** (fallback) — méta-aggrégateur 150+ sets, lazy-loadé

Toutes les icônes sont ré-exportées depuis `client/src/icons/index.ts` avec des **noms sémantiques stables**, indépendants de la lib source.

## Usage côté composant

```tsx
import { Edit, Delete, Save, ChevronRight } from '../../icons';

<Edit size={16} strokeWidth={1.75} />
<Delete size={16} />
<Save size={18} />
<ChevronRight size={14} />
```

### Props standards (Lucide)

| Prop | Défaut | Equivalent MUI |
|------|--------|----------------|
| `size={16}` | 24 | `sx={{ fontSize: 16 }}` |
| `strokeWidth={1.75}` | 2 | — |
| `color="#f59e0b"` | currentColor | `htmlColor` |
| `className` | — | idem |

### Props standards (Iconify, via `IconifyIcon`)

```tsx
import { IconifyIcon } from '../../icons';

<IconifyIcon icon="mdi:stairs" width={18} />
<IconifyIcon icon="solar:bed-bold-duotone" width={20} color="#3b82f6" />
```

Le set `mdi:` (Material Design Icons community) est le filet de sécurité quand Lucide manque (ex : `mdi:iron`, `mdi:stairs`, `mdi:hot-tub`).

## Conventions

### Tailles standards
- **14** : micro-UI (chips, tooltips, badges inline)
- **16** : actions de table, IconButton dense
- **18** : actions par défaut, boutons standards
- **20** : titres de section
- **22-24** : headers, tabs principaux
- **40+** : empty states, hero illustrations

### `strokeWidth`
- **1.5** : icônes décoratives (ne portent pas le sens principal)
- **1.75** : valeur par défaut produit Clenzy (légèrement plus fin que le défaut Lucide)
- **2** : actions critiques (delete, danger)

## Ajouter une nouvelle icône

1. **Vérifier d'abord Lucide** : https://lucide.dev/icons/
2. Si présent → ajouter un export dans `index.ts` avec le nom sémantique :
   ```ts
   export { LineChart as ShowChart } from 'lucide-react';
   ```
3. Si absent → utiliser Iconify directement dans le composant :
   ```tsx
   import { IconifyIcon } from '../../icons';
   <IconifyIcon icon="mdi:hot-tub" width={16} />
   ```
   Ou créer un wrapper dans `index.ts` (pattern `Iron` actuel) si l'icône est utilisée à plusieurs endroits.

## Pourquoi pas un wrapper `<AppIcon name="..." />` ?

Un wrapper runtime perdrait le tree-shaking : tout le bundle Lucide finirait dans le build. Avec le barrel d'exports nommés, chaque import individuel `import { Edit } from '@/icons'` ne tire que l'icône `Edit` dans le bundle final.

## Historique de migration

| Phase | Périmètre | Statut |
|-------|-----------|--------|
| 1 | Setup (libs + barrel + 30 icônes communes) | ✅ |
| 2 | Composants partagés (PageHeader, FilterSearchBar, dialogs) | ✅ |
| 3 | Properties (18 fichiers) | ✅ |
| 4 | Interventions + Service Requests (23 fichiers) | ✅ |
| 5 | Planning (22 fichiers, ~290 icônes) | ✅ |
| 6 | Dashboard (40 fichiers, ~260 icônes) | ✅ |
| 7 | Settings + Organization + Users + Teams (33 fichiers) | ✅ |
| 8 | Reste — Documents/Booking Engine/Channels/Tarification/etc. (117 fichiers) | ✅ |
| 9 | Drop `@mui/icons-material` + code-splitting bundle | ✅ |

Tous les fichiers utilisent désormais `@/icons` — aucun import `@mui/icons-material` ne subsiste dans `src/`.
