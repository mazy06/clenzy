# Film de lancement Baitly · « En pilote automatique »

> **À quoi sert ce fichier.** La bible de production du film de lancement : le hero de 60 s, ses
> trois cutdowns, la direction artistique, les prompts des plans tournés par IA, les écrans à
> maquetter et le casting de la voix (Eleven v4).
> **Comment l'utiliser.** Lire d'abord le § 1 (arbitrages à valider), puis travailler plan par plan
> depuis le § 4. Couleurs, polices et courbes viennent du [brand book](../brand-book/brand-book.md) ;
> les composants d'interface de l'[inventaire motion](../motion/INVENTAIRE-COMPOSANTS.md).
> **À qui il s'adresse.** Directeur artistique, motion designer, monteur, sound designer,
> opérateur des générateurs vidéo IA, responsable marketing.

Version 1 · 29 septembre 2026

| | |
|---|---|
| **Promesse** | « Votre location courte durée, en pilote automatique. » Le propriétaire garde le contrôle, Baitly orchestre le reste. |
| **Cible** | Gestionnaires de 3 à 50+ logements, conciergeries, propriétaires débordés. Francophones (France, Suisse). |
| **Ton** | Premium, calme, confiant. Jamais « startup criarde ». |
| **Hero** | 60 s · 16:9 · master 3840×2160 |
| **Cutdowns** | 30 s en 16:9 et 9:16 · 15 s en 9:16 (accroche dans les 2 premières secondes) |
| **Voix** | FR · Eleven v4 (`eleven_v4`) · casting au § 8 |
| **Signature** | Le flux bicolore du logo : il relie les écrans et se referme en logo |

---

## 1. Arbitrages à valider avant production

Le brief croise six règles du brand book. Ma proposition pour chacune, à confirmer ou corriger.

| # | Le brief demande | Le brand book dit | Proposition |
|---|---|---|---|
| A1 | Esthétique « Liquid Glass » | Glassmorphism **décoratif** interdit, pas de glow | **Verre fonctionnel** : le verre porte la profondeur (les fenêtres flottent sur une dalle dépolie), jamais la décoration. Un seul reflet lent par plan, aucun halo lumineux. Spéc au § 2.3. |
| A2 | Fond sombre pour le produit | Mode Nuit = défaut vidéo, mais les 15 Reels sont passés en **mode Jour** à votre demande (27 sept.) | **Scène Nuit, fenêtres claires** : le décor est bleu nuit, les écrans Baitly restent en mode clair, comme dans le produit. Le mode Jour vit dans les écrans ; la nuit donne la profondeur du hero. À confirmer. |
| A3 | « Flux lumineux » | Glow, particules, lens flare interdits ; seuls les deux packets du logo sortent de la palette | Le flux est **un trait net, pas une lueur** : deux packets `#60A5FA` / `#2DD4BF`, traînée qui s'estompe, flou de bougé, zéro halo. |
| A4 | CTA « Demandez une démo » | CTA actuel (pré-lancement) : « Rejoignez le pré-lancement » + baitly.fr | **Deux écrans de fin** : version A pré-lancement (à diffuser maintenant) ; version B « Réservez votre démo » + baitly.fr/demo (après ouverture). |
| A5 | Pilier « Marketplace » | Valeur Honnêteté : aucune promesse présentée comme livrée | La place de marché est en **phase 1 sur 8** (candidatures). Plan à garder, avec la mention « Scène illustrative » ; ou le décaler en version B du film. À trancher. |
| A6 | Pilier « Paiements intégrés et fiables » | Fait vérifiable : « preuve photo avant paiement » | Le pilier n'a ni plan ni réplique dans le brief. Je l'ajoute en **2 s dans la séquence marketplace** (P17 : mission validée → payé) et je propose une réplique optionnelle au § 8.4. |

Deux points de moindre portée :
- **« Pilote automatique » et contrôle.** Le brand book écarte « L'IA gère tout pour vous ». Le film
  tient la ligne parce qu'il montre une approbation humaine (P20 → P22) juste avant la promesse.
- **Suisse.** Prix affichés en euros, lieux en France avec un lac de montagne au plan terrasse
  (Annecy ou Léman). Vérifier si Baitly gère le CHF avant d'afficher des francs suisses.

---

## 2. Direction artistique appliquée

### 2.1 Palette du film (les « [À RENSEIGNER] » du brief)

| Rôle | Couleur | Code |
|---|---|---|
| Fond des séquences produit | Nuit profonde → Bleu nuit, dégradé radial très doux | `#0A1120` → `#1B2A35` |
| Dalle de verre (sous les fenêtres) | Ardoise nuit à 55 % + flou | `#2E4356` |
| Titres, ligne 1 | Papier | `#F7FBFC` |
| Titres, ligne 2 et mot clé | Sable | `#E0C89B` |
| Flux · requête (aller) | Bleu clair du logo (sur nuit) | `#60A5FA` |
| Flux · réponse (retour) | Teal clair du logo (sur nuit) | `#2DD4BF` |
| Flux sur image claire (lifestyle) | Packets du logo principal | `#2563EB` / `#0D9488` |
| Alerte (une seule fois par plan) | Terracotta | `#B45733` |
| Texte secondaire sur nuit | Brume nuit | `#D7E1EE` |
| Écrans produit | Couleurs d'interface du brand book (Papier, Carte, briques Terre cuite) | voir brand book § 2 |
| Étalonnage lifestyle | Ombres vers le bleu nuit, hautes lumières vers le sable | |

Jamais de noir `#000` ni de blanc `#FFF` purs : l'écran « noir » du hook est Nuit profonde.

### 2.2 Typographie

| Usage | Police | Taille (master 4K ; diviser par 2 en 1080p) |
|---|---|---|
| Titres cinétiques | Space Grotesk 700, interligne 1,05, −1 % | 160 à 200 px |
| Wordmark « baitly » | Space Grotesk 600, minuscules, −1,5 % | selon logo |
| Sous-titres | Manrope 600 | 80 px, 2 lignes max, 32 signes par ligne |
| Mentions (« Scène illustrative ») | Manrope 500 | 40 px, Brume nuit à 70 % |
| Chiffres | Space Grotesk 700, chiffres tabulaires | |

Titres cinétiques **mot à mot** : chaque mot glisse de 24 px vers le haut et apparaît en fondu,
60 ms entre deux mots ; la ligne 2 (Sable) démarre 150 ms après la ligne 1. Lecture minimale d'un
titre : 1,5 s + 0,3 s par mot.

### 2.3 Le verre fonctionnel (A1)

| Propriété | Valeur |
|---|---|
| Remplissage | `rgba(46, 67, 86, 0.55)` (Ardoise nuit) |
| Flou d'arrière-plan | 28 px, saturation ×1,2 |
| Filet | 1 px `rgba(215, 225, 238, 0.14)` + reflet haut 1 px `rgba(247, 251, 252, 0.18)` |
| Rayons | 24 px (dalle), 16 px (panneau), 14 px (carte) |
| Ombre | teintée, `0 30px 80px rgba(10, 17, 32, 0.55)` ; jamais d'ombre noire |
| Reflet | un balayage spéculaire par plan, 8 % d'opacité, 1,2 s, dans le sens du mouvement caméra |
| Profondeur | 3 couches maximum : décor / dalle de verre / fenêtre produit |

