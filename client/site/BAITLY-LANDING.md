# Baitly : direction de la landing

## Intention

Un hôte consulte le site en journée, souvent entre deux arrivées, pour comprendre si Baitly peut prendre en charge les coulisses de son activité. Registre **brand**. Voix : accueillante, concrète, assurée. La lumière et les lieux portent l'hospitalité ; les scènes de produit expliquent le service.

## Système visuel

- Couleurs OKLCH et rôles nommés `--bl-*` dans `home.css`, sous `.baitly-marketing`. Les tokens `--bui-*` du PMS ne changent pas.
- Encre bleu nuit, accent bleu-gris, surfaces claires teintées. Photos chaleureuses en contraste avec la palette de travail.
- Manrope, hébergée localement ; licence OFL dans `assets/fonts/OFL.txt`. Source : https://fonts.google.com/specimen/Manrope.
- Échelle fluide : display 48–80 px, titres 32–50 px, sous-titres 25–36 px. Métadonnées et commandes à 12 px minimum.
- Espacement des sections 64–112 px, contrôles de 44 px minimum pour les nouvelles interactions, rayon de contrôle 8 px et panneaux 16 px. Arches photographiques réservées aux images de lieux.
- Icônes Lucide avec trait 1,7 px. États décrits par un libellé, pas uniquement par la couleur.

## Composition et mouvement

Hero photographique et promesse → intégrations sélectionnées → planning et réservation directe → démonstration de quatre agents → ancrage local → FAQ → prise de démo.

Les composants de section de `HomePage.tsx` conservent les routes du catalogue. La démonstration `BaitlyAgentDemo.tsx` est locale : ses données sont illustratives et ses boutons ne déclenchent aucune requête métier. La lecture est volontaire, se suspend hors écran et se désactive avec `prefers-reduced-motion`. Chaque scénario peut être choisi manuellement. La FAQ utilise les éléments natifs `details` / `summary`.

Le header et le footer partagent la même identité. Le menu mobile expose son état, se ferme avec Échap, et rend le focus au déclencheur. Un lien d'évitement rejoint le contenu principal.

## Assets et chargement

- `assets/photos/baitly-riad.webp` : image ImageGen intégrée, 1400 px, environ 240 ko.
- `assets/photos/baitly-riad-small.webp` : variante responsive 700 px, environ 65 ko.
- `assets/photos/riad.jpg` et `pool.jpg` : photos déjà présentes, réutilisées.
- Le hero utilise `srcset`, `sizes` et `fetchPriority=high`. Images secondaires en chargement différé, dimensions réservées.
- Les pages produit et prestataires, qui embarquent les projections lourdes, se chargent à l'ouverture de leur route via React.lazy. Un squelette maintient la structure pendant le chargement.

## Vérifications du 19 septembre 2026

- TypeScript du site : valide.
- Build Vite : valide. Le JavaScript initial passe de 1 301 ko à 525 ko (environ 176 ko gzip) en différant les projections. Les avertissements existants sur les imports API et la taille de chunk restent présents.
- Trois tests Vitest : sélection et approbation indépendantes, pause conservant la décision, exploration manuelle avec réduction des animations.
- Navigateur local : 375, 768, 1024 et 1440 px, aucun débordement horizontal de la page.
- Navigation produit et démo vérifiée. FAQ ouverte, lecture animée puis pause vérifiées. Échap ferme le menu mobile et restitue le focus ; le lien d'évitement donne le focus au contenu.
- Couples de couleur des textes sur fonds unis : contraste minimal mesuré 5,44:1. Les textes du CTA photographique sont placés sur la zone sombre de l'overlay.

## Limites héritées

La route `/demo` reste le parcours existant. Son formulaire appelle actuellement `preventDefault()` sans envoi backend ; cette refonte ne crée pas de service de collecte. Son lien WhatsApp contient également un numéro de démonstration. Ces branchements sont nécessaires avant de lancer une campagne de conversion.

Les anciens chiffres de performance et le témoignage non sourcé ont été retirés de l'accueil. Aucun résultat client ni statut de subvention n'est inventé. Le parcours Go Siyaha reste une invitation à en discuter en démo.

## Création du visuel

Outil : ImageGen intégré. Le master original reste dans le dossier des images générées de Codex ; les variantes WebP sont stockées dans le projet. Prompt exact :

Use case: photorealistic-natural. Asset type: premium Baitly hospitality software landing page hero, landscape 3:2 photo. Create an exceptionally beautiful realistic architectural photograph of an intimate Moroccan riad courtyard, seen from the shaded arcade. Large elegant horseshoe arches framing a central rectangular pale turquoise plunge pool, warm ivory tadelakt walls, hand-cut pale stone, walnut doors, rich olive green foliage and a tall palm, a terracotta ceramic pot, sunlight falling diagonally with dramatic palm leaf shadows, subtle zellige craftsmanship. Understated contemporary boutique hospitality, welcoming and tactile, true architectural photography with slightly visible film grain, natural lens perspective, no excessive ornament. Composition: strong arches across upper half, pool and inviting seating in lower half, restrained daylight with warm sun and cool blue-gray shadows. No people, no words, no text, no logos, no overlays, no UI, no collage. Aim for tangible lived-in elegance, editorial travel photograph quality, not a 3D render.
