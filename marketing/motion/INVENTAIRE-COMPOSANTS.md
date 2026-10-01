# Inventaire des composants graphiques des Reels Baitly

> **À quoi sert ce fichier.** Recenser tout ce qu'on peut montrer dans un Reel sans rien inventer :
> les scènes et animations de la **landing**, les composants et écrans du **PMS**, et ce que le kit
> motion sait déjà dessiner. Il fixe aussi des **règles de variété** pour ne plus répéter les mêmes
> briques d'une vidéo à l'autre, et propose une répartition par Reel.
> **Comment l'utiliser.** Avant d'écrire un Reel : choisir sa scène signature (§ 5), puis 3 à 5
> composants dans le catalogue (§ 2 à § 4) en respectant les quotas (§ 5). La planche visuelle
> est dans [`inventaire/planche.png`](inventaire/planche.png) (source : `inventaire/index.html`).
> **À qui il s'adresse.** Motion designer, marketing, développeur du kit (`shared/kit.js`).

Dernière mise à jour : 27 septembre 2026. Captures faites sur la landing locale (port 3005) et sur
les Reels déjà rendus.

## 1. Constat : ce qui se répète

| Composant du kit | 01 Manifeste | 02 Une seule vérité | 04 Agents IA | 05 Départ tardif | 06 Arabie saoudite | Verdict |
|---|:-:|:-:|:-:|:-:|:-:|---|
| Titre mot à mot, sous-titres, écran de fin | ✓ | ✓ | ✓ | ✓ | ✓ | **Signature de série** : on garde. |
| Planning « 05 bis » | ✓ | ✓✓ | · | ✓ | ✓ | **Saturé** (4/5). Réserver aux sujets calendrier. |
| Carte d'agent compacte | ✓ | ✓ | ✓ | ✓ | ✓ | **Saturé** (5/5). Une seule par Reel au maximum. |
| Téléphone | · | ✓ | · | ✓ | ✓ | Fréquent (3/5). Un seul par Reel. |
| Écran verrouillé + notifications | · | ✓ | · | ✓✓✓ | · | À espacer : jamais deux Reels de suite. |
| Tap rond / curseur flèche | ✓ | · | ✓ | ✓ | ✓ | Varier avec la **main** de la landing (M09). |
| Maison qui se dessine (transition) | ✓ | ✓ | ✓ | · | · | À alterner avec d'autres transitions (§ 3). |
| Arche photo | · | · | · | · | ✓ | Libre : motif de la landing (lieux uniquement). |

Tout le reste du vocabulaire visuel de la landing et du PMS n'avait **jamais** été utilisé : c'est là
qu'il faut puiser. Matrice relevée avant les révisions du § 6 ; après révision, la carte d'agent
compacte ne reste que dans les Reels 01 et 04 (HITL), le téléphone dans 02 et 05.

## 2. Catalogue landing : scènes « démo » (captures dans `inventaire/captures/`)

Chaque scène reprend un vrai comportement du produit, avec des données fictives. Colonne
« Sujets » : les Reels ou idées (voir `ideas-video-motion-design.md`) où elle est à sa place.