### 2.4 Mouvement

- Courbe signature : `cubic-bezier(0.22, 1, 0.36, 1)` ; sorties `cubic-bezier(0.64, 0, 0.78, 0)`.
- Aucun rebond, aucun élastique ; un « drop » ne dépasse pas 8 px.
- Caméra 3D lente sur les maquettes : dolly-in de 4 à 8 % par plan, tilt de 8° vers 3°, parallaxe
  entre les trois couches. Jamais de whip pan, de cube 3D ni de rotation au-delà de 12°.
- Trois éléments animés à la fois au maximum, sauf dans le hook (le chaos est le sujet).
- Transitions : raccords (match cuts), masques qui suivent le flux, morphing d'un élément d'interface
  vers le suivant. Aucun préréglage de transition.

---

## 3. Le flux : motif signature

**Origine.** Le logo est une maison tracée d'un seul trait ; deux packets y circulent : l'aller bleu
(requête) et le retour teal (réponse). Tracé source : [`baitly-mark.svg`](../brand-book/assets/baitly-mark.svg).

**Grammaire.** Le bleu part vers une action (une réservation arrive, une mission est demandée) ; le
teal revient avec la confirmation (ménage planifié, payé, répondu). Le spectateur apprend ce code en
15 secondes, puis le lit sans effort.

| Propriété | Valeur |
|---|---|
| Épaisseur | 6 px en 4K (3 px en 1080p) ; trait de guidage à 12 % d'opacité quand il reste affiché |
| Packet | longueur = 8 % du tracé, tête pleine, traînée qui s'estompe sur 40 % |
| Vitesse | constante (linéaire, comme le logo) : un tracé complet en 2,5 s ; la caméra, elle, suit la courbe signature |
| Rendu | flou de bougé à 180°, aucun halo |
| Son | requête = « tic » tonal montant ; réponse = « tic » descendant, une quinte en dessous |

**Cinq usages dans le film.**
1. **Aspiration** (P06) : le flux traverse le chaos figé et l'emporte par masques qui suivent le tracé.
2. **Tracé du logo** (P07) : les deux packets dessinent la maison et bouclent autour des deux nœuds.
3. **Liaison entre écrans** (P09 à P13) : les réservations voyagent sur le flux jusqu'au planning.
4. **Chaîne métier** (P12 à P17) : réservation → ménage → prestataire → paiement, un aller et un retour à chaque étape.
5. **Fermeture** (P23-P24) : tous les écrans se rétractent dans le flux, qui se referme en logo.

---

## 4. Découpage du hero (60 s, 16:9)

Timecodes au dixième de seconde. Les départs de voix sont des **cibles** : le calage final se fait
sur la prise retenue (outil `../motion/align-vo.py`). « VO » = voix off.

### Séquence 1 · Hook (0:00 → 0:03)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P01** | 0:00.0 → 0:00.6 · 0,6 s | Nuit profonde. Une notification de verre tombe au centre : « Nouvelle réservation · Plateforme A · Studio Canut · 3 nuits ». | Fixe |  | Premier « ding » sec, battement grave. VO démarre à 0:00.4 : « Cinq plateformes. » |
| **P02** | 0:00.6 → 0:03.0 · 2,4 s | Rafale : 13 notifications s'empilent en profondeur, décalées sur l'axe Z (plateformes A/B/C, voyageurs, équipe de ménage en retard). Intervalle 300 → 90 ms, de plus en plus serré. Liste exacte : § 6, E01. | Dolly-in lent de 3 % : la pression monte | « 5 plateformes. » (0:00.5) · « 3 équipes. » (0:01.8) | « Dings » superposés, hauteurs variées, jamais saturés. VO : « Trois équipes de ménage. » |

### Séquence 2 · Tension (0:03 → 0:08)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P03** | 0:03.0 → 0:05.0 · 2 s | Écran scindé qui s'ouvre en trois volets décalés : agenda papier raturé (L-A), tableur flou sur un portable (L-B), téléphone qui vibre à côté des clés (L-C). Désaturé à 40 %, léger flou. La pile de notifications reste en surimpression à 30 %. | Micro-dérive « à l'épaule » dans chaque volet |  | Vibrations, stylo qui gratte, tic-tac. VO : « Des dizaines de messages… » |
| **P04** | 0:05.0 → 0:08.0 · 3 s | Les volets se multiplient (5), se chevauchent, le flou gagne. Une seule tache de Terracotta : le badge « 12 » non lus. | Les volets dérivent à des vitesses différentes | « 1 seul vous. » à 0:05.8, centré, « vous » en Sable | Montée (riser) jusqu'à 0:07.9. VO : « … et un seul vous. » |

### Séquence 3 · Bascule (0:08 → 0:12)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P05** | 0:08.0 → 0:08.5 · 0,5 s | Tout se fige, en plein mouvement. Désaturation totale. | Arrêt net du dolly |  | **Silence complet** (coupure sèche). |
| **P06** | 0:08.5 → 0:12.0 · 3,5 s | Un packet bleu entre par la gauche, un teal par la droite. Sur leur passage, chaque élément figé se défait en fins traits qui suivent le flux (masques animés) : le chaos est aspiré vers le centre. | Recul lent de 6 % |  | Deux « tics » (requête, réponse), nappe qui s'ouvre. VO à 0:08.6 : « Et si tout s'orchestrait… tout seul ? » |

### Séquence 4 · Reveal (0:12 → 0:15)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P07** | 0:12.0 → 0:13.2 · 1,2 s | Les deux flux convergent et dessinent le contour de la maison en un seul trait (1,1 s), puis bouclent chacun autour d'un nœud intérieur. Fond : radial Nuit profonde → Bleu nuit. | Fixe, centré |  | Signature sonore : deux notes (requête, réponse), la seconde résout. |
| **P08** | 0:13.2 → 0:15.0 · 1,8 s | Le wordmark « baitly » monte de 16 px et apparaît en fondu à droite du mark (logo fond sombre). Les packets continuent leur cycle de 5 s. | Dolly-in de 2 % | Logo complet | VO à 0:13.3 : « Voici Bètli. » |

### Séquence 5 · Centralisation (0:15 → 0:23)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P09** | 0:15.0 → 0:17.0 · 2 s | **Morphing** : le mark rétrécit et devient le logo en haut de la barre latérale d'une fenêtre produit. Le tableau de bord (E02) se révèle autour, posé sur la dalle de verre. | Tilt 8° → 4°, dolly-in | Mention « Scène illustrative » en bas à gauche | Pulsation musicale qui s'installe. VO à 0:16.0 : « Toutes vos réservations… » |
| **P10** | 0:17.0 → 0:20.5 · 3,5 s | À gauche, quatre pictogrammes (Plateformes A, B, C, Direct). Les packets bleus emportent les réservations sur le flux jusqu'au planning (E03) : chaque brique entre par glissement horizontal depuis son heure d'arrivée, rangée après rangée, décalage de 120 ms. | Le dolly continue vers la grille |  | Petits « clics » feutrés à chaque brique posée. VO : « … tous vos logements, réunis au même endroit. » |
| **P11** | 0:20.5 → 0:23.0 · 2,5 s | Grille complète et alignée : 6 logements, semaine en cours, ligne « aujourd'hui ». Rien ne bouge sauf la caméra. | Travelling latéral lent (parallaxe entre dalle et fenêtre) | « Tout. » (0:20.8) · « Au même endroit. » (0:21.2, Sable) | Respiration musicale. |

