# Illustrations des catalogues Baitly

48 illustrations générées le 9 octobre 2026 avec ImageGen pour Prestataires,
Boutique et Services payants. Style commun : objets en volume, bleu nuit,
bleu-gris, ivoire et ambre discret. Les illustrations d'équipements représentent
les catégories de produits ; les identifiants et caractéristiques commerciales
restent définis dans `shopProducts.ts`.

Les fichiers WebP mesurent au maximum 320 × 320 pixels, conservent leur alpha
et sont compressés en qualité 82. Les PNG originaux restent dans le répertoire
local des images générées par Codex.

- Boutique : six équipements distincts et trois compositions de kits.
- Services : petit-déjeuner, ménage, équipement, transfert, parking,
  expérience et service complémentaire.
- Expériences partenaires : sept illustrations adaptées au sujet.
- Prestataires sans photo : illustration professionnelle, accompagnée
  des initiales. Les photos fournies par les prestataires sont conservées.
- Guides touristiques : carte d'itinéraire, sac et boussole
  (`excursion-guide.webp`). Activités : montgolfière (`gyg-balloon.webp`).

## Référentiel des secteurs

`client/src/modules/marketplace/providerSectorImages.ts` associe une image
distincte à chacun des 32 codes métier du référentiel backend. Les cartes
utilisent le premier secteur connu du prestataire lorsqu'il n'a pas de photo.
Le menu Métier utilise le même référentiel de vignettes.

23 illustrations `sector-*.webp` complètent les images existantes : blanchisserie,
linge, logistique, sécurité, conciergerie, maintenance, serrurerie, jardin,
piscine, nuisibles, contrôles, rénovation, véhicules, bien-être, garde d'enfants,
animaux, photographie, ameublement, marketing, juridique, comptabilité,
assurance et énergie/connectivité. Un secteur inconnu conserve l'illustration
professionnelle générique.

Les offres avec une image personnalisée conservent leur image. Les illustrations
de catégorie servent de repli. Les clés, références et SKU historiques ne sont
pas renommés.
