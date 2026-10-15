# Film de lancement 9:16 « Baitly est lancé » · Brief voix off (FR)

> **À quoi sert ce fichier.** Texte, intonation et prononciation de la voix off du film de lancement
> vertical (Reels, TikTok, Shorts), et notes d'adaptation aux formats 1:1 et 16:9.
> **Comment l'utiliser.** Une prise complète dans `vo/fr/_prise-complete-paulk.mp3` (textes balisés
> dans `../elevenlabs/scripts-v3.json`), puis `python3 align-vo.py reel-19-baitly-est-lance fr` : les
> plans suivent la voix et les sous-titres sont réécrits. Rendu : `node render.mjs reel-19-baitly-est-lance --lang=fr`.
> **À qui il s'adresse.** Marketing, motion designer, toi (ElevenLabs).

## 1. Règles

| Point | Consigne |
|---|---|
| **Voix** | **Paul K · French Ad & Trailer** (`ecxPjiGTvAfpGEams6ec`), **Eleven v4**, Stabilité 0,3, direction keynote (voix du film de lancement). Prise 2 du 09/10/2026 (agents détaillés) + réplique Académie (b20) générée seule et insérée : 146,8 s brut, film de ~144 s. Frontières forcées dans `FORCE_BOUNDS`. Prises précédentes : `vo/archive-v1/`, `vo/archive-v2/`. |
| **Prononciation** | « Bètli » pour Baitly, « bètli point F R » pour baitly.fr, « Tchèkine » pour Chekin, « rève-par » pour RevPAR (sous-titres : Chekin, RevPAR). |
| **Sous-titres** | Mot pour mot la voix, avec l'écriture d'affichage (Baitly, 10 agents IA, Chekin). Rien après la promesse : l'écran porte le texte. |
| **Vérité produit** | Données fictives (« Scène illustrative »). Certaines fonctionnalités présentées sont **en cours de déploiement** (prestataire lié à une prestation, réassort par le prestataire, activités GetYourGuide / Klook / Viator, envoi automatique à Pennylane, déclarations Maroc et Arabie saoudite) : décision du 09/10/2026 de les annoncer, avec la mention « Certaines fonctionnalités en cours de déploiement » sur l'écran de fin. |

## 1 bis. Anglais et arabe (09/10/2026)

| Langue | Voix | Prise | Remarques |
|---|---|---|---|
| EN | Paul K (`ecxPjiGTvAfpGEams6ec`), Eleven v4, Stabilité 0,3 | `vo/en/_prise-complete-paulk.mp3`, 146,1 s | « Betly », « betly dot F R ». Frontières forcées (`FORCE_BOUNDS`, b18-b21 mal détectées). |
| AR | **Ali · Saudi Arabic** (`Hvlnv5DwiIO2CQ6oYMZ3`, voix masculine, retenue le 10/10), Eleven v4, Stabilité 0,3 | `vo/ar/_prise-complete-ali.mp3`, 152,7 s ; prise Hamida archivée dans `vo/archive-ar-hamida/` | Arabe standard, marque « بيتلي », adresse « بيتلي دوت إف آر » (sous-titre : baitly.fr). **Traduction à faire relire par un natif** avant publication. |

Textes : `../elevenlabs/scripts-v3.json` (mêmes balises que le français), textes à l'écran : `i18n.js` (`en`, `ar`).
Formulations reprises de la landing quand elles existent (promesse, noms des agents, marketplace, Académie).
Les vidéos de l'Académie n'existent qu'en français : la puce l'indique (« Videos in French », « الفيديو باللغة الفرنسية »).
`align-vo.py` gère désormais l'arabe : mots repères `W(fr, en, ar)` et découpe des sous-titres sur « ، ؛ ؟ ».

## 2. Texte (une réplique = un plan)

