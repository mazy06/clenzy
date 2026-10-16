# Communes françaises Baitly

Source : [API Découpage administratif](https://geo.api.gouv.fr/decoupage-administratif/communes),
IGN Admin Express, Licence Ouverte 2.0. Extraction du 16 octobre 2026.

Les contours sont simplifiés ensemble par mapshaper 0.6.102 (Visvalingam 3 %, keep-shapes,
précision 0,00001 degré), puis répartis par département. Le serveur ne charge que les
départements demandés. Les listes du formulaire et la validation serveur proviennent
de la même extraction ; aucune requête vers le service externe n'est nécessaire à l'utilisation.

Régénération depuis la racine : `node scripts/maps/sectors/build-baitly-communes.mjs`.
Pour réutiliser une extraction simplifiée : passer son chemin GeoJSON en argument.
Vérifier ensemble les contours, `geo/baitly-communes.json` et `client/public/geo/baitly-communes/`.
