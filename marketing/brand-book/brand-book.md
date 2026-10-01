# Baitly · Brand book & guide de création

> **À quoi sert ce fichier.** Version texte, relisible rapidement, du brand book Baitly. La version mise
> en page (avec nuanciers, spécimens, logos et schémas) est le PDF `baitly-brand-book.pdf`, généré
> depuis `brand-book.html` par `./build-pdf.sh`.
> **Comment l'utiliser.** Motion designer et graphiste : sections 2 à 7. Copywriter : sections 1 et 8.
> Responsable marketing : tout. Toute modification de fond se fait dans `brand-book.html` **et** ici.
> **À qui il s'adresse.** Freelances, agences, motion designers, graphistes, copywriters.
>
> Version 1.0 · 26 septembre 2026

Sommaire : [1. Vision](#1-vision--positionnement) · [2. Couleurs](#2-couleurs) · [3. Typographies](#3-typographies) · [4. Logo](#4-logo--assets-graphiques) · [5. Composants UI](#5-composants-ui--style-dinterface) · [6. Motion](#6-principes-de-motion-design) · [7. Templates](#7-templates-de-contenus-sociaux) · [8. Voix off](#8-voix-off--storytelling) · [Annexes](#annexes)

---

## 1. Vision & positionnement

**Promesse : « Faites grandir vos revenus. Pas votre charge de travail. »**

Baitly est un PMS (logiciel de gestion locative) pour la location courte durée et l'hébergement
indépendant. Il réunit dans un seul espace le planning et les canaux de vente, le site de réservation
directe, le livret d'accueil, le ménage, les paiements, la conformité et le reporting propriétaire.
Sa différence : une équipe de **10 agents IA** qui surveillent l'activité, proposent des actions
expliquées et les exécutent sous le contrôle de l'hôte, et une **conformité locale native** pour
l'Arabie saoudite (Shomoos, ZATCA, TVA, riyals, arabe et calendrier hégirien), le Maroc (fiche de
police DGSN, taxe de séjour, dirhams) et la France. Pour les hôtes indépendants, riads et maisons
d'hôtes, propriétaires d'istirahas et conciergeries. En une phrase : **Baitly prend les coulisses,
vous gardez l'accueil.**

| Cible | Ce qu'elle vit | Ce que Baitly lui apporte |
|---|---|---|
| Hôte indépendant (1–5 logements) | Messages à toute heure, calendriers, prix au jugé | Planning unique, réponses prêtes, extras vendus |
| Riad, maison d'hôtes (Maroc) | Fiche de police, encaissement local, multilingue | Fiche DGSN transmise, CMI / PayZone / YouCan Pay, livret AR/FR/EN |
| Istiraha, chalets (Arabie saoudite) | Shomoos, ZATCA, TVA, clientèle arabophone | Déclarations et factures conformes, riyals, arabe réel |
| Conciergerie (5–50+ logements) | Ménage à contrôler, propriétaires, volume | Preuve photo, relevés et mandats en ligne, agents IA |

**Valeurs** : Hospitalité (l'outil libère du temps d'accueil) · Contrôle (l'IA propose, l'hôte
décide) · Clarté (un seul espace, phrases courtes) · Ancrage local (règles, langues, paiements) ·
Honnêteté (aucun chiffre inventé, aucune scène fictive présentée comme réelle).

**Ton** : accueillant, concret, assuré. Vouvoiement. Bénéfice avant fonctionnalité. Phrases courtes,
souvent en deux temps. Registre : formel 3/5, chaleureux 4/5, expert 3/5, enthousiaste 2/5, humour 1/5.

Phrases types : « Moins d'onglets. Plus de présence. » · « Tous vos calendriers, une seule vérité. » ·
« Vous approuvez, ils exécutent. » · « Le ménage assigné, prouvé, payé. »

## 2. Couleurs