| ID | Scène | Source (client/site) | Ce qu'on voit / ce qui bouge | Sujets |
|---|---|---|---|---|
| L01 | Photo d'accueil + pile d'actions d'agents | `HomePage.tsx`, `AgentActionDeck.tsx` | Photo de l'hôte au bureau ; la carte du dessus s'efface, la suivante monte. | Manifeste, agents, avant/après |
| L02 | Espace de décision | `BaitlyAgentDemo.tsx` | Fenêtre « baitly / Votre espace de décision », proposition, prix 130 → 117,5, plancher, « Approuver le tarif ». | Agents, revenue |
| L03 | Photo de lieu + ticket de réservation | `BaitlyPmsPage.tsx` (`bpm-hero-art`) | Photo en arche, ticket (initiales voyageur, statut, logo canal, mini calendrier avec séjour). | PMS, réservation, canaux |
| L04 | Planning animé (5 gestes) | `AnimatedPlanningMockup.tsx` | Filtre par canal, glisser sur une plage occupée → refus, déplacement valide, étirement → ménage replanifié, sélection de nuits libres. | PMS, départ tardif, tour produit |
| L05 | Flux de canaux → hub → registre | `BaitlyChannelFlow.tsx`, `bpm-sync-*` | 3 logos reliés au hub Baitly (convergence puis diffusion), registre « Fermé à la vente · 125 € · 3 nuits ». | Channel manager |
| L06 | Photo + carte d'arrivée | `bpm-arrival-visual` | Photo de chambre, carte flottante « Sofia Fontaine · arrivée 15 h · règlement suivi ». | Arrivée, livret, avant/après |
| L07 | Photo + piste de ménage | `bpm-cleaning-visual` | Photo du geste, carte « Ménage après départ · 2 oct. 11 h → 14 h » + barre de progression. | Ménage, départ tardif |
| L08 | Démo agents (onglets) | `BaitlyProductDemos.tsx` › `AgentsDemo` | Onglets Revenue / Séjours / Opérations / Distribution, carte de proposition, bouton plein. | Agents |
| L09 | Semaine de prix + plancher | `RevenueDemo` | Segmenté Calme / Habituelle / Soutenue, 7 barres de prix qui montent, curseur « prix plancher », « Limite respectée ». | Revenue, yield |
| L10 | Un séjour, un paiement | `FinanceDemo` | Onglets Maroc / Arabie saoudite / France, montant, logo du prestataire (PayZone, PayTabs, Stripe), « Simuler l'encaissement », frise Réservation → Paiement → Rapprochement. | Paiements, Arabie saoudite, Maroc |
| L11 | Prêt pour la prochaine arrivée | `OperationsDemo` | Photo de chambre + horaires, « Équipe ménage 0/3 », cases qui se cochent, photo de contrôle, « Valider la mission ». | Ménage, preuve photo |
| L12 | Une clé, le tempo du séjour | `DevicesDemo` | Onglets Avant / Pendant / Après, photo de porte, code d'accès à 6 chiffres, « Accès actif ». | Objets connectés, arrivée |
| L13 | Vitrine de réservation directe | `BaitlyBookingDemo.tsx` + `Storefront` | Site « Maison Zayna », étapes Chambre → Dates → Extras → Paiement → Confirmation, « −20 % en direct », panier. | Booking engine, direct |
| L14 | Offres d'upsell | `BaitlyBookingUpsells.tsx` | Cartes photo « Prendre son temps · 45 € · Ajouter au séjour », panneau Sélection + total. | Upsells, livret |
| L15 | Livret dans le téléphone | `ScrollGuideSection.tsx` | Téléphone collé au défilement : check-in en ligne, code 4821, activités (montgolfière). | Livret, arrivée |
| L16 | Simulateur de volume | `BaitlyLoyaltySimulator.tsx` | Paliers 1-4 / 5-9 / 10-19 / 20+, barres −10 % / −15 % / −20 %, curseur mois. | Tarifs, pré-lancement |
| L17 | Photo + mini fenêtre de résa | `BaitlyPricingVisual.tsx` | Photo d'intérieur, fenêtre « Votre réservation directe », dates, petit-déjeuner, « Séjour confirmé ». | Direct, tarifs |
| L18 | Migration : sources → espace | `BaitlyMigrationVisuals.tsx` | Tuiles Airbnb / Booking.com / Vos fichiers → flèche → espace « Riad des Orangers » qui se coche ligne à ligne. | Migration |
| L19 | Correspondance CSV | `BaitlyMigrationVisuals.tsx` (`bm-mapping`) | `reservations.csv` : Listing → Logement, Check-in → Date d'arrivée, Confirmation code → Référence. | Migration |
| L20 | Compte à rebours | `LaunchCountdown.tsx` | Jours · heures · minutes · secondes en grands chiffres. | Pré-lancement |
| L21 | Fiche d'un agent | `BaitlyProductPage.tsx` (`bps-agent-detail`) | Fond chaud, « Revenue · Auto ou validation », Surveille / Propose. | Agents |
| L22 | Projection « Objets connectés » | `AnimatedIotMockup.tsx` (capture `P05`) | Vrai écran PMS : capteur de bruit → serrure → verrouillage → vidéosurveillance. | Objets connectés |

Scènes présentes dans le code mais non capturées (route non publiée ou état interactif) :

