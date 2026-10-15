# Badges illustrés Baitly

Huit images générées avec l’outil intégré imagegen, sans fond, pour les cartes de conciergeries.
Un seul badge sans texte dans le coin supérieur gauche des cartes. La fiche détaillée peut afficher tous les badges justifiés, sans libellé visible.
Les seuils ci-dessous sont des règles produit initiales, pas une certification externe.

| Image | Critère d’affichage |
| --- | --- |
| fire.png | Occupation annuelle ≥ marché comparable + 10 points ; au moins 20 biens dans le benchmark et 2 dans le portefeuille. |
| occupancy.png | Occupation ≥ 75 % sur une année civile complète, au moins 2 logements. |
| favorite.png | Note voyageurs ≥ 4,8/5 et au moins 20 avis voyageurs. Les avis de prestations ne servent pas de substitut. |
| profit.png | Revenus nets comparables en hausse d’au moins 10 %, coûts et périmètre comparables validés en amont. |
| premium.png | Positionnement premium explicitement vérifié. |
| small-homes.png | Au moins 70 % du portefeuille publié de surface comprise entre 0 et 60 m², au moins 2 biens. |
| full-service.png | Annonces, tarification, accueil, ménage, maintenance et suivi propriétaire proposés. |
| direct-booking.png | Site de réservation directe actif et vérifié. Un domaine de démonstration ne suffit pas. |

Source : `src/features/conciergeries/badges.ts`. Les données manquantes ne déclenchent aucun badge.
Les cartes locales utilisent les chiffres et services des profils fictifs déjà identifiés comme démo.
L’API publique réelle fournit actuellement uniquement l’occupation annuelle nécessaire à son badge.
Les autres critères restent masqués en réel tant que des preuves publiques adéquates ne sont pas fournies.
Les badges ne modifient pas le classement et n’introduisent pas d’exposition de données privées.

## Prompts de génération

Mode : outil intégré, transparence activée. Prompt commun : miniature physique 3D premium,
céramique ivoire mate et laiton brossé, bleu-gris #6B8A9A, sauge #4A9B8E, laiton #D4A574,
orange terre cuite, vue trois-quarts, éclairage studio doux, silhouette simple lisible à 36 px,
centrée à 80 % du carré, sans texte, cercle, bordure, fond coloré ni filigrane.

Sujets : flamme orange et laiton ; couronne dorée ; pièce et flèche ascendante ; calendrier
rempli avec petite flamme ; cœur terre cuite ; studio miniature ; clé et bouclier ; maison
et curseur de réservation.