**Bleu nuit & Terre cuite.** Toute création (vidéo, motion design, image, post) se construit sur
deux familles : les teintes de **bleu nuit** (fond, calme, marque) et la palette **Terre cuite** des
briques du planning (chaleur de l'hospitalité, ce qui compte). La lumière (Papier `#F7FBFC`) les
sépare. Rien d'autre.

### Palette de création · vidéo & image

**Bleu nuit · la dominante (60 à 70 %)**

| Code | Nom | HEX | Usage |
|---|---|---|---|
| N900 | Nuit profonde | `#0A1120` | Ouvertures, scènes de nuit, fonds les plus denses |
| N800 | Nuit | `#111B31` | Fond alternatif, cartes sur nuit profonde |
| N700 | Bleu nuit | `#1B2A35` | Couleur de marque, fond principal, texte sur clair |
| N600 | Navy | `#25406E` | Aplats, CTA en mode Jour, logo sur clair |
| N500 | Ardoise nuit | `#2E4356` | Cartes et panneaux sur fond nuit |
| N300 | Bleu lune | `#9CB4E2` | Filets, icônes, accent froid sur nuit (7,0:1) |
| N100 | Brume nuit | `#D7E1EE` | Texte secondaire sur nuit (11,1:1) |

**Terre cuite · l'accent chaud (20 à 30 %)**

| Code | Nom | HEX | Usage |
|---|---|---|---|
| T100 | Sable | `#E0C89B` | Accent n°1 sur nuit : 2e ligne de titre, surlignage, CTA (9,0:1 sur `#1B2A35`) |
| T300 | Taupe | `#A89684` | Texte tertiaire et détails sur nuit (5,2:1) |
| T400 | Terracotta | `#B45733` | Un seul point d'attention par plan : alerte, curseur, pastille |
| T500 | Terre cuite | `#9A6C3A` | Aplats chauds, 2e ligne de titre sur clair (≥ 24 px) |
| T600 | Encre terre | `#7A5230` | Petit texte chaud sur clair (6,6:1) |
| T800 | Brun | `#5C3A21` | Fonds chauds : citations, témoignages |
| T900 | Encre brune | `#2B211A` | Texte posé sur Sable (9,7:1) |

**Trois modes de composition**

| Mode | Fond | Titre (ligne 1 / ligne 2) | CTA | Usage |
|---|---|---|---|---|
| **Nuit** (par défaut) | `#1B2A35`, `#111B31`, `#0A1120` | Papier / Sable | Sable, texte Encre brune | Vidéos, posts, ouvertures |
| **Jour** | Papier `#F7FBFC` | Bleu nuit / Terre cuite | Navy, texte Papier | Pédagogie d'interface |
| **Brun** | `#5C3A21` | Papier / Sable | Papier, texte Brun | Citations, témoignages |

**Règles de création**
- Chaque visuel = bleu nuit (60–70 %) + Terre cuite (20–30 %) + Papier (≤ 15 % en mode Nuit).
- Ce qui compte dans le plan (chiffre, mot clé, CTA) est chaud ; le reste est bleu nuit.
- Validé / payé / déclaré : coche Sable sur nuit, Terre cuite sur clair. Alerte : Terracotta, une fois par plan.
- Fond : aplat ou dégradé radial très doux Nuit profonde → Bleu nuit, jamais sur du texte.
- Étalonnage photo : ombres vers le bleu nuit, hautes lumières vers le sable (fin de journée, pierre, terre).
- **Hors palette de création** : bleu-gris, teal, bleu vif, argile, ambre, violet, couleurs d'agents
  et de canaux n'apparaissent qu'**à l'intérieur d'une maquette d'interface fidèle**. En plan
  d'ensemble, les pastilles d'agents passent en Sable. Seule exception : les deux « packets » du logo.

### Couleurs d'interface (landing & PMS) · référence pour les maquettes

Couleurs du produit, pour reproduire fidèlement l'interface. Elles ne pilotent pas la direction artistique.

### Marque

| Nom | HEX | RGB | CMJN* | Usage |
|---|---|---|---|---|
| **Bleu nuit** (primaire) | `#1B2A35` | 27 42 53 | 49 21 0 79 | Texte, titres, wordmark, fonds sombres |
| **Navy** (action) | `#25406E` | 37 64 110 | 66 42 0 57 | Boutons CTA, trait du logo sur clair |
| **Bleu-gris** (secondaire) | `#456675` | 69 102 117 | 41 13 0 54 | 2e ligne des titres, eyebrows, survol, focus |
| **Bleu-gris clair** (décor) | `#6B8A9A` | 107 138 154 | 31 10 0 40 | Traits, illustrations ; pas de texte courant |

### Neutres (teintés bleu)

| Nom | HEX | RGB | Usage |
|---|---|---|---|
| Papier | `#F7FBFC` | 247 251 252 | Fond par défaut (remplace le blanc) |
| Surface | `#E9F2F6` | 233 242 246 | Sections teintées, en-têtes de tableau |
| Brume | `#D6E6EE` | 214 230 238 | Surlignage, sélection, désactivé |
| Ligne | `#CAD6DD` | 202 214 221 | Bordures 1 px |
| Ardoise | `#4D5A64` | 77 90 100 | Texte secondaire |
| Carte | `#FDFDFE` | 253 253 254 | Cartes d'interface |
| Fond d'app | `#E8EEF3` | 232 238 243 | Fond des écrans PMS |
| Brume foncée | `#94A7B8` | 148 167 184 | Icônes inactives, décor (jamais du texte) |

### Signaux et flux du logo (teinte vive / encre pour le texte)

| Rôle | Teinte | Encre texte |
|---|---|---|
| Flux requête (logo), info | `#2563EB` | `#1D4ED8` |
| Flux réponse (logo) | `#0D9488` | n/a |
| Succès (payé, déclaré) | `#14B8A6` | `#0C7166` |
| Attention | `#D4A574` | `#7A5320` |
| Erreur, conflit | `#C97A7A` | `#93413F` |
| Mode sombre | fond `#0A1120`, cartes `#111B31`, texte `#D7E1EE`, accent `#9CB4E2`, flux `#60A5FA` / `#2DD4BF` | |

**Agents IA** (pastilles 8–12 px uniquement) : Communication `#3B6FE0` · Revenue `#7C5CE0` ·
Opérations `#1F9E8D` · Finance `#C77D2E` · Avis & Réputation `#D6457E` · Synchronisation `#3AA0C9` ·
Conformité `#5E7A99` · Voyageur `#E0685C` · Propriétaire `#A2845E` · Croissance `#5BAE4E`.

### Planning : les briques de réservation (palette « Terre cuite »)

Signature visuelle du produit et **seule famille chaude de l'interface** : une gamme de bruns où la
densité de la couleur dit la présence du voyageur. **C'est le statut qui colore la brique, jamais le
canal** (le canal est indiqué par son logo dans une pastille ronde sur la brique).

| Statut | Brique | RGB | CMJN* | Texte sur brique | Encre texte (sur carte) | Sens |
|---|---|---|---|---|---|---|
| En attente | `#E0C89B` | 224 200 155 | 0 11 31 12 | `#2B211A` (9,7:1) | `#8A6420` | Rien n'est acquis |
| Confirmée | `#9A6C3A` | 154 108 58 | 0 30 62 40 | `#FFFFFF` (4,6:1) | `#7A5230` | Le séjour tient |
| Sur place | `#5C3A21` (`#6B4527` en sombre) | 92 58 33 | 0 37 64 64 | `#FFFFFF` (10,1:1) | `#4A2E1B` | Le voyageur est là |
| Partie | `#A89684` | 168 150 132 | 0 11 21 34 | `#2B211A` (5,5:1) | `#6B6055` | Le passé se retire |
| Annulée | brique « fantôme » : fond transparent hachuré à 135° (gris `#67757C` à 22 %, trait 1,5 px tous les 8 px) | | | | | Inerte |

Anatomie complète : section « 5 bis. Le planning, pièce par pièce ».

**Autres repères du planning** : ménage `#2F9E8D` (icône balai sur pastille blanche) · maintenance `#4F86C6` (icône clé sur pastille blanche) ·
blocage = bande grisée hachurée `#67757C` · ligne « aujourd'hui » `#E5484D` · colonne week-end `#F2F6F7`.

**Couleurs de canal** (identification uniquement : légendes, filtres, graphiques ; jamais en fond de
brique ; en vidéo, préférer le logo officiel) : Airbnb `#E0735A` (encre `#A24A33`) · Booking.com
`#4A6B9A` (encre `#39527A`) · Vrbo `#3F8FA6` (encre `#2E6B7C`) · Expedia `#C6A24A` (encre `#8A6F28`) ·
Direct = Navy de marque.

Source : `client/src/modules/planning/planningUrgency.css` (statuts), `client/src/modules/planning/constants.ts`
(repères), `client/src/theme/signature/tokens.css` (canaux).

**Proportions d'une création (mode Nuit)** : Bleu nuit 65 % · Terre cuite 25 % (photos chaudes comprises) · Papier 10 %. Le mode Jour inverse Bleu nuit et Papier.

### Applications et états (contrastes mesurés)

| Usage | Couleur | Contraste |
|---|---|---|
| Texte sur Papier | Bleu nuit | 14,1:1 |
| Texte secondaire | Ardoise | 6,8:1 |
| Titre ligne 2, eyebrow | Bleu-gris | 5,9:1 |
| Bouton repos | Navy, texte Papier | 9,9:1 |
| Bouton survol | Bleu-gris + ombre teintée, 200 ms | 5,9:1 |
| Bouton pressé | Ardoise | 6,8:1 |
| Focus clavier | contour 3 px Bleu-gris, décalé 5 px | |
| Désactivé | fond Brume, texte `#94A7B8` | volontairement faible |
| Overlay photo | Bleu nuit 45–60 %, texte Papier sur la zone sombre | ≥ 4,5:1 à vérifier |

*CMJN : conversions mathématiques non calibrées, épreuve obligatoire avant impression.

## 3. Typographies

| Rôle | Police | Graisses | Fichiers |
|---|---|---|---|
| Titres, chiffres, wordmark | **Space Grotesk** | 500, 600, 700 | `assets/fonts/SpaceGrotesk_*.ttf` |
| Corps, boutons, sous-titres | **Manrope** | 400, 500, 700 | `assets/fonts/manrope-*.ttf` |
| Arabe | **Tajawal** | 500, 700 | Google Fonts |

Licence : SIL Open Font License (`assets/fonts/OFL.txt`).

| Style | Spécification |
|---|---|
| Display / H1 | Space Grotesk 700 · 48–80 px · interligne 1,05 · −1 % |
| H2 | Space Grotesk 700 · 32–50 px · 1,1 |
| H3 | Space Grotesk 600 · 25–36 px · 1,2 |
| Eyebrow | Manrope 700 · 12 px · capitales · +0,1 em · Encre terre (jour) ou Sable (nuit) |
| Lead | Manrope 500 · 18–20 px · 1,5 · Ardoise |
| Corps | Manrope 400 · 15–16 px · 1,55 |
| Bouton | Manrope 700 · 14 px · pas de capitales |
| Légende | Manrope 500 · 12 px minimum |
| Chiffres | Space Grotesk 700 · chiffres tabulaires obligatoires |

Vidéo (canevas 1080 px) : titre 88–110 px (9:16), 72–88 px (1:1), 80–100 px (16:9) ; sous-titres
Manrope 600 44 / 38 / 40 px ; eyebrow 24–32 px.

Arabe : interligne ≥ 1,45, aucun interlettrage, 13 px minimum à l'écran.

À faire : titres en deux lignes (la 2e en Sable sur nuit, Terre cuite sur clair), césure équilibrée, guillemets « », espaces
insécables. À éviter : tout en 600, phrases en capitales, texte en dégradé, autres polices.

## 4. Logo & assets graphiques

Le mark est une **maison tracée d'un seul trait continu** ; deux « packets » y circulent : un aller
bleu (requête) et un retour teal (réponse), image de la synchronisation permanente entre le logement,
les canaux et les voyageurs. Wordmark **« baitly » en minuscules, Space Grotesk 600**, interlettrage −1,5 %.

| Variante | Trait | Packets | Wordmark | Usage |
|---|---|---|---|---|
| Principal, fond clair | `#25406E` | `#2563EB` / `#0D9488` | `#1B2A35` | Par défaut |
| Fond sombre | `#E8EEF5` | `#60A5FA` / `#2DD4BF` | `#F7FBFC` | Scènes sombres |
| Monochrome | `#1B2A35` | aucun | `#1B2A35` | < 24 px, impression 1 couleur |
| Icône seule | comme principal | oui | aucun | Avatars, favicon, filigrane |
| Vertical | comme principal | oui | dessous | Écrans de fin 9:16 |
| Inversé sur Navy | `#F7FBFC` | aucun | `#F7FBFC` | Fonds Navy |

- Espace mark / wordmark = 0,25 × hauteur du mark ; wordmark ≈ 0,57 × hauteur du mark.
- **Zone de protection** : 0,5 × hauteur du mark sur les quatre côtés.
- **Tailles minimales** : mark 16 px / 5 mm ; logo complet 88 px / 25 mm de large.
- Le wordmark reste latin et de gauche à droite, même en arabe.
- **Interdits** : déformer, incliner, ombre, contour, remplir la maison, changer l'épaisseur, recolorer
  les packets, écrire « Baitly » en capitale dans le logo, poser sur une photo chargée sans voile,
  utiliser `client/src/assets/Baitly_logo.png` (ancien logo) ou tout logo Clenzy.
- **Logo animé** : packet bleu sur la 1re moitié d'un cycle de 5 s, packet teal sur la 2e, linéaire.
  Sert d'ouverture et de signature de fin. Sans animation : trait seul.
- Source du tracé : `assets/baitly-mark.svg` (et `client/src/components/BaitlyMarkLogo.tsx`).

**Photographies** : architecture d'hospitalité en lumière naturelle (riads, villas, istirahas,
chambres prêtes), gestes du métier plutôt que pictogrammes. **Arche** (coins hauts arrondis à 50 %)
réservée aux photos de lieux ; rayon 16 px pour le reste. Dans les maquettes d'interface, l'avatar d'un
voyageur montre sa photo, comme dans le produit (portraits de `assets/guests/`). Scène générée par IA = mention « Scène illustrative ». Catalogue et
licences : `client/site/assets/photos/` et `sources.json`. Sélection dans `assets/photos/`.

