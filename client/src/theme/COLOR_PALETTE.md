# Palette de couleurs Baitly

> Source de vérité : `theme/signature/tokens.css`. Ce document explique les
> intentions ; il ne redéfinit rien. En cas d'écart, **c'est le fichier de
> jetons qui a raison** — ce document a déjà décrit pendant des mois une
> identité que le code n'appliquait plus.

## Trois rôles, jamais confondus

L'erreur qui a coûté le plus cher est d'avoir fait porter deux rôles à une même
teinte. Une couleur vive lue en TEXTE plafonne autour de 2,2:1 sur une carte
claire : c'est illisible, et aucun typecheck ne le voit.

| Rôle | Sert à | Ne sert jamais à |
|---|---|---|
| **Teinte vive** | aplats, icônes, bordures, pastilles | le texte |
| **`-ink`** | le texte, et lui seul | un fond |
| **`-soft`** | fonds pastel, états actifs | le texte |

## Marque

La marque est **noire**, les commandes sont **terracotta**. Les deux ne parlent
pas la même langue : le noir dit « Baitly », la terracotta dit « ceci s'actionne ».

| Jeton | Clair | Sombre | Usage |
|---|---|---|---|
| `--brand-ink` | `#171310` | `#F0EBE6` | logo (mark + lettrage), marqueurs de marque |
| `--accent` | `#B45733` | `#DE855E` | boutons primaires, liens, sélection |
| `--accent-deep` | `#96472A` | `#C96E48` | survol du bouton primaire |
| `--accent-soft` | `rgba(180,87,51,.10)` | `rgba(222,133,94,.18)` | fond doux, état actif |
| `--on-accent` | `#FFFFFF` | `#241812` | encre POSÉE sur l'accent |

Deux points qui ne sont pas des détails :

- Le noir n'est pas `#000`. Un noir neutre jure avec une palette chaude ; il est
  tinté vers la terracotta. Même règle pour le blanc.
- `--on-accent` **s'inverse** avec le thème. En sombre l'accent s'éclaircit, et
  un libellé blanc y tombe à 2,75:1. L'encre passe donc au noir de marque, à
  6,28:1.

La terracotta par défaut n'est pas celle de la galerie d'accents (`#C0613B`) :
celle-là ne porte le texte blanc qu'à 4,19:1. Tolérable pour un accent qu'on
choisit, pas pour celui que porte chaque bouton primaire de l'application.

## Sémantique

| Jeton | Valeur | Sens |
|---|---|---|
| `--ok` | `#4A9B8E` | succès, validé |
| `--warn` | `#C28A52` | attention |
| `--err` | `#C97A7A` | erreur |
| `--info` | `#7BA3C2` | information |
| `--paid` / `--unpaid` | `#3E9C80` / `#C9803F` | état de paiement |

Ces jetons disent **ce qui se passe**, pas de quelle famille visuelle ils
viennent. Ne pas les dériver de l'accent : ils doivent survivre à un changement
de marque.

## Statuts du planning — « Terre cuite »

Une famille de bruns où la **valeur encode la présence** : plus le voyageur est
là, plus la brique est dense. Définie dans `modules/planning/planningUrgency.css`,
trois jetons par statut (`--pl-st-{x}` / `-on` / `-ink`).

| Statut | Brique | Encre sur brique | Sens |
|---|---|---|---|
| En attente | `#E0C89B` | foncée | rien n'est acquis |
| Confirmée | `#9A6C3A` | blanche | le séjour tient |
| Sur place | `#5C3A21` (`#6B4527` en sombre) | blanche | le voyageur est là |
| Partie | `#A89684` | foncée | le passé se retire |
| Annulée | — | — | brique fantôme hachurée |

Ces teintes **ne sont pas** les jetons sémantiques, même quand les valeurs se
sont historiquement croisées. Un séjour confirmé n'est pas un « succès ».

## Ce qui ne suit PAS cette palette

- **Palettes de canal** (`--airbnb`, `--booking`…) : couleurs de marque de tiers.
- **Chrome de navigation** (`--chrome-*`, `--nav-*`) : sombre dans les deux thèmes.
- **Surfaces voyageur** : livret d'accueil, page de réservation publique et sites
  générés (`--bt-*`) redéfinissent `--ink`, `--card`, `--accent`… pour le thème
  **du client**, pas celui du PMS. Test : le jeton est-il *défini* dans le
  module ? Alors il lui appartient.

## Avant de poser une couleur

1. Quel rôle — aplat, texte, ou fond doux ?
2. Un jeton existe-t-il déjà ? Une valeur en dur ne suivra pas le thème.
3. Contraste **mesuré**, pas estimé : 4,5:1 pour du texte, dans les deux thèmes.
   Une correspondance « fidèle » de jeton ne suffit pas — `--faint` donnait
   2,48:1 là où il fallait `--muted-foreground` à 4,80:1.
