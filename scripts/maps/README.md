# Carte Baitly

La carte du PMS est entièrement maîtrisée par Baitly : moteur open source, données
OpenStreetMap hébergées chez nous, style dessiné pour le produit. Aucun jeton, aucune
facturation à l'usage.

| Brique | Choix | Licence |
|---|---|---|
| Moteur de rendu | MapLibre GL JS (fork libre de Mapbox GL) | BSD-3 |
| Données | OpenStreetMap, schéma Protomaps v4, archive PMTiles | ODbL (attribution affichée) |
| Lecture de l'archive | `pmtiles` (requêtes Range) | BSD-3 |
| Calques de base | `@protomaps/basemaps`, palettes Baitly « Papier » / « Nuit » | BSD-3 |
| Arabe | `@mapbox/mapbox-gl-rtl-text`, chargé au premier libellé RTL | BSD-2 |

Code front : `client/src/components/map/` (style dans `baitlyMapStyle.ts`, épingles dans
`baitlyMapPin.ts`, habillage dans `baitly-map.css`).

Rendu : palette « Papier » (claire, papier chaud) et « Nuit », routes blanches en clair,
bâtiments extrudés en 3D à partir du zoom 14 (hauteur OSM, 12 m par défaut), caméra
inclinée avec bouton 2D/3D sur les cartes de consultation. Les commerces (restaurants,
cafés, boutiques) sont masqués pour ne pas noyer les épingles des logements.

## Rendu

- **Lumière selon l'heure** : aube, jour, crépuscule, nuit, d'après l'heure solaire du lieu
  affiché (UTC + longitude). Seuls la lumière et le ciel changent, sans recharger le style.
  En dev, `?period=dawn|day|dusk|night` fige le moment.
- **Relief** : altitude Mapterhorn (`terrain.pmtiles`, Terrarium, zooms 0-12) — ombrage du
  relief sous l'eau et les routes, terrain 3D sur les cartes inclinées. Sources : IGN
  (Licence Ouverte 2.0) et Copernicus GLO-30 ; attribution « © Mapterhorn » affichée.
- **Rivage** : liseré soutenu sur les côtes, berges et lacs.
- **Pictogrammes Baitly** : sprite généré (`client/scripts/build-map-sprite.mjs`, tracés
  Lucide en pastilles teintées par famille de lieu), mêmes noms que Protomaps.
- **Police Baitly Sans** : Plus Jakarta Sans (latin) + Tajawal (arabe) + Noto Sans (autres
  écritures), glyphes générés par `fonts/build-baitly-fonts.sh` (polices SIL OFL 1.1).
- **Épingles** : regroupement en bulles au-delà de 12 lieux (supercluster), anneau d'état
  (rotation, arrivée, départ, occupé, alerte, retard…) et légende. L'état du jour des
  logements vient de `GET /api/properties/map-states`, calculé dans le fuseau du logement.
- Changer de thème (Papier / Nuit) remplace le style sur la carte existante : la caméra
  ne bouge pas.

## Couverture

France métropolitaine + Corse, Maroc, Arabie saoudite (`baitly-region.geojson`), zooms
0 à 15. Hors de ces zones, la carte affiche le fond uni. Pour ajouter un pays (DOM-TOM,
Émirats…), ajouter un polygone à `baitly-region.geojson` et reconstruire.

## Chaîne de production

```bash
bash scripts/maps/build-baitly-tiles.sh
```

```bash
bash scripts/maps/upload-baitly-tiles.sh
```

1. `build` extrait la zone du dernier build quotidien Protomaps et l'altitude Mapterhorn
   (lecture par plages, rien n'est téléchargé en entier), rapatrie les glyphes Noto, génère
   la police Baitly Sans (Docker), le sprite Baitly, les styles web et le plugin RTL.
2. `upload` envoie le tout dans le conteneur OVH **public** `baitly-cartes`
   (profil AWS CLI `ovh-cartes`, lecture publique), puis vérifie une lecture par plage.
3. En production, le conteneur client relaie `/maps/` vers ce conteneur
   (`BAITLY_MAPS_ORIGIN`, cf. `client/docker-runtime-config.sh`) : le front lit la carte en
   même origine, sans CSP à élargir.

Reconstruire tous les mois ou deux suffit : l'archive porte un `Cache-Control` d'un jour,
les navigateurs revalident par ETag.

## Développement local

```bash
bash scripts/maps/build-baitly-tiles.sh --bbox 2.2,48.8,2.45,48.92 --out client/public/maps --skip-assets
```

Vite sert `client/public/maps/baitly.pmtiles` (ignoré par Git) et relaie `/maps/assets`
vers le dépôt public des glyphes. Changer la `--bbox` pour travailler sur une autre ville.

## Moteur de rendu d'images (e-mails, application mobile)

Les cartes des e-mails de check-in et les tuiles de l'application mobile sont dessinées par
le conteneur `baitly-maps-renderer` (tileserver-gl, `clenzy-infra`), avec le **même style**
que la carte web : `client/scripts/build-map-render-styles.mjs` le génère depuis
`baitlyMapStyle.ts`.

```bash
bash scripts/maps/build-render-bundle.sh
```

L'archive `render-bundle.tar.gz` (styles, sprites, épingles `render/icons/`, glyphes) est
téléversée avec les tuiles ; le service `baitly-maps-renderer-init` la récupère à chaque
déploiement. Le moteur lit l'archive PMTiles directement dans le stockage objet.

- **E-mails** : `BaitlyStaticMapService` insère une image servie par
  `/api/public/maps/static/{jeton}.{signature}.jpg`. Le jeton est signé (HMAC,
  `BAITLY_MAPS_SIGNING_SECRET`, 32 caractères minimum) : personne ne peut faire dessiner une
  carte arbitraire. Cache CDN d'un an (l'image d'un jeton ne change jamais).
- **Mobile** : tuiles raster `/api/public/maps/raster/{langue}/{z}/{x}/{y}.png` (grille
  validée, cache CDN 7 jours).
- Moteur ou secret absent : les e-mails partent sans carte, rien d'autre ne casse.

## Sites générés (`clenzy-sites`)

Le bloc « carte » affiche la carte Baitly (MapLibre) au lieu d'une iframe Google Maps. Le
site relaie `/maps/` vers le stockage des cartes (rewrite Next, `BAITLY_MAPS_ORIGIN`) et
charge le style web publié ici (`assets/styles/baitly-{paper,night}-{fr,en,ar}.json`) : la
palette n'est définie qu'à un seul endroit. L'adresse du bloc est géocodée côté serveur
(Nominatim, cache 30 jours).

## Itinéraires

Les liens « Itinéraire » (PMS, livret, application mobile) proposent le choix de
l'application GPS — Plans, Google Maps, Waze — au lieu d'imposer Google Maps
(`client/src/utils/directions.ts`, `mobile/src/lib/directions.ts`).