### Séquence 6 · Automatisation (0:23 → 0:30)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P12** | 0:23.0 → 0:25.8 · 2,8 s | Plan serré sur une brique : « Camille Rousseau · 3 nuits · Appartement Bellecour ». À 0:24.0, le départ est enregistré : la brique passe à l'état « Parti », fondu de couleur de 300 ms, coche de succès. | Dolly-in rapproché (macro) |  | « Tock » de validation. VO à 0:24.0 : « Un voyageur part ? » |
| **P13** | 0:25.8 → 0:27.5 · 1,7 s | Un packet bleu quitte la brique vers la carte « Ménage planifié » (E05), qui entre (fondu + montée) ; sa coche se dessine en 300 ms. Le packet teal revient : la pastille balai apparaît **dans** la brique (fondu + pop 150 ms), comme dans le produit. | Pano court qui suit le packet | « Le ménage ? » (0:26.0) · « Déjà planifié. » (0:26.6, Sable) | Carillon doux. VO : « Le ménage est déjà planifié. » |
| **P14** | 0:27.5 → 0:30.0 · 2,5 s | **Raccord** : la coche devient la poignée de porte qui tourne. Lifestyle (L-D) : l'intervenante ménage ouvre la porte d'un appartement baigné de lumière. | Glissé avant à travers la porte | « Scène illustrative » | Pêne, ambiance calme, oiseaux lointains. |

### Séquence 7 · Marketplace et paiement (0:30 → 0:38)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P15** | 0:30.0 → 0:34.0 · 4 s | Retour sur nuit. Mosaïque de profils (E06) disposée **le long d'une courbe de flux**, tailles variées (pas une grille régulière) : ménage, blanchisserie, maintenance, photo, conciergerie. Chaque carte passe de 35 % à 100 % d'opacité quand le packet la traverse. | Travelling qui suit la courbe | « Les bons pros. » (0:31.0) | Une note par carte, en arpège. VO à 0:30.5 : « Besoin d'un photographe, d'une blanchisserie, d'un artisan ? » |
| **P16** | 0:34.0 → 0:36.0 · 2 s | Le curseur (flèche) clique « Demander » sur la carte du photographe → demande de prestation (E07) : « Shooting photo · Loft Presqu'île · jeu. 10 h » → statut « Confirmée ». | Dolly-in sur la carte | « En un clic. » (0:34.2, Sable) | Clic, confirmation. VO : « Notre marketplace les met à portée de clic. » |
| **P17** | 0:36.0 → 0:38.0 · 2 s | **Paiement (pilier 5)** : le packet teal revient avec la photo de contrôle ; la frise « Mission validée → Paiement → Payé » se remplit (180 €). | Fixe | Optionnel : « Payé, preuve à l'appui. » | « Ching » feutré, pas de caisse enregistreuse. VO optionnelle (§ 8.4). |

### Séquence 8 · Agents IA (0:38 → 0:46)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P18** | 0:38.0 → 0:41.0 · 3 s | Cockpit « Constellation » (E08) : les 10 agents en nœuds sur trois plans de profondeur, reliés par des flux bicolores qui circulent. Aucun robot, cerveau ni circuit. | Orbite lente de 6° |  | Nappe plus aérée. VO à 0:39.0 : « Et vos agents I.A. veillent… » |
| **P19** | 0:41.0 → 0:43.5 · 2,5 s | Fil de messages (E09) : « Bonjour, à quelle heure peut-on arriver ? ». Le nœud Communication pulse, la réponse s'écrit, puis « Envoyé ». | Dolly-in sur le fil |  | Frappe douce. VO : « … ils répondent, anticipent… » |
| **P20** | 0:43.5 → 0:46.0 · 2,5 s | Une carte d'alerte (E10) remonte au premier plan, seul élément Terracotta : « Chauffe-eau signalé en panne · arrivée à 15 h · proposer un technicien ? ». Boutons Approuver / Ajuster / Refuser. Le curseur survole « Approuver » sans cliquer. | Mise au point qui bascule vers la carte | « Vos agents IA veillent. » (« veillent » en Sable) | Alerte à deux notes, non anxiogène. VO : « … et vous alertent quand ça compte vraiment. » |

### Séquence 9 · Contrôle (0:46 → 0:52)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P21** | 0:46.0 → 0:49.5 · 3,5 s | Lifestyle (L-E) : la gestionnaire sur une terrasse face à un lac de montagne, fin de journée, téléphone en main. | Dolly-in lent, depuis l'arrière de l'épaule | « Scène illustrative » | Musique qui se réduit au piano, vent léger. VO à 0:47.0 : « Vous gardez le contrôle. » |
| **P22** | 0:49.5 → 0:52.0 · 2,5 s | Insert téléphone (L-F + E11) : l'écran Baitly « Aujourd'hui · Tout est en ordre ». Le pouce touche « Approuver » : c'est la carte de P20, validée par l'humain. | Fixe, léger mouvement de main | « Vous gardez le contrôle. » (0:49.7) | Tap discret. VO : « Bètli s'occupe du reste. » |

### Séquence 10 · Écran de fin (0:52 → 1:00)

| Plan | TC · durée | Image | Caméra | À l'écran | Son |
|---|---|---|---|---|---|
| **P23** | 0:52.0 → 0:54.5 · 2,5 s | Retour sur nuit. Les écrans du film (tableau de bord, planning, ménage, profils, constellation) s'étagent en profondeur puis se rétractent un à un en un trait qui nourrit le flux (l'inverse de l'aspiration). | Recul continu |  | Montée finale, sans riser agressif. |
| **P24** | 0:54.5 → 0:56.0 · 1,5 s | Le flux se referme en maison, boucle autour des nœuds ; le wordmark apparaît. | Fixe | Logo | Signature sonore, version complète. VO à 0:54.6 : « Bètli. » |
| **P25** | 0:56.0 → 1:00.0 · 4 s | Écran de fin : logo en haut, promesse sur deux lignes, bouton, adresse. Le bouton entre en dernier et réagit 200 ms à 0:57.5. Tenue de 2 s minimum. | Fixe | « Votre location courte durée, » / « en pilote automatique. » (ligne 2 Sable) · **A** : bouton « Rejoignez le pré-lancement » + baitly.fr · **B** : « Réservez votre démo » + baitly.fr/demo | Accord tenu, fondu à 0:59.5. VO : « Votre location courte durée, en pilote automatique. » |

### Sous-titres (toutes versions)

Incrustés, en bas du cadre, Manrope 600, texte Papier sur une plaque `rgba(10, 17, 32, 0.6)` de
rayon 8 px. Deux lignes au plus, 32 signes par ligne, coupure sur les groupes de sens. Ils suivent
la voix ; les titres cinétiques, eux, restent au tiers supérieur. Un fichier `.srt` est livré en
plus pour YouTube et LinkedIn. En version 9:16, ils respectent la zone de sécurité (§ 7.2).

