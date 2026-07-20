# Templates Baitly — authoring galerie « Collection Maroc »

Sources d'authoring des templates du booking engine (contrat [`DESIGN-BAITLY.md`](../DESIGN-BAITLY.md)).
Chaque template est un module `.mjs` (HTML/CSS lisibles) compilé en JSON ingérable.

## Workflow

```bash
node booking-templates/build.mjs                                  # → dist/<slug>.json + dist/preview/<slug>/*.html
node scripts/validate-baitly-template.mjs booking-templates/dist/<slug>.json
# puis ingestion (staff) : POST /api/booking-engine/site-templates/ingest avec le JSON
```

Les previews `dist/preview/` sont des pages autonomes (fr LTR + variante `.rtl.html` en arabe simulé)
avec des placeholders visuels pour les marqueurs `data-clenzy-widget` — pour la revue avant ingestion.

## Galerie (8 templates validés, Maroc-first)

| Slug | Positionnement | Statut |
|---|---|---|
| `riad-medina` | Riad médina (Marrakech/Fès), quiet luxury éditorial | authoring |
| `villa-palmeraie` | Villa piscine Palmeraie, one-page lumineux | authoring |
| `dar-atlantique` | Côte Essaouira/Taghazout | à faire |
| `kasbah-atlas` | Lodge Atlas + événements | à faire |
| `conciergerie-urbaine` | Appartements Casa/Rabat multi-biens | à faire |
| `collection-sud` | Portail conciergerie multi-destinations | à faire |
| `residence-balneaire` | Resort Agadir + packages | à faire |
| `bivouac-etoile` | Camp désert Merzouga/Agafay | à faire |

`dist/` est un artefact de build (non versionné).