**Icônes** : Lucide, trait 1,7 px, Bleu nuit (Papier ou Bleu lune sur nuit, Sable pour l'icône mise en avant) ; 20–24 px en interface, 48–64 px en vidéo.
Aucun emoji comme icône. Un état n'est jamais porté par la couleur seule. Logos partenaires :
`client/site/assets/brands/`, petits, jamais en élément principal.

## 5. Composants UI & style d'interface

Principes : surfaces claires teintées, filets 1 px plutôt qu'ombres, rayons 8 px (contrôles) /
10–14 px (cartes) / 16 px (panneaux), contrôles ≥ 44 px, une action principale par zone, chiffres
tabulaires. Landing (registre marque) aérée, PMS (registre produit) dense ; les vidéos montrent le PMS.

| Composant | Spécification |
|---|---|
| Bouton principal | Navy, texte Papier, Manrope 700 14 px, rayon 8 px, hauteur 52 px (landing), padding 14 × 23 px |
| Survol / pressé / focus / désactivé | Bleu-gris + ombre teintée 200 ms / Ardoise / contour 3 px Bleu-gris décalé 5 px / fond Brume texte `#94A7B8` |
| Secondaire | fond Carte, filet Ligne, texte Bleu nuit |
| Tertiaire | lien Navy souligné, flèche |
| Carte d'agent | fond `#FDFDFE`, filet Ligne, rayon 14 px, ombre `0 8px 24px rgba(27,42,53,.08)`, pastille agent 10 px, nom en eyebrow, titre Space Grotesk 600, détail Ardoise ; boutons Approuver / Ajuster / Refuser |
| Planning | voir section 5 bis (règles reprises du code) |
| Champ | fond `#E1E9F0`, filet `#CBD5E1`, rayon 8 px ; focus : filet Bleu nuit + halo 3 px ; erreur : filet Argile + message en encre `#93413F` |
| Pastille de statut | fond pastel 11–16 % de la teinte, texte dans l'encre, toujours un mot |
| Tableau | en-tête Surface, filets 1 px, montants alignés à droite |
| Modale | seulement pour une confirmation irréversible ; sinon panneau latéral |

Interdits : bande latérale colorée > 1 px, texte en dégradé, glow, glassmorphism décoratif, trois
cartes identiques en rang, scale au survol, tous les boutons en style plein, noir ou blanc purs.


## 5 bis. Le planning, pièce par pièce

Règles reprises du code (`client/src/modules/planning/` : `PlanningBar.tsx`, `PlanningRow.tsx`,
`PlanningBlockedBand.tsx`, `constants.ts`, `utils/interventionAttachment.ts`, `planningUrgency.css`).
Toute maquette, image ou animation de planning doit les respecter. Le PDF en donne une maquette à
l'échelle réelle, annotée.

| # | Élément | Règle |
|---|---|---|
| 1 | Brique de réservation | 36 px de haut, posée à 9 px du haut d'une rangée de 54 px, rayon 9 px, aplat uni à la couleur du **statut** (Terre cuite), pas de bande latérale. Avatar rond 26 px avec la **photo du voyageur**, « N nuits » (9,5 px, 600, opacité 85 %) au-dessus du nom (12 px, 600). Padding 0 7 px 0 5 px, espacement 7 px. |
| 2 | Pilule de prix | 21 px, rayon 7, chiffres Space Grotesk 11 px gras. Réglé : verre translucide + coche (noir 20 % + texte blanc sur brique foncée ; blanc 55 % sur brique pâle). Non réglé : fond blanc, montant `#B25A2A`, icône carte `#C9803F`. Montant visible si brique ≥ 150 px, icône seule ≥ 104 px, sinon repli dans « +N ». |
| 3 | **Intervention rattachée** | **Dans la brique**, à droite : pastille blanche 21 × 21, rayon 7, ombre `0 1px 2px rgba(0,0,0,.14)`, icône colorée (balai ménage `#2F9E8D` 14 px, clé maintenance `#4F86C6` 13 px). Brique ≥ 184 px + tarif connu : pastille élargie « icône + montant » (texte `#15242D`, 10,5 px). |
| 4 | **Intervention non rattachée** | **À l'extérieur**, seule sur la grille à sa date : même carré blanc 21 × 21 rayon 7 à icône colorée, **plus un filet 1 px `#D5DEE7`**, centré verticalement dans la rangée, décalé de 2 px après le début du jour. Pas de libellé, pas de barre. |
| 5 | Urgence | Paiement en attente ou info voyageur manquante : anneau pulsé à la couleur de la brique (0 → 8 px, 2,4 s), mouvement « wizz » optionnel (~4 s). |
| 6 | Blocage | Pas une brique : bande de cellules grisées pleine hauteur, hachures 45° (1 px tous les 7 px), cadenas 12 px, libellé « Bloqué » si ≥ 68 px. |
| 7 | Annulée | Brique fantôme : fond clair hachuré 135°, filet pointillé 1,5 px `#DDE3E7`, texte gris barré, avatar en niveaux de gris, bouton rond « × » 16 px en haut à droite. |
| 8 | Aujourd'hui | Jour dans un carré 24 × 24 rayon 8 à l'encre de marque (Navy) ; ligne verticale 2 px `#E5484D` + point 10 px avec halo. Week-end : en-tête `#F2F6F7`, cellules `#F8FAFB`. |
| 9 | Repli « +N » | Le **nom du voyageur prime**. Se replient dans une pastille « +N » (blanc 90 %, 10 px gras) : pastilles d'intervention, logo du canal, puis prix ; l'avatar part en dernier (sous 90 px). |

**Quand une intervention est-elle rattachée ?** Un seul chemin par intervention. Elle va **dans la
brique** si, dans cet ordre : (1) lien explicite vers une réservation active du même logement ;
(2) sa date est entre l'arrivée et le départ d'un séjour (le jour du départ, le séjour qui se termine
gagne) ; (3) elle suit un départ avant que le séjour suivant ait commencé (ménage de rotation) ;
(4) elle précède une arrivée de 3 jours au plus (ménage anticipé). Sinon elle est orpheline et posée
seule (repère 4). Si la brique hôte est masquée (filtre, hors période), elle redevient autonome.

**Géométrie et états** : brique positionnée à l'heure (arrivée 15 h, départ 11 h par défaut, d'où un
vide les jours de rotation ; largeur minimale ½ jour) · zoom semaine 160 px/jour, quinzaine 80,
mois 38 · densité compacte 46/32 px · colonne logements 188 px, en-tête 44 px · survol : +1 px et
ombre douce · sélection : double anneau (2 px carte + 2 px terracotta `#B45733`) · conflit : anneau
2 px `#C97A7A` pulsé 2 s · brique trop étroite : alerte en point radar 10 px au coin (ambre `#C28A52`
info manquante, `#C97A7A` paiement) · pied de grille : occupation par jour · mode sombre : mêmes
briques (« Sur place » `#6B4527`), pastilles toujours blanches.