### Musique et son

- **Musique** : 60 s, 88 à 92 bpm, piano feutré, pulsation analogique douce, cordes graves.
  0 → 8 s : tension (clusters qui montent, tic-tac) · 8,0 → 8,5 s : silence · 8,5 → 15 s : la nappe
  s'ouvre, signature sonore à 13,0 s · 15 → 46 s : pulsation légère, sans grosse batterie ·
  46 → 52 s : piano seul · 52 → 60 s : résolution et signature sonore complète.
- **Signature sonore** : deux notes tirées du flux (requête puis réponse), déclinées en « tics » dans
  tout le film, en version pleine à 13,0 s et à 54,6 s.
- **Mixage** : −14 LUFS intégré, crête vraie −1 dBTP, musique abaissée de 8 dB sous la voix.
  Stéréo 48 kHz.

---

## 5. Plans lifestyle : prompts de génération vidéo IA

Règles communes, à coller dans chaque prompt ou dans le champ négatif :
- Générer en **30 i/s** (et non 24), pour un doublement propre vers le master 60 i/s (§ 9).
- **Aucun texte lisible à l'écran** (les générateurs le déforment) : les écrans sont flous, éteints
  ou verts, et l'interface Baitly est incrustée en postproduction.
- Mention « Scène illustrative » sur chaque plan généré (règle du brand book).
- Négatif commun : `readable text, subtitles, watermark, logos, brand names, distorted hands, extra fingers, warped objects, flicker, lens flare, glow, neon, oversaturated colors, cartoon, 3D render look`.

### L-A · Agenda papier (P03, volet 1)

```text
Extreme close-up of a woman's hands hurriedly flipping through a worn paper planner covered in
crossed-out booking dates, sticky notes and scribbled phone numbers, on a cluttered kitchen table
in the evening. Cool, flat light from a single overhead lamp with a slight blue cast. 85mm macro
lens, very shallow depth of field, focus drifting between the pages. Handheld camera with subtle
nervous micro-movements and a slow push-in. Mood: overwhelmed, rushed, late evening. Muted,
slightly desaturated palette, natural skin tones, fine film grain. No readable text, no logos.
4 seconds, 30 fps, 16:9, photorealistic.
```

### L-B · Tableur (P03, volet 2)

```text
Over-the-shoulder shot of a property manager in his forties staring at a laptop showing a dense,
blurred spreadsheet grid with a few highlighted cells, a cold coffee mug beside it, in a small home
office at night. The screen is the key light, cool blue tones, dark surroundings. 50mm lens at f/2,
the screen content deliberately out of focus and unreadable. Slow lateral slide from left to right.
Mood: fatigue, mental load, too many tabs. No readable text, no logos, no recognizable software
interface. 4 seconds, 30 fps, 16:9, photorealistic, fine film grain.
```

### L-C · Téléphone et clés (P03 volet 3, P04)

```text
Top-down close-up of a smartphone vibrating on a wooden table next to a heavy bunch of apartment
keys with colored tags. The phone screen shows stacked, blurred notification banners. Each
vibration makes the keys tremble slightly. Hard side light from a window at dusk, cool shadows.
100mm macro lens, locked-off camera with a tiny drift. Mood: pressure, constant interruption.
No readable text, no logos, generic phone with no brand. 3 seconds, 30 fps, 16:9, photorealistic.
```

### L-D · La porte qui s'ouvre (P14)

```text
A housekeeper in her thirties, wearing a neat dark navy top without any logo, opens the front door
of a bright, freshly prepared short-term rental apartment in a Haussmann-style building in Lyon:
herringbone parquet, a white linen bed visible through a doorway, green plants, soft morning sun
streaming through tall windows. The shot starts on the door handle turning, then the camera glides
forward through the opening door on a smooth gimbal dolly, revealing the luminous living room.
Warm natural daylight, highlights toward sand and beige, shadows slightly blue. 35mm lens at
f/2.8. Mood: calm, orderly, welcoming, quiet satisfaction. No logos, no readable text.
3 seconds, 30 fps, 16:9, photorealistic, fine film grain.
```

### L-E · La terrasse (P21)

```text
A calm property manager in her early forties sits on a sunlit stone terrace overlooking a mountain
lake at golden hour, holding a smartphone loosely in one hand, a glass of water on a small wooden
table. She glances at the phone, then looks up at the view and exhales with a relaxed half smile.
The camera performs a slow dolly-in from behind and slightly over her shoulder; the phone screen
faces away from the camera. Warm low sun, long soft shadows, highlights toward sand and
terracotta, shadows toward deep blue. 50mm lens at f/2. Mood: serenity, control, freedom.
No lens flare, no logos, no readable text. 4 seconds, 30 fps, 16:9, photorealistic, fine film grain.
```

Variante masculine : remplacer le sujet par « a calm property manager in his late forties, linen
shirt ». Garder la même lumière pour les raccords.

### L-F · Insert téléphone (P22)

```text
Close-up of a hand holding a modern smartphone with no brand and no logo, on the same stone
terrace at golden hour. The screen is switched off: dark, glossy, evenly lit, with no reflections
of faces. The thumb moves toward the lower third of the screen and taps once. Background: soft
bokeh of a mountain lake at sunset. 85mm lens at f/1.8. Near-static camera with a slight natural
handheld sway. No readable text, no logos. 3 seconds, 30 fps, 16:9, photorealistic.
```

L'écran E11 est incrusté par suivi des quatre coins (corner pin) sur l'écran éteint. Un écran vert
généré par IA suit mal : l'écran éteint est plus fiable.

**Déclinaisons 9:16.** Régénérer L-D, L-E et L-F directement en 9:16 (remplacer `16:9` par
`9:16, vertical composition, subject centered in the middle third`) plutôt que recadrer : le sujet
doit rester hors des 15 % du haut et des 20 % du bas.

---

## 6. Plans d'interface : écrans à maquetter et animations

