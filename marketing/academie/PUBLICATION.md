# Baitly Académie · publier les vidéos sur la landing

> **À quoi sert ce fichier.** Le chemin d'un épisode, du rendu vidéo à la page
> `baitly.fr/ressources/academie/<épisode>`, et la mise en service du stockage des vidéos.
> **Comment l'utiliser.** Suivre le § 2 pour chaque nouvel épisode ; le § 3 une seule fois par
> environnement.
> **À qui il s'adresse.** Marketing, développeur du site, responsable de l'infrastructure.

## 1. Comment la landing lit les vidéos

- Le site appelle toujours ses vidéos sur **son propre domaine** : `/academie/media/<langue>/<épisode>-<format>-<qualité>.mp4`.
  La CSP de baitly.fr (`media-src 'self' blob:`) n'a donc pas à être assouplie.
- **En local** (`npm run dev:site`), Vite sert la copie de `client/site/public/academie/media/`,
  ignorée par git et remplie par `academie-web.mjs`.
- **En production**, le conteneur du site relaie ce chemin vers le stockage objet OVH quand la
  variable `BAITLY_ACADEMY_MEDIA_ORIGIN` est définie (règle nginx écrite au démarrage par
  `client/docker-runtime-config.sh`) ; Cloudflare met les fichiers en cache. Sans la variable, la
  page reste utilisable : elle affiche un message à la place de la vidéo.
- Le lecteur choisit le **format** selon l'écran (9:16 sous 768 px ou écran vertical, sinon 16:9)
  et la **qualité** selon la connexion (720p si le visiteur économise ses données ou si le réseau
  est lent, 1080p sinon). Les images d'aperçu sont servies par le site
  (`client/site/public/academie/posters/`, versionnées).

## 2. Publier un nouvel épisode

1. Rendre l'épisode dans les deux formats (voir `marketing/motion/<épisode>/VOIX-OFF.md`).
2. L'ajouter à la liste `EPISODES` de `marketing/motion/academie-web.mjs` : dossier, `slug`
   (`NN-mot-cle`), numéro du programme, thème, instant de l'image d'aperçu, date de mise en ligne.
3. Écrire ses textes dans `client/site/lib/messages/baitlyAcademy.ts`, **en trois langues** : titre,
   description, ce qu'on apprend, un libellé par chapitre. Les tests refusent un chapitre sans nom.
4. Lancer `node marketing/motion/academie-web.mjs` : vidéos web (quatre fichiers par épisode et par
   langue), images d'aperçu et catalogue `client/site/data/baitlyAcademyVideos.ts` (généré).
5. Téléverser `marketing/motion/out/academie-web/` dans le stockage objet (§ 3).
6. Vérifier : `npx vitest run site` puis `npm run build:site` depuis `client/` ; le build génère la
   page de l'épisode, son Markdown, son entrée dans le sitemap et ses données `VideoObject`.
7. Commit, PR `main → production` : la page part avec le déploiement habituel.

## 3. Mettre en service le stockage (une fois par environnement)

1. Créer un conteneur OVH Object Storage (API S3) **dédié et public** : `baitly-academie`, région GRA,
   classe Standard. **Jamais `baitly-media`** : ce conteneur-là est privé et reçoit les photos et
   documents des clients (`clenzy-infra/Guide-Activation-OVH-Object-Storage.pdf`).
   Lui lier un utilisateur Object Storage et noter sa clé d'accès et sa clé secrète.
2. Sur le poste : `brew install awscli`, puis `aws configure --profile ovh-academie` (clé d'accès,
   clé secrète, région `gra` ; les clés restent dans `~/.aws`, jamais dans le dépôt). Le script du
   point 3 fournit lui-même l'adresse OVH, la région et le réglage des sommes de contrôle
   (AWS CLI 2.23+ en ajoute sinon que les stockages S3 tiers peuvent refuser).
3. Téléverser et vérifier : `marketing/motion/academie-upload.sh` (objets en lecture publique,
   `video/mp4`, cache 30 jours ; contrôle final d'une URL publique).
4. Dans `clenzy-infra`, le service `baitly-site` de `docker-compose.prod.yml` porte
   `BAITLY_ACADEMY_MEDIA_ORIGIN: ${BAITLY_ACADEMY_MEDIA_ORIGIN:-https://baitly-academie.s3.gra.io.cloud.ovh.net/academie}` :
   l'adresse est publique, elle n'a rien à faire dans le secret `.env`. PR sur la branche `production`
   de `clenzy-infra`, qui déclenche le déploiement (facultatif : `BAITLY_ACADEMY_RESOLVER`,
   127.0.0.11 par défaut, le DNS interne de Docker).
5. Contrôler après déploiement : `curl -I https://baitly.fr/academie/media/fr/01-kpi-16x9-720.mp4`
   doit répondre `200` avec `Content-Type: video/mp4` et `Accept-Ranges: bytes`.

## 4. Points d'attention

- Une image Docker construite **depuis un poste** embarquerait la copie locale des vidéos
  (`public/academie/media`, environ 120 Mo) : construire depuis la CI, qui part du dépôt.
- `render.mjs` écrit désormais les MP4 avec `+faststart` : la lecture démarre avant la fin du
  téléchargement. Les vidéos rendues avant ce changement sont réencodées par `academie-web.mjs`.
- Les épisodes juridiques (05 à 10) portent la mention « Relu par un juriste » dans le programme :
  ne les publier qu'après cette relecture (voir `PROGRAMME.md` § 4).