| ID | Scène | Source | Ce qui bouge | Sujets |
|---|---|---|---|---|
| L23 | Pile de cartes HITL | `AnimatedHitlMockup.tsx` | Chaque carte joue son scénario (curseur), puis passe derrière la pile. | Agents |
| L24 | Conversation avec l'assistant | `AnimatedAssistantMockup.tsx` | Question tapée au clavier, appels d'outils, réponse, carte HITL validée. | Assistant IA |
| L25 | Portail propriétaire | `AnimatedOwnerMockup.tsx` | Le curseur télécharge les relevés mensuels un à un, onde + toast. | Propriétaires, conciergeries |
| L26 | Missions sur carte | `AnimatedOpsMockup.tsx` | Filtres Ménage / Maintenance / Check-in ; vue carte à 5 marqueurs. | Ménage, conciergeries |
| L27 | Jeu d'avantages | `AdvantageDeck.tsx` | La carte du dessus part sur le côté et repasse en dernier. | Manifeste, comparatif |
| L28 | Mur de logos | `PartnerMarquee.tsx` | 3 rangées qui défilent en sens alterné (canaux, paiements, activités). | Intégrations, canaux |
| L29 | Hub de navigation | `BaitlyNavPreview.tsx` | Fenêtres : canaux → hub (convergence), livret en téléphone, extras. | Manifeste, tour produit |
| L30 | Visite guidée du planning | `BaitlyPlanningCallout.tsx` | Anneau de focus sur une brique, trait de liaison, carte guidée avec progression. | PMS, tour produit |
| L31 | Calculateur de revenus | `BaitlyHomeResources.tsx`, `BaitlyResourceTools.tsx` | « 90 € × 20 nuits → 1 800 € », chiffres qui roulent. | Revenus, ressources |
| L32 | Bande photo + CTA | `HomePage.tsx` (fin de page) | Photo de villa, voile, titre « Laissez de la place à ce qui compte ». | Fin alternative |
| L33 | Étapes numérotées sur aplat | pages produit (`01 · 02 · 03`) | Trois étapes sur fond coloré (brun, vert, bleu nuit) + photo à coin arrondi. | Tous (explication en 3 temps) |

## 3. Vocabulaire de mouvement de la landing

À reprendre tel quel dans le kit (mêmes intentions, mêmes courbes ease-out).