Tous les écrans reprennent les **vrais composants** du produit, avec des données fictives (sources
dans l'[inventaire](../motion/INVENTAIRE-COMPOSANTS.md)). Rendu des calques d'interface en
**60 i/s**, en 4K, avec couche alpha (séquence PNG ou ProRes 4444). La caméra 3D et le verre se
composent ensuite (After Effects, ou directement en HTML avec le kit `../motion/shared/kit.js`
et des transformations CSS 3D).

### 6.1 Écrans

| ID | Écran | Plans | Source produit | Contenu fictif |
|---|---|---|---|---|
| **E01** | Pile de notifications | P01-P02, P04 | `inboxRow` du kit, en cartes de verre | voir la liste ci-dessous |
| **E02** | Tableau de bord | P09 | Projection « Tableau de bord » (`modules/admin/design-system`), `StatTile` | Occupation 78 % · Arrivées aujourd'hui 4 · Départs 3 · Revenus du mois 18 420 € |
| **E03** | Planning semaine | P10-P13 | `PlanningBar`, `PlanningRow` (brand book § 5 bis) | 6 logements × 7 jours, photos voyageurs (`../brand-book/assets/guests/`) |
| **E04** | Pictogrammes de plateformes | P10 | à dessiner | Plateforme A (cercle), B (carré arrondi), C (losange), Direct (mark Baitly) ; Bleu lune, sans aucun logo tiers |
| **E05** | Carte « Ménage planifié » | P13 | L07 (piste de ménage) | « Ménage après départ · Appartement Bellecour · aujourd'hui 11 h → 14 h · Inès Martin » |
| **E06** | Profils de prestataires | P15 | écran `/marketplace/providers` | 7 cartes : photo, nom, métier (icône Lucide), zone, « Disponible demain ». **Pas de note en étoiles** (non calculée dans le produit) |
| **E07** | Demande de prestation + paiement | P16-P17 | `ServiceRequestCard` (P10) + progression de paiement (M08) | « Shooting photo · Loft Presqu'île · jeu. 10 h · 180 € » → « Confirmée » → « Payé » |
| **E08** | Constellation d'agents | P18 | Projection « Constellation d'agents » | 10 agents, pastilles aux couleurs d'agents du brand book |
| **E09** | Fil de messages voyageur | P19 | `chatScreen`, `bubbleIn`, `typeText` du kit | Sofia Fontaine : « Bonjour, à quelle heure peut-on arriver ? » → « Bonjour Sofia, l'arrivée est possible dès 15 h. Votre code d'accès vous sera envoyé le matin même. » |
| **E10** | Carte d'alerte | P20, P22 | `hitlCard` du kit | Agent Opérations · Priorité haute · « Chauffe-eau signalé en panne · Studio Canut · arrivée à 15 h · Proposer un technicien ? » |
| **E11** | Écran mobile « Aujourd'hui » | P22 | application mobile (Expo), à maquetter | « Tout est en ordre · 3 arrivées · 2 ménages planifiés · 1 décision » + la carte E10 en version compacte |
| **E12** | Écran de fin | P24-P25 | `BaitlyMarkLogo` (logo animé) | Versions A et B (§ 4, P25), en 16:9 et en 9:16 (logo vertical) |

**E01 · les 13 notifications** (dans l'ordre d'apparition) :
1. Plateforme A · Nouvelle réservation · Studio Canut · 3 nuits
2. Plateforme B · Demande de réservation · Chalet des Aravis
3. Voyageur · « Le code de la boîte à clés ne marche pas »
4. Équipe ménage · Retard 45 min · Appartement Bellecour
5. Plateforme C · Modification de dates · Villa Basque
6. Voyageur · « Vous avez un fer à repasser ? »
7. Plateforme A · Annulation · Loft Presqu'île
8. Voyageur · « On arrive à 23 h, c'est possible ? »
9. Propriétaire · « Tu peux m'envoyer le relevé ? »
10. Plateforme B · Nouveau message
11. Équipe ménage · Linge manquant · Studio Canut
12. Voyageur · « Il n'y a plus d'eau chaude »
13. Plateforme C · Nouvelle réservation · T2 Vieux-Port

**Logements fictifs** : Studio Canut (Lyon 4e) · Appartement Bellecour (Lyon 2e) · Loft Presqu'île
(Lyon 2e) · Chalet des Aravis (La Clusaz) · Villa Basque (Biarritz) · T2 Vieux-Port (Marseille).
**Voyageurs** : Camille Rousseau, Sofia Fontaine, Thomas Keller, Léa Morel, Yanis Benali,
Emma Schneider. **Prestataires** : Inès Martin (ménage), Julien Roux (photographe), Karim Haddad
(maintenance), Nora Petit (blanchisserie), Hugo Lambert (conciergerie).

### 6.2 Animations

| Plan | Animation | Durée · courbe |
|---|---|---|
| P02 | Chute des notifications : glissé de 40 px vers le bas + fondu ; chaque carte recule de 60 px en Z quand la suivante arrive | 180 ms par carte · signature |
| P06 | Aspiration : chaque élément se découpe en 6 à 10 traits qui suivent la tangente du flux | 600 à 900 ms, déclenché au passage du packet |
| P07 | Tracé du logo : `stroke-dashoffset` sur le tracé unique, puis boucle des packets | 1,1 s · signature, puis cycle linéaire de 5 s |
| P09 | Morphing mark → logo de la barre latérale : interpolation position + échelle, la fenêtre se révèle par masque radial | 700 ms · signature |
| P10 | Briques : glissé horizontal depuis l'heure d'arrivée, rangée après rangée | 400 ms par brique, décalage 120 ms |
| P12 | Changement de statut : fondu de couleur de la brique | 300 ms |
| P13 | Carte ménage : fondu + montée de 16 px ; coche dessinée ; pastille dans la brique (fondu + pop) | 400 ms · 300 ms · 150 ms |
| P15 | Cartes de profils : opacité 35 → 100 % au passage du packet | 250 ms chacune |
| P16 | Clic : onde ronde depuis la pointe du curseur, bouton pressé 120 ms | 200 ms |
| P17 | Frise de paiement : remplissage gauche → droite, montant qui roule (chiffres tabulaires) | 800 ms · signature |
| P18 | Nœuds : pulsation lente d'échelle 1 → 1,04 → 1 ; flux en boucle sur les liens | 2,4 s en boucle |
| P19 | Réponse tapée : 35 signes/s, puis pastille « Envoyé » | environ 2 s |
| P20 | Carte d'alerte : montée en Z de 120 px, flou des autres couches 0 → 6 px | 500 ms · signature |
| P23 | Rétraction : chaque écran s'écrase en une ligne (échelle Y 1 → 0,02), qui glisse dans le flux | 500 ms, décalage 150 ms |
| P25 | Bouton : entrée en dernier, micro-réaction (Sable qui s'éclaircit) | 200 ms |

---

## 7. Cutdowns

### 7.1 Cutdown 30 s · 16:9

| TC | Contenu (plans du hero) | À l'écran | VO 30 s |
|---|---|---|---|
| 0:00 → 0:02.5 | P02 raccourci, rafale directement au pic | « 5 plateformes. 3 équipes. » | « Cinq plateformes. Trois équipes. » |
| 0:02.5 → 0:04.0 | P04 (1 s) + P05 (0,3 s de silence) | « 1 seul vous. » | « Et un seul vous. » |
| 0:04.0 → 0:06.5 | P06 accéléré + P07/P08 | Logo | « Voici Bètli. » |
| 0:06.5 → 0:11.0 | P09 → P11 | « Tout. Au même endroit. » | « Toutes vos réservations, au même endroit. » |
| 0:11.0 → 0:15.0 | P12 → P13 (sans le plan lifestyle) | « Le ménage ? Déjà planifié. » | « Le ménage, déjà planifié. » |
| 0:15.0 → 0:19.0 | P15 (2 s) + P16 (1 s) + P17 (1 s) | « Les bons pros. En un clic. » | « Les bons pros, en un clic. » |
| 0:19.0 → 0:23.5 | P18 (1,5 s) + P20 (3 s) | « Vos agents IA veillent. » | « Et vos agents I.A. veillent. » |
| 0:23.5 → 0:26.0 | P21 (1 s) + P22 (1,5 s) | « Vous gardez le contrôle. » | « Vous gardez le contrôle. » |
| 0:26.0 → 0:30.0 | P24 + P25 | Promesse + CTA + URL | « Bètli. Votre location courte durée, en pilote automatique. » |

### 7.2 Cutdown 30 s · 9:16

Même montage et même voix que le 7.1, recadré pour la verticale :
- **Zone de sécurité** (1080×1920) : rien d'important dans les 288 px du haut (15 %) ni dans les
  384 px du bas (20 %). La zone utile fait 1080×1248 px.
- **Titres** : 88 à 110 px, centrés dans le tiers supérieur de la zone utile. **Sous-titres** : juste
  au-dessus de la limite des 20 %.
- **Écrans** : on ne recadre pas le bureau. Planning réduit à 3 logements × 5 jours ; la
  Constellation en colonne ; P09 remplacé par l'écran mobile E11 en entier.
- **Lifestyle** : versions 9:16 régénérées (fin du § 5).
- **Écran de fin** : logo vertical (mark au-dessus du wordmark), promesse sur trois lignes, bouton
  pleine largeur moins 64 px de marge.

### 7.3 Cutdown 15 s · 9:16

L'accroche ne se construit pas : on ouvre **au pic du chaos**.

| TC | Contenu | À l'écran | VO 15 s |
|---|---|---|---|
| 0:00 → 0:02.0 | Rafale au pic (P02 fin + P04), dès la 1re image | « 5 plateformes. » (0:00.1) · « 1 seul vous. » (0:01.0) | « Cinq plateformes. Un seul vous. » |
| 0:02.0 → 0:03.0 | P05 (0,3 s de silence) + P06 accéléré |  |  |
| 0:03.0 → 0:04.5 | P07 + P08 | Logo | « Voici Bètli. » |
| 0:04.5 → 0:06.5 | P10 (planning mobile) | « Tout au même endroit. » | « Vos réservations réunies… » |
| 0:06.5 → 0:08.5 | P13 | « Ménage planifié. » | « … le ménage planifié… » |
| 0:08.5 → 0:11.0 | P20 | « Vos agents IA veillent. » | « … et vos agents I.A. qui veillent. » |
| 0:11.0 → 0:12.5 | P22 | « Vous gardez le contrôle. » |  |
| 0:12.5 → 0:15.0 | P25 vertical | Promesse + CTA + URL | « Bètli. Votre location courte durée, en pilote automatique. » |

Boucle : la dernière image (logo sur nuit) raccorde avec la première (rafale sur nuit), pour que le
Reel reparte sans coupure visible.

---

## 8. Voix off · Eleven v4

### 8.1 Ce qui change avec Eleven v4 (sorti le 28 septembre 2026)

- Modèle `eleven_v4` (production) et `eleven_v4_turbo` (temps réel, inutile ici). Il est déjà
  disponible sur votre compte.
- **Balises en langage naturel**, empilables et suivies dans l'ordre : `[calm, slightly tense]`,
  `[quietly curious]`, `[measured]`, `[gradually building energy]`… Vos balises du script
  fonctionnent telles quelles.
- **Plus de curseurs Style ni Vitesse** : restent Stabilité et Similarité. Le rythme se règle par le
  texte (« … », ponctuation, balises comme `[slower]`, `[measured]`). SSML (`<break>`) désactivé.
- Voix Professionnelles (PVC) et de la bibliothèque prises en charge ; elles sonnent plus proches de
  leur enregistrement d'origine qu'en v3.
- **Changement de langue sans accent** : une voix française parle un anglais naturel, sans accent
  français. On peut donc garder la même voix pour la version anglaise ; à tester contre Mark.

### 8.2 Casting · 8 prises v4 du script du hero

Même texte, mêmes réglages pour toutes : `eleven_v4`, langue `fr`, Stabilité 0,5, Similarité 0,75,
mp3 44,1 kHz 192 kb/s. Fichiers : [`casting-voix-v4/`](casting-voix-v4/). Le texte envoyé est celui
du § 8.3 ; « Baitly » y est écrit « Bètli » pour la prononciation.

Cible du brand book : 2 à 2,4 mots/s. Les mesures sont automatiques (durée, silences de plus de
0,25 s, volume) ; **l'écoute tranche**.

| Fichier | Voix (voice_id) | Profil | Durée | Débit | Pauses | Lecture |
|---|---|---|---|---|---|---|
| `1-vincent.mp3` | Vincent · Calm & clear french narrative (`eDaM8z1udmnynsRHDkUP`) | Homme, narration posée | 33,4 s | 2,58 mots/s | 14 · 4,9 s | Le profil le plus proche d'une keynote : calme, net. |
| `2-paulk-narrateur.mp3` | Paul K · Deep French Narrator (`5l4ttmr4SKNgi0HnOelT`) | Homme, grave, cinéma | 36,6 s | 2,35 mots/s | 16 · 6,3 s | Le seul dans la cible de débit, le plus aéré. Le plus « film ». |
| `3-paulk-pub-trailer.mp3` | Paul K · French Ad & Trailer (`ecxPjiGTvAfpGEams6ec`) | Homme, pub et bande-annonce | 36,7 s | 2,34 mots/s | 15 · 5,3 s | Contre-proposition : risque de sonner « bande-annonce », contraire au ton. |
| `4-laurent.mp3` | Mr. Laurent · French Podcast (`necQJzI1X0vLpdnJteap`) | Homme, chaleureux, conversation | 35,0 s | 2,46 mots/s | 10 · 3,6 s | Plus proche, moins solennel : idéal pour les cutdowns sociaux. |
| `5-nicolas.mp3` | Nicolas · Narrator (`aQROLel5sQbj1vuIVi6B`) | Homme, narration neutre | 32,7 s | 2,63 mots/s | 10 · 3,4 s | Le plus rapide des hommes, peu de respirations. |
| `6-lucie.mp3` | Lucie · Narration (`LFtQZWdaqmvamcTNGpwl`) | Femme, narration | 33,8 s | 2,55 mots/s | 13 · 4,8 s | **Continuité de marque** : la voix des Reels 01, 03, 05, 08, 10, 12, 14. |
| `7-sarah.mp3` | Sarah · Expressive and Modulated (`t8BrjWUT5Z23DLLBzbuY`) | Femme, expressive | 32,6 s | 2,63 mots/s | 10 · 3,7 s | La plus modulée. Volume plus bas (−24,7 LUFS). |
| `8-anna.mp3` | Anna · Natural and Conversational (`nVPCtAFzgyMX3FZKNzH0`) | Femme, naturelle | 33,3 s | 2,58 mots/s | 11 · 3,9 s | La plus « collègue » (portrait voix du brand book, § 8). |

**Recommandation.** Je ne peux pas écouter les fichiers : ce classement repose sur le profil des
voix, les mesures et le ton du brief.
1. **Vincent** pour le hero : le « calme, confiant, premium » du brief.
2. **Paul K · Deep French Narrator** si vous voulez plus de gravité cinéma ; son débit est déjà dans
   la cible.
3. **Lucie** si le film doit prolonger la série des Reels (une seule voix de référence en français,
   comme le demande le brand book).

Pour les cutdowns sociaux, garder la voix du hero (cohérence) ou passer à Mr. Laurent, plus proche.
Noé n'est pas proposé : son débit (20 à 26 signes/s) ne convient pas à un film calme.

**Voix retenue (29 septembre 2026) : Paul K · French Ad & Trailer (`ecxPjiGTvAfpGEams6ec`),
direction « keynote », Stabilité 0,3** : prise K1, calée au § 8.9. Vincent (§ 8.7) avait d'abord été
choisi, puis jugé trop mou (§ 8.8).

### 8.3 Texte à générer · hero 60 s

Coller tel quel dans ElevenLabs (modèle Eleven v4, langue française forcée).

```text
[calm, slightly tense] Cinq plateformes. Trois équipes de ménage. Des dizaines de messages... [short pause] et un seul vous.

[softer, intrigued] Et si tout s'orchestrait... tout seul ?

[confident] Voici Bètli.

[warm, steady] Toutes vos réservations, tous vos logements, réunis au même endroit.

Un voyageur part ? Le ménage est déjà planifié.

Besoin d'un photographe, d'une blanchisserie, d'un artisan ? Notre marketplace les met à portée de clic.

[confident] Et vos agents I.A. veillent : ils répondent, anticipent... et vous alertent quand ça compte vraiment.

[slower, reassuring] Vous gardez le contrôle. Bètli s'occupe du reste.

[upbeat, clear] Bètli. Votre location courte durée, en pilote automatique.
```

Écritures voulues : « Bètli » (prononciation de Baitly), « I.A. » (épelé). La voix dure 33 à 37 s
selon la voix : elle laisse 23 à 27 s de respiration au film (silence du P05, logo, plans lifestyle).

### 8.4 Réplique optionnelle · paiement (A6)

À insérer après « Notre marketplace les met à portée de clic. » (P17, 0:36.0) :

```text
[warm, steady] Et chacun est payé... une fois le travail validé.
```

Environ 2 s. Elle traduit le fait vérifiable « preuve photo avant paiement ».

### 8.5 Textes des cutdowns

**30 s** (environ 22 s de voix) :

```text
[calm, slightly tense] Cinq plateformes. Trois équipes. [short pause] Et un seul vous.

[confident] Voici Bètli.

[warm, steady] Toutes vos réservations, au même endroit. Le ménage, déjà planifié. Les bons pros, en un clic.

[confident] Et vos agents I.A. veillent.

[slower, reassuring] Vous gardez le contrôle.

[upbeat, clear] Bètli. Votre location courte durée, en pilote automatique.
```

**15 s** (environ 11 s de voix) :

```text
[calm, slightly tense] Cinq plateformes. Un seul vous.

[confident] Voici Bètli.

[warm, steady] Vos réservations réunies, le ménage planifié, et vos agents I.A. qui veillent.

[upbeat, clear] Bètli. Votre location courte durée, en pilote automatique.
```

### 8.6 Méthode de génération

1. Choisir la voix à l'écoute des 8 prises.
2. Générer le bloc entier d'un coup (plus régulier qu'une phrase isolée), 2 ou 3 prises, garder la
   meilleure.
3. Caler chaque réplique sur les timecodes du § 4 avec `../motion/align-vo.py`, puis mesurer les
   blancs. Voix trop rapide sur un plan : enrichir le texte ou ajouter « … » (plus de curseur
   Vitesse en v4).
4. Une balise lue à voix haute : régénérer ; si elle revient, la retirer.

### 8.7 Prises de Vincent et calage sur le hero

Trois prises complètes du texte du § 8.3, Eleven v4, Stabilité 0,5, Similarité 0,75, dans
[`vo/fr/`](vo/fr/). La prise 3 garde les mêmes mots mais ajoute des indications de rythme
(`unhurried`, `slow`, `measured`) pour ralentir la voix.

| Prise | Durée brute | Débit | Pauses |
|---|---|---|---|
| `_prise-complete-1.mp3` | 33,6 s | 2,56 mots/s | 15 · 4,9 s |
| `_prise-complete-2.mp3` | 33,5 s | 2,57 mots/s | 13 · 4,6 s |
| `_prise-complete-3-posee.mp3` | 35,6 s | **2,42 mots/s** (cible 2 à 2,4) | 15 · 5,6 s |

Chaque prise est calée par [`caler-vo.py`](caler-vo.py) dans son dossier (`vo/fr/prise-*/`) :
répliques séparées `b1.wav` à `b9.wav`, piste voix de 60 s `vo-hero-60s-fr.wav` (48 kHz, stéréo,
normalisée à −16 LUFS pour laisser la place à la musique) et sa copie d'écoute `.mp3`, sous-titres
`vo-hero-60s-fr.srt` et `calage.json`.

**Coupures forcées.** Vincent marque les « … » et les fins de réplique par des pauses de même
longueur (0,2 à 0,7 s) : la détection automatique coupait sur les « … ». Les 8 coupures de chaque
prise sont relevées à la main dans `FORCE_BOUNDS` ; toute nouvelle prise demandera le même relevé.

**Calage de la prise 3** (départ = cible partout, aucun débordement) :

| Réplique | Plan | Départ | Fin | Durée |
|---|---|---|---|---|
| b1 · « Cinq plateformes… un seul vous. » | P01 | 0,40 | 6,68 | 6,28 s |
| b2 · « Et si tout s'orchestrait… » | P06 | 8,60 | 11,39 | 2,79 s |
| b3 · « Voici Bètli. » | P08 | 13,30 | 14,50 | 1,20 s |
| b4 · « Toutes vos réservations… » | P09 | 16,00 | 19,50 | 3,50 s |
| b5 · « Un voyageur part ? … » | P12 | 24,00 | 26,33 | 2,33 s |
| b6 · « Besoin d'un photographe… » | P15 | 30,50 | 35,29 | 4,79 s |
| b7 · « Et vos agents I.A. veillent… » | P18 | 39,00 | 44,03 | 5,03 s |
| b8 · « Vous gardez le contrôle… » | P21 | 47,00 | 49,90 | 2,90 s |
| b9 · « Bètli. Votre location… » | P24 | 54,60 | 58,09 | 3,49 s |

**Titres cinétiques à recaler sur la voix** (repères estimés au prorata des signes, dans
`calage.json`) : « Au même endroit. » à 18,8 s au lieu de 21,2 · « Déjà planifié. » à 25,6 s au
lieu de 26,6 · « En un clic. » à 35,1 s au lieu de 34,2. Les autres repères tombent à moins de
0,3 s de leur cible.

**À surveiller.** b6 est la réplique la plus rapide dans les trois prises (environ 21,7 signes/s,
contre 13 à 20 pour les autres) : si elle paraît pressée à l'écoute, la régénérer seule en ajoutant
des « … » entre les métiers (« Besoin d'un photographe… d'une blanchisserie… d'un artisan ? »),
la fenêtre du plan (30,5 → 38 s) laisse 2,7 s de marge.

### 8.8 Direction de jeu : essais d'énergie

**Retour du 29 septembre** : les prises du § 8.7 sont « molles et ennuyeuses ». Cause principale :
la direction. Tout le texte était balisé dans le registre calme (`[calm]`, `[softer]`,
`[warm, steady]`, `[slower, reassuring]`, puis `unhurried` et `measured` sur la prise 3) à Stabilité
0,5. « Premium » ne veut pas dire « lent ». En v4, une Stabilité plus basse donne un jeu plus varié.

Six essais, mêmes mots, Stabilité 0,3, dans
[`casting-voix-v4/essais-energie/`](casting-voix-v4/essais-energie/). Mesures de
[`mesurer-prosodie.py`](mesurer-prosodie.py) : **mélodie** = variation de hauteur (écart type, en
demi-tons), **ton** = hauteur moyenne. Chiffres comparatifs entre prises d'un même texte.

| Essai | Voix · direction | Mélodie | Ton | Avant (1re direction) |
|---|---|---|---|---|
| V1 | Vincent · keynote | 4,49 st | 182 Hz | 3,79 st · 130 Hz |
| V2 | Vincent · pub | 4,75 st | 207 Hz | 3,79 st · 130 Hz |
| V3 | Vincent · complice | 4,54 st | 164 Hz | 3,79 st · 130 Hz |
| K1 | Paul K (pub, bande-annonce) · keynote | 4,91 st | 178 Hz | 5,06 st · 157 Hz |
| K2 | Mr. Laurent · keynote | 4,81 st | 180 Hz | 4,95 st · 142 Hz |
| K3 | Sarah · keynote | 4,13 st | 241 Hz | 4,22 st · 201 Hz |

Lecture : sur Vincent, la direction seule fait passer la mélodie de 3,8 à 4,5-4,75 demi-tons et
relève le ton de 35 à 75 Hz. Vincent reste pourtant, par nature, la voix la moins mobile des huit
(3,8 contre 4,1 à 5,1). Paul K et Mr. Laurent varient déjà beaucoup : la direction keynote relève
surtout leur ton (plus d'engagement).

**Direction keynote** (V1, K1 à K3), à reprendre dans le § 8.3 si elle est retenue :

```text
[confident, crisp, a touch of urgency] Cinq plateformes. Trois équipes de ménage. Des dizaines de messages... [beat] et un seul vous.

[intrigued, leaning in] Et si tout s'orchestrait... tout seul ?

[bright, proud reveal] Voici Bètli.

[energetic, gradually building energy] Toutes vos réservations, tous vos logements, réunis au même endroit.

[quick, light, playful pace] Un voyageur part ? [satisfied] Le ménage est déjà planifié.

[lively, enthusiastic] Besoin d'un photographe, d'une blanchisserie, d'un artisan ? [with a smile] Notre marketplace les met à portée de clic.

[confident, emphatic] Et vos agents I.A. veillent : ils répondent, anticipent... [stress on next word] et vous alertent quand ça compte vraiment.

[warm but upbeat] Vous gardez le contrôle. [smiling] Bètli s'occupe du reste.

[bold, triumphant] Bètli. Votre location courte durée, en pilote automatique.
```

La direction **pub** (V2) attaque vite et tendu, puis passe au lumineux, avec trois points
d'exclamation ; la direction **complice** (V3) joue la conversation avec un ami. Les trois textes
balisés sont dans [`essais-energie/directions.txt`](casting-voix-v4/essais-energie/directions.txt).

### 8.9 Prise retenue : K1 (Paul K, direction keynote)

Retenue le 29 septembre. Prise d'origine : `vo/fr/_prise-complete-k1-paulk.mp3` (35,3 s) ; calage dans
`vo/fr/prise-k1-paulk/` (piste 60 s à −16 LUFS, répliques, `.srt`, `calage.json`). Aucune alerte :
les 9 répliques partent à leur cible, la voix finit à 58,35 s.

| Réplique | Départ | Fin | Durée |
|---|---|---|---|
| b1 · « Cinq plateformes… un seul vous. » | 0,40 | 6,13 | 5,73 s |
| b2 · « Et si tout s'orchestrait… » | 8,60 | 11,23 | 2,63 s |
| b3 · « Voici Bètli. » | 13,30 | 14,48 | 1,18 s |
| b4 · « Toutes vos réservations… » | 16,00 | 19,69 | 3,69 s |
| b5 · « Un voyageur part ? … » | 24,00 | 26,52 | 2,52 s |
| b6 · « Besoin d'un photographe… » | 30,50 | 35,60 | 5,10 s |
| b7 · « Et vos agents I.A. veillent… » | 39,00 | 44,04 | 5,04 s |
| b8 · « Vous gardez le contrôle… » | 47,00 | 49,72 | 2,72 s |
| b9 · « Bètli. Votre location… » | 54,60 | 58,35 | 3,75 s |

Titres cinétiques à recaler : « 1 seul vous. » à 5,2 s (au lieu de 5,8) · « Au même endroit. » à
19,0 s (au lieu de 21,2) · « Déjà planifié. » à 25,8 s (au lieu de 26,6) · « En un clic. » à 35,4 s
(au lieu de 34,2). Les cutdowns 30 s et 15 s se génèrent avec la même voix, la même direction et la
même Stabilité.

---

## 9. Spécifications de livraison

Un fichier vidéo n'a qu'une cadence : le brief (30 i/s, 60 i/s pour l'interface) se résout ainsi.

| Livrable | Définition | Cadence | Usage |
|---|---|---|---|
| Hero 60 s · 16:9 | 3840×2160 | **60 i/s** (l'interface est la vedette) | Site, YouTube |
| Hero 60 s · 16:9 | 1920×1080 | 30 i/s | LinkedIn |
| Cutdown 30 s · 16:9 | 1920×1080 | 30 i/s | LinkedIn, YouTube |
| Cutdown 30 s · 9:16 | 1080×1920 | 30 i/s | Reels, TikTok, Shorts |
| Cutdown 15 s · 9:16 | 1080×1920 | 30 i/s | Reels, TikTok, Shorts |

- Calques d'interface rendus en 60 i/s ; plans IA générés en 30 i/s et doublés vers 60 i/s (le
  24 i/s saccade une fois converti).
- H.264 High, 4K à 40 Mb/s, 1080p à 16 Mb/s ; audio AAC 320 kb/s, −14 LUFS, −1 dBTP.
- Sous-titres incrustés sur toutes les versions + `.srt` séparé.
- Nommage : `baitly-film-{60s|30s|15s}-{16x9|9x16}-{4k60|1080p30}-{fr}-{A|B}.mp4`
  (A = pré-lancement, B = démo).

---

## 10. Décisions attendues

1. **Voix** : écouter les 8 prises (`casting-voix-v4/`) et en retenir une, ou deux (hero et cutdowns).
2. **A2** : scène Nuit avec fenêtres claires pour le hero, alors que les Reels sont en mode Jour ?
3. **A4** : produire les deux écrans de fin (A pré-lancement, B démo) ou un seul ?
4. **A5** : garder la place de marché (avec « Scène illustrative ») ou la réserver à la version B ?
5. **A6** : ajouter la réplique paiement (§ 8.4) ?
6. **Suisse** : prix en euros seulement, ou vérifier la prise en charge du CHF ?