| # | Texte | Plan |
|---|---|---|
| b1 | Un logement ou cinquante : réservations, messages, ménage, comptabilité… | Quatre notifications qui s'empilent |
| b2 | Voici Bètli. Tout votre métier, sur une seule plateforme. | Tracé du logo validé (symbole + « baitly. », flux monochrome) |
| b3 | Pour les propriétaires qui gèrent eux-mêmes… comme pour les conciergeries. | Deux arches : hôte devant le planning (image générée), équipe de ménage |
| b4 | Un seul planning pour tous vos canaux, et votre propre site de réservation, sans commission Bètli. | Planning 3 logements, réservation Booking qui se pose, carte de réservation directe |
| b5 | Et surtout, Bètli, c'est dix agents I.A., chacun expert de son métier. | Les 10 avatars des agents (images du produit), les 5 détaillés ensuite cerclés |
| b6 | L'agent Avis et Réputation répond à chaque avis, surtout aux plus durs : vos voyageurs voient que vous agissez pour améliorer leur séjour. | Avis 2 étoiles, réponse préparée qui s'écrit, « Geste pour le séjour proposé » |
| b7 | L'agent Conformité suit l'évolution des taxes de séjour et des règles locales, pour rester en règle avec les autorités, sans y penser. | Nouveau barème de taxe de séjour, réservations recalculées, tampon « En règle », 3 pays |
| b8 | L'agent Revenue suit les prix de la nuitée en direct, repère les creux et les pics à venir, et ajuste vos tarifs pour viser le meilleur rève-par et la meilleure occupation. | Semaine de prix au-dessus du plancher, creux et pic ajustés, RevPAR et occupation |
| b9 | L'agent Opérations vous rappelle les réassorts et les missions à confirmer. | Rappels « Réassort à prévoir » et « 3 missions à confirmer » |
| b10 | L'agent Finance organise vos versements, vos commissions, vos cautions… et même vos litiges bancaires. | Versement propriétaire, commissions, caution, litige bancaire |
| b11 | Ils proposent, vous validez, avec l'autonomie que vous leur donnez. Moins d'oublis, moins de frustration, plus de temps. | Carte HITL validée, sélecteur d'autonomie Suggère / Notifie / Auto |
| b12 | Et l'agent Communication répond à vos voyageurs, vite et dans leur langue, selon le contexte de chaque séjour. | Téléphone : message en anglais, réponse de l'agent Communication |
| b13 | Le livret d'accueil tient dans un simple lien : infos du séjour, extras, activités. | Téléphone : livret, sections surlignées au fil des mots |
| b14 | Vendez-y vos propres prestations, avec ou sans prestataire, et les activités GetYourGuide, Klook ou Viator, jusque sur votre site de réservation. | Illustrations du catalogue : prestations internes, activités partenaires |
| b15 | Vos objets connectés accueillent pour vous : un code limité au séjour, des alertes de bruit, sans écouter personne. | Code de serrure tapé, jauge de bruit, « Aucun enregistrement des conversations » |
| b16 | Chaque départ crée sa mission de ménage, prouvée en photo. Le stock se met à jour, vos commandes partent chez vos fournisseurs… et vos prestataires s'occupent même du réassort. | Mission + preuve photo, stock qui baisse, commande, réassort |
| b17 | Propriétaires et prestataires suivent l'avancement depuis leur propre espace. | Espace propriétaire, espace prestataire |
| b18 | Facturation électronique, comptabilité transmise automatiquement à Pennylane, et déclarations de voyageurs envoyées à Tchèkine, ou aux autorités marocaines et saoudiennes, selon le pays du logement. | Trois lignes (Factur-X, Pennylane, déclaration) + pays |
| b19 | Et Bètli est ouvert à tous ceux qui ont un service à proposer : ménage, maintenance, linge, transferts, chefs ou activités. Les inscriptions à la marketplace sont ouvertes. | Grille de 6 métiers (illustrations), « Rejoindre la marketplace · baitly.fr/prestataires » |
| b20 | Vous débutez, ou vous voulez aller plus loin ? L'Académie Bètli vous forme au métier en courtes vidéos : piloter, revenus, opérations, réglementation… en accès libre. | Académie Baitly : 4 épisodes réels (vignettes tirées des vidéos), 6 thèmes du programme, « Accès libre, sans inscription · baitly.fr/ressources/academie » |
| b21 | Faites grandir vos revenus. Pas votre charge de travail. | bascule bleu nuit, promesse du brand book |
| b22 | Bètli est lancé. Réservez votre démo sur bètli point F R. | Logo blanc, « Baitly est lancé · baitly.fr », bouton Sable « Réservez votre démo · baitly.fr/demo », mention en petit |

## 3. Déclinaisons 1:1 et 16:9 (à produire depuis ce dossier)

Chaque plan est autonome (titre + un ou deux composants), ce qui permet de recomposer sans couper.

- **1:1 (1080 × 1080)** : supprimer le sur-titre, titre sur une ligne à 60 px en haut (marge 64 px),
  composant centré réduit à 85 %, sous-titres à 64 px du bas. Téléphones : 0,62 au lieu de 0,82.
  Grilles des agents (5 × 2) et des métiers (3 × 2) en 3 × 2 à 240 px. Fin : logo, « Baitly est lancé », bouton, mention.
- **16:9 (1920 × 1080)** : titre à gauche (colonne de 760 px), composant à droite ; l'avatar de l'agent à gauche
  sous le titre et sa carte à droite ; les cartes empilées des plans 3, 15, 16, 17 côte à côte ; sous-titres en bas, centrés, 36 px, une ligne (100 caractères,
  cf. `SUB_MAX_REEL` du Reel 07). Fin : logo centré, CTA dessous.
- Dans tous les formats : logo jamais à moins de 0,5 × sa hauteur du bord, URL toujours écrite.