| ID | Motif | Keyframes / source | Usage en Reel |
|---|---|---|---|
| M01 | Entrée de scène (fondu + montée) | `baitly-scene-enter`, `bps-enter`, `Reveal.tsx` | Entrée standard d'une fenêtre produit. |
| M02 | Convergence puis diffusion vers un hub | `bpm-sync-converge / deliver / receive / turn`, `bnv-sync-*` | Canaux → Baitly → canaux ; données → agent. |
| M03 | Tracé de route | `bns-route` | Parcours voyageur, trajet équipe de ménage. |
| M04 | Enregistrements qui voyagent | `bm-transfer / import / record / arrive` | Migration, import, reprise d'historique. |
| M05 | Mur de logos qui défile | `brandwall-scroll` | Écosystème, canaux (déjà en bandeau simple : passer à 3 rangées). |
| M06 | Barres qui poussent | `brs-grow` | Prix de la semaine, occupation, remises. |
| M07 | Valeur qui change | `bb-value`, `site-money-change` | Montant, prix, total qui roule. |
| M08 | Progression de paiement | `bb-payment-progress` | Encaissement, versement, rapprochement. |
| M09 | Main qui tape + onde | `bb-pointer-tap`, `bb-pointer-ripple`, `BaitlyDemoPointer.tsx` | Gestes côté voyageur / visiteur (booking, livret). |
| M10 | Urgence : anneau pulsé + tremblement | `pl-ring-wave`, `pl-wizz-wobble` (reprise de `planning/planningUrgency.css` : brique en attente d'action) | Ce qui réclame une action : brique incomplète, relances côté « Sans ». |
| M11 | Brique qui entre / pulse | `landing-planning-stay-in`, `landing-planning-pulse` | Nouvelle réservation, conflit. |
| M12 | Tiroir qui sort de la barre | `bl-flyout-in / out`, `bl-mega-*` | Ouvrir un détail, un menu, un panneau latéral. |
| M13 | Pile de cartes qui tourne | `AdvantageDeck`, `AgentActionDeck` | Série d'actions, de bénéfices. |
| M14 | Téléphone piloté par le défilement | `ScrollGuideSection` | Livret, parcours voyageur (défilement interne). |
| M15 | Compte à rebours | `LaunchCountdown` | Pré-lancement, J-x avant arrivée. |
| M16 | Anneau de focus + carte guidée | `BaitlyPlanningCallout` | Désigner une zone précise d'un écran. |

## 4. Catalogue PMS

### 4.1 Primitives (`client/src/components/baitly/` et `components/`)

| ID | Primitive | Ce qu'elle montre | Sujets |
|---|---|---|---|
| P01 | `StatTile` / `StatTileRow` | KPI + libellé + variation (tabular-nums). | Tableau de bord, revenus, tour produit |
| P02 | `RevenueByChannelCard` | Revenus par canal en barres colorées. | Canaux, revenus |
| P03 | `PayoutRecap` | Récapitulatif de versement (brut, commission, net). | Propriétaires, finances |
| P04 | `RatingStars` + `ReviewReplyDialog` | Note en étoiles, réponse à un avis. | Avis & réputation |
| P05 | `NoiseGauge` | Jauge de bruit avec seuil. | Objets connectés, fête non autorisée |
| P06 | `BatteryGauge`, `SmartLockMark` | Batterie de serrure, état verrouillé. | Objets connectés |
| P07 | `ChannelBadges` / `ChannelTag` | Pastilles de canal (Airbnb, Booking.com, direct…). | Canaux |
| P08 | `GuestAvatar` | Photo du voyageur (ou initiales). | Partout où un voyageur apparaît |
| P09 | `TeamCard` | Membre d'équipe (rôle, disponibilité). | Ménage, conciergeries |
| P10 | `ServiceRequestCard` | Demande de prestation (place de marché). | Prestataires, livret |
| P11 | `OnboardingChecklist` / `OnboardingSteps` | Liste d'étapes qui se cochent. | Démarrage, migration |
| P12 | `DateRangePicker` | Calendrier deux mois, plage sélectionnée. | Réservation directe |
| P13 | `MapWithSheet` | Carte + feuille de détail. | Quartier, missions |
| P14 | `PeriodSegmented`, `FilterChipRow` | Segmenté de période, rangée de filtres. | Rapports, planning |
| P15 | `StatusChip` | Pastille de statut (avec icône). | Partout |
| P16 | `EmptyState`, `CornerRibbon`, `HelpBanner`, `OfflineBanner` | États et bandeaux. | Rarement en vidéo |

### 4.2 Écrans (projections `B*SectionDemo` de `modules/admin/design-system/`)

Tableau de bord, Planning, Détail de réservation, Voyageurs, **Messagerie** (+ vitrine),
Interventions, Logements (+ canaux par logement), Tarification (+ yield), Rapports, Facturation,
Documents, **Portail propriétaire**, Objets connectés, Intégrations (+ place de marché),
Réglages (phrases de réglage), Notifications, **Assistant**, **Constellation d'agents**, Onboarding
(checklist, dock). Ce sont les vrais écrans avec données fictives : la landing les embarque déjà
(`ProjectionRuntime.tsx`). Jamais montrés en Reel à ce jour : Messagerie, Rapports, Portail
propriétaire, Tableau de bord, Avis.

## 5. Règles de variété

1. **Une scène signature par Reel**, jamais reprise comme scène principale ailleurs (tableau § 6).
2. **Planning** : scène principale seulement si le sujet est le calendrier ou la synchronisation.
   Ailleurs, au plus un plan de 2 s ou une vignette.
3. **Carte d'agent compacte** : une au maximum par Reel. L'alterner avec L02 (espace de décision),
   L21 (fiche d'agent), L01 / M13 (pile d'actions) ou un journal.
4. **Cadres** : alterner téléphone, fenêtre produit (en-tête « baitly · titre »), photo + carte UI en
   surimpression (L06, L07, L11, L12), UI nue plein cadre, écran d'ordinateur. Un seul téléphone par
   Reel ; pas deux Reels consécutifs ouverts sur un écran verrouillé.
5. **Mouvement** : chaque Reel emprunte au moins **deux motifs du § 3** absents du Reel précédent.
6. **Pointeur** : main (M09) côté voyageur / visiteur ; flèche côté PMS ; onde ronde sur téléphone.
7. **Transitions** : la maison qui se dessine reste la transition « logo » ; varier les autres
   (volet de tiroir M12, convergence M02, pile qui tourne M13, découpe en arche).
8. **Faits** : uniquement ceux de la landing et du code, « Scène illustrative » affichée.

## 6. Répartition par Reel (appliquée le 27 septembre 2026)

| Reel | Scène signature | Composants | État |
|---|---|---|---|
| 01 Manifeste | Bureau d'accueil (L01) + onglets du chaos | L01, bandeau de canaux, planning, maison | Inchangé : c'est l'ouverture de la série (photos voyageurs ajoutées). |
| 02 Une seule vérité | **Flux de canaux → hub → registre (L05, M02)** | écran verrouillé (nuit), conflit à deux briques (M11), planning, L05 | **Fait** : le panneau des canaux et la carte d'agent Synchronisation sont remplacés par L05 ; le canal hors ligne est signalé dans le registre. |
| 03 Avant / après | **Écran scindé Sans / Avec** | Sans : notifications en urgence (M10), appel, tableur, onglets de concurrents, tracé de route (M03). Avec : messagerie unifiée, L07, L09, L12 | **Fait** : ni planning ni carte d'agent compacte. |
| 04 Agents IA | **Carte HITL qui s'ajuste** | constellation, **liste d'agents + fiche L21** (suit les métiers cités), HITL, automatisations, journal | **Fait** : la grille de tuiles est remplacée par la liste + fiche. |
| 05 Départ tardif vendu | **Livret « Atelier »** | écran verrouillé du voyageur, livret, feuille de paiement, planning, **L07** | **Fait** : la carte « Opérations » est remplacée par la photo + piste de ménage. L'écran verrouillé final de l'hôte est **gardé** : il boucle le fil « un seul téléphone, du voyageur à l'hôte » (la chute « À votre réveil, c'est vendu »). |
| 06 Arabie saoudite | **Planning qui bascule en RTL + hégirien** | arches (istiraha, Riyad), fiche Shomoos, facture + QR, **L10** | **Fait** : téléphone de paiement → L10 (onglet السعودية, PayTabs, frise الحجز → الدفع → المطابقة) ; carte d'agent Conformité retirée. |
| 07 Tour produit 75 s (16:9) | **Fenêtres produit enchaînées** | planning + flux de canaux (L05), vitrine Maison Zayna (L13), courbe de prix + validation (L09/L02), livret + offres (L15, L14, main M09), chaîne départ → paiement (L11), moyens de paiement + relevé propriétaire (L10, L25), planning trilingue (miroir RTL) | **Fait** : transition = tracé de la maison qui balaie l'écran. |
| 16 Votre savoir-faire | **Fiche « Mon profil prestataire » qui se remplit** | métiers en pastilles sur photo (un par mot), fenêtre « Réseau prestataires » à onglets hôtes / voyageurs, fiche profil (typeText, progressTrack), mission fictive surlignée ligne à ligne, titres de plan | **Fait** (29/09, FR) : pas de planning, pas de carte d'agent, pas de téléphone. |
| 17 La mission, côté prestataire | **Téléphone du prestataire** (écran verrouillé → fiche de mission → checklist + photos → tampon « Validée ») | pastilles horaires, carte d'appel qui reprend l'élément dit, carte « Côté hôte » + progressTrack, stamp | **Fait** (29/09, FR) : seul téléphone de la série prestataires. |
| 18 Six familles de métiers | **Cartes photo des familles, puis mosaïque** | photoFrame + titre mot à mot, cartes photo + exemples, mosaïque 2 × 3 cerclée hôtes / voyageurs | **Fait** (29/09, FR). |
| Idées suivantes | Migration (L18, L19, M04), pré-lancement (L20, L16), avis (P04), bruit (P05), propriétaires (P03, L25) | | |

