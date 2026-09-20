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

Le header et le footer partagent la même identité ; le choix de langue vit dans la colonne
d'identité du footer, où il est visible à toute largeur — dans le header il était masqué
sous 640 px. Les volets du méga-menu reprennent la pièce du PMS (`.bui-sidebar-flyout`) tournée d'un quart de tour : ils sortent de la ligne du bas de l'en-tête, sans bordure de ce côté-là, avec deux raccords concaves aux angles hauts et un effet tiroir. La barre de navigation est étirée sur la hauteur de l'en-tête pour que la couture existe. Leur contenu est un rail et une vitrine (`NavMegaPanel`) : le rail ne porte qu'une icône et un titre par entrée, la vitrine ne montre que l'entrée survolée — photo d'ambiance, phrase et trois fonctionnalités réelles. Un curseur glisse d'une rangée à l'autre, la photo entre en fondu depuis un léger sur-cadrage et le texte la suit ; la vitrine est redondante avec le rail, donc masquée aux lecteurs d'écran et sans prise sur le pointeur. Le menu mobile expose son état, se ferme avec Échap, et rend le focus au déclencheur. Un lien d'évitement rejoint le contenu principal.

Les familles de la place de marché et les rangées de `/solutions` suivent la même règle :
**la photo remplace la pastille d'icône**, et la grille perd son uniformité — deux familles
sur six s'étendent sur deux colonnes en composition horizontale, les rangées de solutions
alternent le côté de leur image, à fond perdu jusqu'au bord de la carte.

## Assets et chargement

- Toutes les photos montrent un **logement** : `terrace.jpg` (terrasse de villa, hero),
  `bedroom.jpg` (chambre prête à accueillir), `guesthouse.jpg` (entrée d'une maison
  d'hôtes traditionnelle), `pool.jpg` (istiraha avec piscine). `baitly-riad.webp` et sa
  variante `-small` en dérivent pour la vignette de la démonstration d'agent.
- Deux exceptions assumées, qui illustrent des **activités** vendues dans le livret
  d'accueil et non l'hébergement : `excursion.jpg` (désert) et `balloon.jpg`
  (montgolfière), plus `food.jpg` (plat servi).
- `assets/services/` porte six photos d'un autre registre : elles montrent le **geste du
  métier** (ménage, bricolage, linge, jardin, remise de clés, cuisine) et non un décor.
  Elles habillent les familles de la place de marché, à la place des pictogrammes.
  Recadrées à 1000x560 à la prise.
- Source : Unsplash et Pexels, licences libres pour usage commercial, sans attribution
  requise. `host.jpg` est l'avatar générique d'origine.
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