**En motion design** : les briques entrent par glissement horizontal depuis leur heure d'arrivée,
rangée après rangée ; un ménage lié apparaît en pastille **dans** la brique (fondu + pop 150 ms), jamais
comme une brique séparée ; un départ tardif **allonge la brique**, la pastille suit ; un changement de
statut est un fondu de couleur (300 ms) ; une seule brique en urgence par plan.

## 6. Principes de motion design

**Calme, précis, jamais gadget.** Le mouvement explique ; il reprend le comportement de l'interface.

- **Easing signature** : `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint ; After Effects : influence
  de sortie 85–90 %). Sorties : `cubic-bezier(0.64, 0, 0.78, 0)`, plus courtes. Pas d'élastique ;
  rebond ≤ 8 px pour un « drop ».
- **Durées** : micro-interaction 150–200 ms · entrée 300–500 ms · stagger 60–180 ms · transition de
  scène 600–800 ms · tracé du logo 1–1,2 s · cycle des packets 5 s · lecture d'un titre ≥ 1,5 s + 0,3 s/mot.
- **Titres** : mot à mot (60 ms) ou ligne à ligne, glissé 16–24 px + fondu ; 2e ligne (Sable / Terre cuite) +150 ms.
- **Chiffres** : en Sable sur nuit, Terre cuite sur clair ; compteur en chiffres tabulaires, 600–900 ms, ease-out.
- **Surlignage** : fond Sable (texte Encre brune) qui se dessine dans le sens de lecture, 300 ms.
- **CTA** : entre en dernier, une micro-réaction de 200 ms (Sable qui s'éclaircit sur nuit), reste ≥ 2 s.
- **Intro (2–3 s)** : fond Papier → tracé de la maison → wordmark → baseline.
- **Transition (0,7 s)** : le tracé porté par le packet bleu balaie l'écran ; chapitres « 01 / VERBE ».
- **Outro (3–4 s)** : titre promesse → logo animé → bouton CTA → maintien avec baitly.fr.

À faire : une idée par plan, contraste de rythme (tension rapide puis calme), maquettes fidèles,
photos en arche, sous-titres incrustés, version lisible sans animation.
À éviter : particules, glow, lens flare, glitch, robots/cerveaux/circuits pour l'IA, dégradés violet
→ bleu, plus de 3 éléments animés à la fois, whip pan, cube 3D, clignotements, urgence en rouge.

## 7. Templates de contenus sociaux

Détail complet : [`../templates-socials/templates-socials.md`](../templates-socials/templates-socials.md).

| Gabarit | Format | Usage |
|---|---|---|
| A · Reel / TikTok feature | 1080×1920, 15–30 s | Une fonctionnalité, un bénéfice |
| B · Post promesse | 1080×1080 | Promesse, annonce |
| C · Carrousel problème → solution | 1080×1350, 5–7 slides | LinkedIn, Instagram |
| D · Vidéo explication | 1920×1080, 45–120 s | YouTube, LinkedIn |
| E · Story compte à rebours | 1080×1920, 5–10 s | Pré-lancement |

Marges : 64 px ; en 9:16, 250 px en haut et 380 px en bas. Logo une seule fois. Mode Nuit par
défaut. Titre Space Grotesk 700 deux lignes max (2e ligne Sable). CTA Sable (nuit) ou Navy (jour),
URL **baitly.fr** toujours écrite.

## 8. Voix off & storytelling

**Professionnel mais chaleureux** : une collègue expérimentée de l'hôtellerie, qui rassure par la
précision. 30–45 ans, timbre posé, sourire audible, 2 à 2,4 mots/s (≈ 70 mots pour 30 s). Arabe
standard moderne avec prononciation du Golfe pour l'Arabie saoudite. Une voix de référence par langue.

**Structure** : Hook (0–3 s, une situation, une heure, une question) → Problème (3–10 s) → Solution
en bénéfice (10–20 s) → Preuve vérifiable montrée à l'écran (20–26 s) → CTA unique + URL (26–30 s).

**Prononciation** : **Baitly se prononce « Bètly »** (bèt-li), jamais « ba-ït-li ». L'adresse se dit
« bètly point F R ». **En arabe, la marque s'écrit « بيتلي »** (jamais « بايتلي »). Pour une synthèse vocale, écrire « Bètli » dans le texte envoyé à l'outil ; le
nom affiché à l'écran reste « Baitly ».

| À privilégier | À éviter |
|---|---|
| « Vous approuvez, ils exécutent. » | « L'IA gère tout pour vous. » |
| « Les disponibilités sont centralisées pour limiter les conflits. » | « Zéro double réservation garanti. » |
| « Jamais sous le plancher que vous fixez. » | « +30 % de revenus ! » (non mesuré) |
| « Un simple lien, pas d'application. » | « Une expérience seamless et disruptive. » |
| « Réservez votre démo de 30 minutes. » | « Dernière chance ! Offre limitée ! » |

**Véracité** : uniquement des faits vérifiables (10 agents, 0 % de commission Baitly sur le direct,
3 langues, 3 marchés, yield borné 55 % / 85 %, 14 jours de repos, code valable du check-in au départ,
preuve photo avant paiement). Gains chiffrés : mesurés et sourcés avant publication. Cas fictif :
« Scène illustrative ». Cas réel : accord écrit.

| Phase | CTA exact | URL |
|---|---|---|
| Pré-lancement (actuel) | « Rejoignez le pré-lancement » | baitly.fr |
| Après ouverture | « Réservez votre démo de 30 min » | baitly.fr/demo |
| Vidéos agents IA | « Voir les agents en action » | baitly.fr/demo |

## Annexes

### Fonctionnalités → bénéfices

| Module | Bénéfice |
|---|---|
| PMS & channel manager (planning multi-biens, Airbnb / Booking.com via Channex, iCal) | Une seule vérité, moins de conflits |
| Booking engine & sites (templates, widget, panier multi-séjours, relance) | Ventes directes sans commission Baitly |
| Livret d'accueil & expériences (lien, extras, activités, services) | Revenus additionnels, voyageurs autonomes |
| 10 agents IA (surveillance, propositions, validation, automatisation bornée) | Temps rendu, décisions traçables |
| Revenue & market data (6 niveaux, yield borné, données anonymisées) | Prix qui suivent le marché, jamais sous le plancher |
| Paiements & finances (PayTabs, CMI / PayZone, YouCan Pay, Stripe, factures conformes) | Encaisser comme les voyageurs paient |
| Opérations & ménage (missions auto, checklists, preuve photo, paiement conditionné) | Qualité contrôlée à distance |
| Objets connectés (Nuki, KeyNest, Minut, caméras extérieures) | Arrivées autonomes, vie privée respectée |
| Portail propriétaire (relevés, versements, e-signature, factures de commission) | Propriétaires rassurés, zéro ressaisie |
| Conformité locale (Shomoos, ZATCA, DGSN, taxe de séjour, TVA) | En règle sans y passer ses soirées |

### Liens

- Landing : https://baitly.fr · Démo : https://baitly.fr/demo (formulaire à brancher avant campagne)
- Dépôt : github.com/mazy06/clenzy (privé, nom technique hérité)
- Application PMS : [à compléter] · Démo / sandbox : [à compléter] · Réseaux : [@baitly à compléter]

### Contacts et validations

| Rôle | Valide | Contact |
|---|---|---|
| Responsable de marque | Logo, couleurs, brand book | [Nom · email] |
| Responsable marketing | Calendrier, messages, CTA | [Nom · email] |
| Copywriter / éditeur | Scripts, véracité des faits | [Nom · email] |
| Référent produit | Fidélité des maquettes UI | [Nom · email] |
| Référent arabe | Adaptation AR, conformité saoudienne | [Nom · email] |

### Notes & hypothèses

- **Couleurs** : la landing est en OKLCH (`client/src/theme/baitly-brand.css`) ; les HEX sont les
  conversions sRGB, les CMJN des conversions non calibrées.
- **Palette de création** (décision du 26 septembre 2026) : bleu nuit + Terre cuite des briques du
  planning. L'accent terracotta du PMS (`#B45733`) devient T400, un seul point d'attention par plan.
  Les autres couleurs d'interface restent confinées aux maquettes. Ardoise nuit et Bleu lune viennent
  de Baitly UI.
- **Packets du logo** : plusieurs paires existent dans le code ; figées ici à `#2563EB` / `#0D9488`
  (clair) et `#60A5FA` / `#2DD4BF` (sombre). `baitly-mark.svg` utilise `#6B8A9A` + `#14B8A6` : toléré.
- **Logo HD** : pas de fichier vectoriel « logo complet » dans le dépôt (wordmark composé en police) ;
  un export vectorisé est à produire.
- **Polices** : landing = Manrope + Space Grotesk ; PMS = Plus Jakarta Sans + Space Grotesk. Manrope
  retenue pour la communication.
- **Phase** : pré-lancement, d'où le CTA « Rejoignez le pré-lancement ». Le formulaire `/demo` n'était
  pas branché au 19 septembre 2026.
- **Handles, démo, contacts** : placeholders. **Aucun chiffre de performance** publié.
- **Nom** : Clenzy → Baitly ; les identifiants techniques « clenzy » ne doivent jamais apparaître dans une création.
