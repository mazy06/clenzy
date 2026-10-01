# Script 07 · « Baitly en 75 secondes » (tour du produit)

> **À quoi sert ce fichier.** Script de production complet de la vidéo d'explication de référence
> (16:9), réutilisable sur YouTube, LinkedIn et la landing, puis découpable en Shorts.
> **Comment l'utiliser.** Suivre les chapitres ; chaque chapitre est autonome pour faciliter la
> découpe. Couleurs, polices et courbes : [brand book](../brand-book/brand-book.md).
> **À qui il s'adresse.** Motion designer, monteur, comédien voix off, responsable marketing.

> **Version produite (v1, 27 septembre 2026)** : `marketing/motion/reel-07-tour-produit/`, FR · EN · AR,
> 16:9, 75 s, mode Jour (pas de fond Bleu nuit ; l'eyebrow de chapitre passe en Encre terre). Écarts
> assumés : les briques portent la **photo du voyageur** (décision du 27 septembre, qui remplace la règle
> « initiales »), le chapitre 04 cite « activités » au lieu de « transferts » (offres de la landing :
> départ tardif, chef, montgolfière), le chapitre 06 dit « les factures suivent » plutôt que
> « conformes », et le CTA final reprend le titre de la landing. Brief voix : `reel-07-tour-produit/VOIX-OFF.md`.

## Métadonnées

| | |
|---|---|
| **Titre** | Baitly en 75 secondes |
| **Durée cible** | 75 s |
| **Formats** | 16:9 (1920×1080) master · découpes 9:16 par chapitre |
| **Réseaux** | YouTube, LinkedIn, landing (section « Voir Baitly en action ») |
| **Objectif** | Consideration → conversion : vue d'ensemble du produit |
| **Cible** | Conciergeries, hôtes multi-logements, riads |

## Système de chapitres

Chaque chapitre s'ouvre par un **titre de chapitre** en haut à gauche : numéro `01 / PILOTER`
(format de la landing, eyebrow Manrope 700 capitales, interlettrage 0,1 em, Sable `#E0C89B` sur fond Bleu nuit)
+ titre Space Grotesk 700. La **transition entre chapitres** est toujours la même : le tracé de la
maison du logo traverse l'écran (packet bleu `#2563EB`), balaie l'ancien chapitre et révèle le
suivant (700 ms, `cubic-bezier(0.22, 1, 0.36, 1)`).

## Beats

| Timecode | Voix off (texte exact) | Directions d'animation / visuel | À l'écran |
|---|---|---|---|
| **0–5 s** | « Réservations, prix, ménage, voyageurs, propriétaires. Et si tout tenait dans un seul espace ? » | Cinq mots apparaissent en colonne, chacun avec une icône Lucide (trait 1,7 px) ; ils convergent vers le centre et forment le logo. | Les cinq mots. |
| **5–15 s** | « Le planning d'abord. Tous vos logements, tous vos canaux, synchronisés en continu : une réservation ici ferme les dates partout ailleurs. » | **01 / PILOTER**. Planning multi-biens plein cadre (6 logements), briques Terre cuite par statut. Une brique « Confirmée » `#9A6C3A` avec pastille Airbnb se pose, les autres canaux passent à « Fermé ». | 01 / PILOTER · « Tous vos calendriers, une seule vérité. » |
| **15–24 s** | « Votre site de réservation directe, ensuite : un template à votre image, le paiement intégré, et zéro commission sur ces réservations. » | **02 / DÉVELOPPER**. Un site se construit en blocs (hero, liste de logements, calendrier 2 mois avec prix par nuit). Compteur « Commission : 0 % ». | 02 / DÉVELOPPER |
| **24–34 s** | « Dix agents IA surveillent vos prix, vos messages et vos opérations. Ils proposent, vous validez. Les prix bougent, jamais sous votre plancher. » | **03 / AUTOMATISER**. Carte de validation Revenue + bouton Approuver ; courbe de prix au-dessus d'une ligne plancher. | 03 / AUTOMATISER |
| **34–43 s** | « Le livret d'accueil accompagne vos voyageurs par un simple lien, et vend vos extras : départ tardif, chef à domicile, transferts. » | **04 / ACCUEILLIR**. Téléphone avec livret, trois cartes d'extras qui glissent (photos `bookingLate`, `bookingChef`, transfert en pictogramme). | 04 / ACCUEILLIR |
| **43–52 s** | « Chaque départ crée sa mission de ménage. La preuve photo débloque le paiement du prestataire. » | **05 / OPÉRER**. Dans le planning, une pastille balai (blanche, 21 px, icône `#2F9E8D`) apparaît dans la brique du séjour qui se termine (fondu + léger pop 150 ms). Puis chaîne : Départ → Mission → Checklist → Photo (`operationsProof.webp`) → Paiement débloqué. Coches Sable `#E0C89B` successives. | 05 / OPÉRER |
| **52–61 s** | « Les paiements passent par les solutions de votre pays, les factures sont conformes, et vos propriétaires reçoivent leurs relevés sans ressaisie. » | **06 / ENCAISSER**. Logos de paiement (PayTabs, CMI / PayZone, YouCan Pay, Stripe) en petit, facture qui se compose, relevé propriétaire avec « Net à verser ». | 06 / ENCAISSER |
| **61–68 s** | « En arabe, en français ou en anglais. Pour l'Arabie saoudite, le Maroc et la France. » | Le planning bascule en RTL (Tajawal), puis en FR, puis en EN : trois états en 2 s chacun. Trois repères de pays sur une ligne. | « AR · FR · EN » |
| **68–75 s** | « Baitly. Faites grandir vos revenus, pas votre charge de travail. Rejoignez le pré-lancement sur baitly.fr. » | Fond Bleu nuit, titre deux tons (Papier / Sable), logo animé, bouton CTA Sable texte Encre brune. | « Faites grandir vos revenus. Pas votre charge de travail. » · **baitly.fr** |

**Voix off : environ 168 mots** (75 s à 2,2 mots/s, rythme clair pour une vidéo d’explication).

## Notes de production

- **Palette** : bleu nuit + Terre cuite uniquement (brand book, « Palette de création »). Les couleurs d'interface (bleu-gris, teal, couleurs d'agents, de canaux) n'apparaissent qu'à l'intérieur des maquettes UI. Le planning est montré avec ses briques Terre cuite.
- **Voix** : professionnelle et accessible, énergie modérée, sourire dans la voix. Une seule voix pour toute la vidéo (elle devient la « voix Baitly » de référence).
- **Rythme** : dynamique mais lisible ; chaque chapitre a la même construction (titre → action → résultat).
- **Musique** : corporate upbeat léger, 105 BPM, montée progressive jusqu'au chapitre 06, puis résolution au CTA.
- **Découpe en Shorts** : chapitres 01, 03, 04 et 05 deviennent chacun un Short de 15–20 s (ajouter un hook texte en 0–2 s et le CTA final).
- **UI** : utiliser des maquettes fidèles au PMS (planning, cartes d'agents, livret) mais **sans données personnelles réelles** : logements et voyageurs fictifs, initiales à la place des portraits (règle de la landing).
- **CTA final exact** : « Rejoignez le pré-lancement » · **baitly.fr** (après ouverture : « Réservez votre démo de 30 min » · **baitly.fr/demo**).