## 7. Kit : composants livrés et à venir

Livrés dans `shared/kit.js` (usage : README de `motion/`) : `productWindow`, `photoFrame`,
`progressTrack`, `barWeek`, `accessPass`, `inboxRow` + `bubble`, `urgency` (M10), `handTap` (M09).
Écrits directement dans leur Reel, à promouvoir dans le kit à la prochaine réutilisation :
flux de canaux (Reel 02), liste + fiche d'agent (Reel 04), fenêtre de paiement avec frise (Reel 06),
tracé de route (Reel 03).

À créer pour le Reel 07 et les idées suivantes : `statTiles` (P01), `checklist` (L11, P11),
`storefront` (L13), `transfer` (M04), `logoWall` 3 rangées (M05), `cardDeck` (M13),
`countdown` (M15), `spotlight` (M16).

**Série 08-15 (28 septembre 2026)** — ajoutés au kit, repris des vrais composants du produit :
`hitlCard` (carte HITL de la projection Constellation : badges agent / type / statut, actions,
passage « En attente » → « Fait »), `noiseGauge` (P05, NoiseGauge), `stars` (P04, RatingStars),
`chatScreen` / `bubbleIn` / `dotsAt` (fil de messages type WhatsApp), `typeText`, `stamp` / `stampIn`,
`roll` (M07), `slot` / `slotVis` (plans calés sur la voix). Écrits dans leur Reel : modale de
réponse d'avis (09), grille de photos de contrôle (10), fiche de police du livret + fenêtre à
onglets pays (11), page publique d'avenant (12), vitrine directe + score de risque + pièces du
litige (13), tuiles KPI + espace propriétaire (14), pile de cartes + cadran de thermostat (15).
**La carte HITL est désormais le motif récurrent de la série** : varier ce qu'elle contient et ce
qui l'entoure (téléphone, planning, photo, tampon), jamais deux fois la même mise en scène.
