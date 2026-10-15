# Illustrations Baitly sans fond studio

Le 12 octobre 2026, 113 WebP ont reçu un canal alpha transparent : 42 illustrations
HITL, 27 planches d’inventaire, 31 notifications et 13 planches de stock. Les six
copies correspondantes des profils publics mobiles ont été synchronisées.

Les dimensions, les positions des objets dans les sprites et les URL sont conservées.
Les fonds des composants de vignette supervision,
notifications, stock et tarification sont également transparents. Les photographies
de logements, les portraits et les illustrations déjà transparentes sont préservés.

Traitement Python autorisé par l’utilisateur, rembg `isnet-general-use`, export WebP
compressé avec alpha sans perte. Contrôle visuel sur fond clair/sombre et restauration des surfaces ivoire
ainsi que de la petite maison de `booking-unmapped`. La transparence modifie uniquement
le masque alpha ; elle ne redessine pas les objets. L’export final compresse les
couleurs, comme les fichiers initiaux, pour conserver des vignettes légères.

## Reproduire pour de nouveaux fonds opaques

Installer `rembg[cpu]` dans un environnement Python dédié, puis exécuter depuis
la racine du dépôt :

```sh
rtk proxy python scripts/dev/baitly-transparent-artwork.py
# Vérifier les planches review-*.jpg dans /private/tmp/baitly-cutouts.
rtk proxy python scripts/dev/baitly-transparent-artwork.py --apply
```

Le script sauvegarde les originaux avant traitement et vérifie leur empreinte avant
remplacement. Les fichiers déjà transparents ne sont pas retraités. Les corrections
de masque propres aux visuels sont liées à leur composition actuelle et doivent être
revérifiées si une illustration est régénérée. Le modèle travaille localement : les
images ne sont pas transmises à une API externe.
