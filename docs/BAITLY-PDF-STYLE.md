# Template PDF Baitly — guide de style

> **Objectif** : tout document PDF Baitly (dossier, ADR, présentation, rapport) doit
> avoir la **même identité visuelle**. Ce style est **formalisé et centralisé** dans le
> module `docs/baitly_pdf_theme.py`. Un nouveau générateur **importe le thème** et se
> concentre sur le contenu — il ne redéfinit **jamais** la palette, les polices, la
> couverture, les tableaux ou le footer.
>
> Document de référence (usage exemplaire) : `docs/generate_paiement_multiprovider_pdf.py`
> → `analyse-concurrentielle/pdf/paiement-multi-fournisseurs-dossier.pdf`.

## 1. Démarrage rapide

```python
from baitly_pdf_theme import *   # palette, polices, styles, helpers, make_doc, build_cover

story = []
build_cover(
    story,
    eyebrow="ARCHITECTURE · DOSSIER · CONFIDENTIEL",
    title_lines=["Mon <font color='#6B8A9A'>titre</font>", "sous-titre du titre"],
    subtitle="Une phrase de description du document.",
    meta_rows=[("Objet", "…"), ("Version", "1.0 — 14 juillet 2026")],
)
story.append(Paragraph("1. Ma section", H1))
story.append(Paragraph("Texte courant avec un <b>mot important</b>.", BODY))
story.append(table([hcells("Colonne A", "Colonne B"),
                    cells("valeur 1", "valeur 2")],
                   [40 * mm, USABLE_W - 40 * mm]))

make_doc("sortie.pdf",
         title="Baitly - Mon document",
         footer_label="Baitly · Mon document · 2026-07-14 · Confidentiel",
         cover_ref="Baitly · chemin/source.md").build(story)   # cover_ref : optionnel
```

`make_doc` gère automatiquement la **pagination « p. X / Y »** (nombre total de pages)
et un footer à glyphe. `table()` produit des **tableaux à coins arrondis** (en-tête clair
+ filet d'accent teal). `build_cover` produit une couverture façon ADR (logo dessiné,
barre gradient, titre bi-ton, filet teal, table meta **sans en-tête** à 1re valeur en gras,
motif constellation en filigrane).

Le générateur se lance avec `python3 docs/mon_generateur.py` (le dossier `docs/` est sur
le `sys.path`, donc `from baitly_pdf_theme import *` fonctionne).

## 2. Identité visuelle

### Couleurs (palette exportée)

| Constante | Hex | Usage |
|---|---|---|
| `PRIMARY` | `#3E5A68` | bleu-gris principal — titres, en-têtes |
| `PRIMARY2` | `#6B8A9A` | bleu-gris clair — 2ᵉ ton du titre, traits |
| `ACCENT` | `#4A9B8E` | teal — filets d'accent, marqueur « oui » |
| `WARN` | `#D4A574` | ambre — partiel / important |
| `DANGER` | `#C97A7A` | rouge doux — obligatoire / échec |
| `INK` | `#26333B` | texte courant (**jamais de noir pur**) |
| `MUTED` | `#6A7A82` | texte secondaire, légendes |
| `LIGHT`/`LINE`/`HEADER_BG` | clairs | fonds, bordures, en-tête de tableau |

### Police

**Avenir Next** (géométrique humaniste), avec **repli automatique Helvetica** si la police
n'est pas installée (portabilité hors macOS). Exposée via `FONT`, `FONT_MED`, `FONT_DEMI`,
`FONT_BOLD`, `FONT_IT`. Les styles (`H1`, `BODY`…) l'utilisent déjà — ne pas coder une
police en dur.

### Logo & motif

- `baitly_logo()` — le logo dessiné (**mark 8 nœuds « orchestration » + wordmark**).
  ⚠️ **Ne PAS** utiliser `client/src/assets/Baitly_logo.png` : cet asset contient encore
  l'ancien logo **Clenzy**.
- `constellation(canvas, cx, cy, r, color, …)` — le motif Baitly (filigrane de couverture,
  glyphe du footer). Déjà posé par le thème.

## 3. Anatomie de la couverture (`build_cover`)

De haut en bas : **barre gradient arrondie** · logo Baitly · **eyebrow** en petites
capitales séparées par `·` · **titre bi-ton** (2ᵉ ton en `<font color='#6B8A9A'>`) ·
**filet d'accent teal** · sous-titre · **table meta** (en-tête clair). Motif constellation
en filigrane bas-droite + footer à glyphe. `build_cover` bascule ensuite automatiquement
sur le gabarit `content` et saute une page.

## 4. Composants

| Besoin | Helper | Note |
|---|---|---|
| Section | `Paragraph("1. Titre", H1)` / `H2` / `H3` | H1/H2 = PRIMARY ; H3 = ACCENT |
| Corps | `BODY`, `BULLET`, `SMALL`, `CAP` | `CAP` = légende de figure |
| Tableau | `table(data, widths, align_center_cols=…)` | en-tête **clair** + filet teal ; zébrures douces |
| En-tête de tableau | `hcells("A", "B")` | texte foncé (jamais blanc) |
| Cellules | `cells("x", "y")` | |
| Bandeau de partie | `part_banner("I", "Titre")` | pleine largeur, fond PRIMARY |
| Figure | `fig(drawing, "Figure N — …")` | dessin + légende, gardés ensemble |
| Marqueurs matrice | `yes()` `no()` `part()` `soon()` `ok()` | **jamais d'emoji** |
| Code inline | `code("Identifiant")` | surlignage gris clair |
| Criticité | `crit_cell("OBLIGATOIRE"/"IMPORTANTE"/"OPTIONNELLE")` | pastille colorée |

## 5. Règles absolues (pièges reportlab)

1. **Jamais d'emoji** (✅ ❌ 🇲🇦 …) dans une cellule ou un dessin : ils s'affichent en
   **carrés noirs**. Utiliser `yes()`/`no()`/`part()` ou une puce `&bull;`.
2. **Jamais le glyphe `→` (U+2192)** : Avenir ne l'a pas (**tofu ▯**). Écrire `->`.
   De même, éviter les flèches/symboles exotiques dans le texte ; les dessins utilisent
   des flèches vectorielles (`_arrow`).
3. **Pas de noir/blanc purs** : `INK` (texte), fonds teintés.
4. **Ne pas redéfinir** palette/polices/couverture/tableaux/footer dans un générateur :
   tout vient du thème. Un besoin nouveau → l'ajouter **au thème**, pas au document.
5. **Diagrammes** : réutiliser les primitives (`String(..., fontName=FONT)`, boîtes
   arrondies, `constellation`). Les flèches doivent **repartir en arrière** depuis la tête
   (petit écart angulaire ~0,42 rad — sinon la pointe s'inverse).

## 6. Étendre le thème

Un composant réutilisable par plusieurs documents (nouveau type de bloc, nouvelle palette
d'état, nouveau gabarit) se met dans `docs/baitly_pdf_theme.py` et s'ajoute à `__all__`.
Un composant propre à **un seul** document (un diagramme spécifique) reste dans son
générateur. Règle : *si un 2ᵉ document pourrait en avoir besoin → thème*.
