# 01 — Anatomie des blocs (source de vérité)

> **Référence code** : `clenzy/client/src/modules/booking-engine/studio/builder/blockRegistry.tsx`
> (registre canonique) + miroir SSR `clenzy-sites/src/lib/blocks.tsx`.
> Un template ne peut utiliser **QUE** les `type` et `props` listés ici. Toute autre clé est ignorée.

## Règles transverses (à respecter absolument)

1. **`props` = primitifs uniquement** : `string`, `number`, `boolean`. **Jamais** d'objet ou de tableau
   dans `props` (sauf le champ `children` du bloc `columns`, voir plus bas).
2. **Champs multi-lignes** (`items`, `images`) : une seule chaîne, items séparés par `\n` (saut de ligne).
3. **Champs « paire »** (`faq`, `stats`, `pricing`) : `Libellé | Valeur` (séparateur `|`), un par ligne.
4. **Couleurs** : chaîne hex (`#RRGGBB`). **Images** : URL absolue atteignable (sinon laisser `""`).
5. **Booléens** : `true` / `false` JSON (pas la chaîne `"true"`).

### Champs granulaires communs (édition par bloc 2.4)
Disponibles selon le bloc (voir colonne « align » ci-dessous) :
- `align` : `"left"` | `"center"` | `"right"` → `text-align` de la section.
- `bgColor` : couleur de fond hex (TOUS les blocs).
- `bgImage` : URL d'image de fond (**`hero` uniquement** dans le registre).

### Visibilité responsive (2.5) — sur TOUS les blocs
- `hideMobile`, `hideTablet`, `hideDesktop` : `boolean`. Masque le bloc au breakpoint.
- Breakpoints (container queries) : **mobile ≤ 600px · tablette 601–1024px · desktop > 1024px**.

### Override de valeur par breakpoint (2.5)
N'importe quelle prop peut avoir une variante mobile/tablette via une **clé suffixée** :
`"title@mobile": "Titre court"`, `"subtitle@tablet": "..."`. La valeur de base s'applique à desktop.
Exclu : `columnCount` (structurel). Le SSR sert la **valeur de base** (pas de viewport au rendu serveur),
donc garde la base auto-suffisante.

---

## Les 15 blocs

### `hero` — Bannière
Titre + accroche + barre de recherche (lien `#reserver`).
| prop | type | notes |
|---|---|---|
| `eyebrow` | text | sur-titre court (optionnel, `""` pour masquer) |
| `title` | text | titre principal |
| `subtitle` | textarea | accroche (optionnel) |
| `showSearch` | boolean | affiche la barre « Rechercher » → `#reserver` |
| `align` · `bgColor` · `bgImage` | — | granulaires |

### `propertyGrid` — Grille de logements
Rend les **vraies fiches** (cartes cliquables → `/logement/{id}`, jusqu'à 12) ; repli squelette si aucune propriété.
| prop | type | notes |
|---|---|---|
| `heading` | text | titre de section |
| `subheading` | text | sous-titre (optionnel) |
| `columns` | number | 1–4 (colonnes de la grille) |
| `bgColor` | color | — |

### `amenities` — Équipements
| prop | type | notes |
|---|---|---|
| `heading` | text | — |
| `items` | textarea | **un équipement par ligne** |
| `bgColor` | color | — |

### `richText` — Texte
| prop | type | notes |
|---|---|---|
| `content` | textarea | texte libre |
| `align` · `bgColor` | — | granulaires |

### `testimonial` — Témoignage
| prop | type | notes |
|---|---|---|
| `quote` | textarea | la citation (rendue entre « … ») |
| `author` | text | ex. « Camille D., Lyon » |
| `align` · `bgColor` | — | granulaires |

### `cta` — Appel à l'action
| prop | type | notes |
|---|---|---|
| `title` | text | — |
| `buttonLabel` | text | libellé du bouton |
| `buttonUrl` | url | **défaut `#reserver`** si absent |
| `align` · `bgColor` | — | granulaires |

### `footer` — Pied de page
| prop | type | notes |
|---|---|---|
| `text` | text | mentions / copyright |
| `bgColor` | color | — |

### `faq` — Questions fréquentes
| prop | type | notes |
|---|---|---|
| `heading` | text | — |
| `items` | textarea | **`Question | Réponse`**, une par ligne |
| `align` · `bgColor` | — | granulaires |

### `gallery` — Galerie d'images
| prop | type | notes |
|---|---|---|
| `heading` | text | optionnel |
| `images` | textarea | **une URL d'image par ligne** |
| `columns` | number | 1–4 |
| `bgColor` | color | — |

### `stats` — Chiffres clés
| prop | type | notes |
|---|---|---|
| `items` | textarea | **`Valeur | Libellé`**, un par ligne (ex. `4.9/5 | Note moyenne`) |
| `bgColor` | color | — |

### `video` — Vidéo
| prop | type | notes |
|---|---|---|
| `heading` | text | optionnel |
| `url` | url | **YouTube / Vimeo** (converti en embed automatiquement) |
| `bgColor` | color | — |

### `map` — Carte
| prop | type | notes |
|---|---|---|
| `heading` | text | optionnel |
| `address` | text | adresse → Google Maps embed |
| `bgColor` | color | — |

### `pricing` — Table de prix
| prop | type | notes |
|---|---|---|
| `heading` | text | — |
| `items` | textarea | **`Libellé | Prix`**, un par ligne |
| `align` · `bgColor` | — | granulaires |

### `logos` — Bandeau de logos
| prop | type | notes |
|---|---|---|
| `heading` | text | optionnel |
| `images` | textarea | **une URL de logo par ligne** |
| `bgColor` | color | — |

### `columns` — Colonnes (conteneur de mise en page)
Place d'autres blocs côte à côte. **Particularité** : ses enfants vivent dans `children`, PAS dans `props`.
| prop | type | notes |
|---|---|---|
| `columnCount` | select | `"2"` \| `"3"` \| `"4"` (chaîne) |
| `gap` | select | `"sm"` \| `"md"` \| `"lg"` |
| `align` · `bgColor` | — | granulaires |

**`children`** (au niveau du bloc, à côté de `type`/`props`) : **un tableau par colonne**, chaque colonne
étant un tableau de blocs.
```json
{
  "type": "columns",
  "props": { "columnCount": "2", "gap": "md" },
  "children": [
    [ { "type": "richText", "props": { "content": "Colonne gauche…" } } ],
    [ { "type": "amenities", "props": { "heading": "Inclus", "items": "Wi-Fi\nParking" } } ]
  ]
}
```
- Le nombre de tableaux dans `children` doit correspondre à `columnCount`.
- **Pas d'imbrication** : un `columns` ne peut PAS contenir un autre `columns`.
- Blocs autorisés dans une colonne : tous **sauf** `columns`.

---

## Classes CSS (`bkly-*`)
Chaque bloc rend une racine `bkly-section bkly-<nom>` stylée par `globals.css` (SSR) / `blockStyles.css`
(Studio). Le CSS custom de l'org peut les surcharger (cf. onglet CSS du Studio). Pour un template,
**ne dépends pas de CSS custom** : compose uniquement avec les blocs + le thème (tokens).
