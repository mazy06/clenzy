# Baitly · Les aléas de la location courte durée, et ce que Baitly en fait

> **À quoi sert ce fichier.** Inventaire des problèmes récurrents des hôtes et conciergeries, avec,
> pour chacun, le service Baitly qui y répond **tel qu'il existe dans le code** (carte à valider,
> automatisation, objet connecté). Sert à choisir les sujets des prochains reels et à ne jamais
> promettre ce que le produit ne fait pas.
> **Comment l'utiliser.** Partir d'un aléa (colonne 1), vérifier le statut, puis écrire le reel
> autour du moment où la carte arrive et où l'hôte tranche.
> **À qui il s'adresse.** Marketing, rédaction des scripts vidéo, équipe produit.
> Relevé le 28 septembre 2026 dans `server/src/main/java/com/clenzy/service/agent/supervision/`
> (46 types de cartes dans `SupervisionActionType`), `model/AutomationAction`, `integration/`.

## Principe à répéter dans chaque reel

Les agents **détectent et préparent**, l'hôte **tranche** : une carte arrive avec le contexte et
un bouton « Appliquer ». Tout ce qui touche à l'argent ou engage le voyageur ne part **jamais**
seul (règle du produit). Les tâches sans risque peuvent passer en automatique, dans les limites
fixées par l'hôte. Les reels 01 et 04 n'ont montré qu'une carte (baisse de prix) : il y en a 46.

## 1. Nuisances et sécurité du logement (objets connectés)

| Aléa vécu par l'hôte | Réponse Baitly | Dans le produit | Statut |
|---|---|---|---|
| Fête, tapage nocturne, voisins et syndic qui appellent, risque d'amende ou de suspension d'annonce | Capteur de décibels : alerte en temps réel, avertissement au voyageur, puis blocage du calendrier si ça recommence | Minut (webhook temps réel) et Tuya (relevé périodique) ; carte `NOISE_WARNING_SEND` (WhatsApp, repli email, 1 avertissement par séjour et par 24 h) ; escalade `CALENDAR_BLOCK` | En place |
| Départ de feu, fumée | Détecteur de fumée : alerte immédiate aux gestionnaires | Capteurs d'environnement Tuya (`SMOKE`) | En place |
| Logement vide où quelqu'un entre, fenêtre restée ouverte | Détecteurs de mouvement et d'ouverture | Capteurs `MOTION`, `CONTACT` | En place |
| Humidité, moisissure, logement glacial ou surchauffé | Température et humidité suivies ; thermostat pilotable entre deux séjours | Capteurs `TEMP_HUMIDITY`, thermostats (Tuya, Netatmo) | En place |
| Clés perdues, remise des clés à heure fixe, ancien voyageur qui garde le code | Code d'accès par séjour, révoqué automatiquement après le départ | Serrures Nuki, boîtes KeyNest ; `REVOKE_ACCESS_CODE` (auto) | En place |
| Serrure à plat, voyageur bloqué dehors | Batterie faible détectée, remplacement planifié avant la panne | Carte `LOCK_BATTERY_REPLACE` | En place |

## 2. Calendrier et canaux

| Aléa | Réponse Baitly | Dans le produit |
|---|---|---|
| Double réservation | Un seul calendrier ; si deux séjours se chevauchent quand même, la carte propose lequel garder | `OVERBOOKING_RESOLVE` |
| Calendrier d'un canal qui ne se met plus à jour | Flux en échec signalé, relance en un clic | `ICAL_RETRY` |
| Prix différents d'un canal à l'autre | Écart de parité détecté, tarifs republiés | `NOTIFY_RATE_PARITY`, `PARITY_REPUBLISH` |
| Logement connecté mais jamais publié | Carte « Publier » | `CHANNEL_PUBLISH` |
| Voyageur qui ne vient pas | Séjour marqué no-show, nuits restantes remises en vente | `NOSHOW_MARK` |
| Nuits isolées invendables | Remise sur le creux et séjour minimum abaissé ; séjour minimum le week-end quand ça se remplit | `OrphanGapEngine`, `MIN_STAY_RESTRICTION` |
| Deux promotions qui se mangent entre elles | Carte « Désactiver » | `PROMO_DEACTIVATE` |

## 3. Voyageurs et messages

| Aléa | Réponse Baitly | Dans le produit |
|---|---|---|
| Les mêmes questions, jour et nuit (wifi, code, horaires) | Messagerie unifiée, réponses tirées du livret | Messagerie + livret d'accueil |
| Voyageur qui écrit cinq fois en dix minutes sans réponse | Conversation « chaude » détectée, reprise en main | `CONVERSATION_TAKEOVER` |
| Arrivée demain, aucune instruction envoyée | Carte « Envoyer le livret » | `GUIDE_SEND` |
| Email du voyageur manquant, message non délivré | Cartes d'alerte avant l'arrivée | Scanners `GuestEmailMissing`, `GuestMessageFailed` |
| « Je peux partir plus tard ? » | Demande détectée dans le message ; la carte n'existe que si le calendrier le permet | `LATE_CHECKOUT_APPROVAL` |
| « On peut rester deux nuits de plus ? » | Avenant chiffré envoyé, appliqué seulement à l'accord du voyageur | `STAY_MODIFICATION` |
| Revenus d'appoint laissés sur la table | Offre d'arrivée anticipée ou de départ tardif quand le calendrier le permet ; extras du livret | `UPSELL_OFFER`, livret (départ tardif, chef, activités) |
| Panne de clim ou d'eau chaude pendant le séjour | Geste commercial proposé **avant** que l'avis tombe | `GOODWILL_REFUND` |
| Logement inhabitable (dégât des eaux) | Relogement proposé vers un logement libre, avec accord du voyageur | `RELODGE_TRANSFER` |

## 4. Avis et réputation

| Aléa | Réponse Baitly | Dans le produit |
|---|---|---|
| Avis 1 ou 2 étoiles laissé sans réponse | Carte « Avis négatif à modérer » | `ReviewModerationScanner` |
| Répondre à un avis sans s'énerver, dans la langue du voyageur | Brouillon rédigé par l'IA, **jamais publié seul** : l'hôte relit, corrige, publie | `REVIEW_DRAFT_REPLY` |
| Pas assez d'avis | Demande d'avis envoyée le lendemain du départ | `REVIEW_REQUEST_SEND` |

## 5. Argent et risques

| Aléa | Réponse Baitly | Dans le produit |
|---|---|---|
| Caution à libérer, à rembourser après une annulation | Cartes « Libérer », « Rembourser » (empreinte bancaire annulée, aucun débit) | `DEPOSIT_RELEASE`, `DEPOSIT_REFUND` |
| Dégât constaté au départ | Retenue partielle proposée, bornée par la caution, montant recalculé | `DEPOSIT_WITHHOLD` |
| Paiement du solde en échec | Nouveau lien de paiement envoyé | `PAYMENT_REMINDER` |
| Réservation frauduleuse | Score de risque au paiement, carte « Bloquer » | `BookingFraudScoringService`, `FRAUD_BLOCK` |
| Litige bancaire (rétrofacturation) | Dossier de preuves assemblé et déposé à Stripe | `CHARGEBACK_SUBMIT` |
| Panier abandonné sur le site direct | Relance en trois temps | `CART_RECOVERY_SEND` |

## 6. Ménage et maintenance

| Aléa | Réponse Baitly | Dans le produit |
|---|---|---|
| Ménage oublié pour le départ de demain | Carte « Planifier » | `CLEANING_REQUEST` |
| Prestataire qui se désiste | Réassignation automatique, sinon choix manuel | `REASSIGN_CLEANING`, `REASSIGN_MANUAL`, `ASSIGNMENT_RECAP` |
| Ménage bâclé, payé quand même | Contrôle du travail rendu (photos, durée) avant le solde ; versement débloqué par la preuve photo | `WORK_REVIEW`, `CLEANING_PAYOUT` |
| Plus de draps ni de consommables | Commande envoyée au fournisseur sous le seuil | `LINEN_STOCK_ORDER` |
| Trois devis de plombier à comparer | Devis comparés, le recommandé approuvé | `QUOTE_APPROVAL` |
| La panne qui arrive faute d'entretien | Tournée préventive proposée après 11 mois sans entretien | `PREVENTIVE_MAINTENANCE` |

## 7. Propriétaires (conciergeries)

| Aléa | Réponse Baitly | Dans le produit |
|---|---|---|
| « Où en sont mes revenus ? » | Relevé mensuel envoyé, reversement à approuver | `OWNER_STATEMENT_SEND`, `OWNER_PAYOUT` |
| Mois en baisse, propriétaire inquiet | Note factuelle envoyée **avant** qu'il pose la question | `OWNER_REVENUE_NOTE` |
| Travaux à la charge du propriétaire | Demande d'accord avec coût estimé | `OWNER_WORKS_APPROVAL` |
| Mandat de gestion non signé | Envoi en signature électronique | `MANDATE_SIGN_SEND` |

## 8. Conformité (selon le pays)

| Aléa | Réponse Baitly | Dans le produit | Statut |
|---|---|---|---|
| Fiches de police des voyageurs | Fiches complétées, télédéclaration proposée | `POLICE_DECLARE` (DGSN Maroc, fiche FR) | En place |
| Enregistrement Shomoos (Arabie saoudite) | Voyageurs enregistrés sur Shomoos, même geste que la fiche DGSN | Stratégie Shomoos (panneau de transmission déjà dans le produit) | **Anticipé** (décision du 28/09) : l'API est réservée aux établissements licenciés, le branchement doit être livré avant la diffusion. Déjà montré dans le Reel 06 |
| Taxe de séjour | Calcul par réservation, registre des déclarations | `TouristTaxService`, `TAX_MARK_FILED` | En place |
| Facture électronique ZATCA (Arabie saoudite) | Chaîne de factures conforme | `ZatcaChainService` | En place |
| Licence NTMP (Arabie saoudite) | Connexion à la passerelle | `NtmpConnectionService` | En place |
| Demande d'effacement RGPD | Effacement sélectif, factures et fiches conservées | `GDPR_ERASE` | En place |

## 9. À ne pas promettre dans une vidéo

- **Caméras** : le composant de flux vidéo est un test, la captation passera par API.
- **SMS** : pas d'envoi SMS (WhatsApp via Meta, repli email).
- **Notifications push mobile** : pas encore écrites.

Shomoos n'est plus dans cette liste : promesse anticipée (décision du 28 septembre 2026), montrée
avec la fiche de police du Maroc dans le reel G et déjà dans le Reel 06. Condition : le branchement
doit être en production avant la diffusion.

## 10. Sélection retenue et plan de la série (décision du 28 septembre 2026)

Sujets retenus par l'utilisateur, plus les cartes à forte charge émotionnelle (départ tardif lu
dans un message, litige bancaire, note de revenus au propriétaire). Numérotation = ordre de
production conseillé (impact d'abord). Voix FR en alternance, à la suite des Reels 01-07 ;
EN Mark ; AR après relecture des traductions. Devises selon la langue (FR Maroc/MAD, EN et AR
Arabie saoudite/SAR), sauf le Reel 12 qui montre les trois pays dans toutes les langues.

**Fusions validées le 28 septembre 2026** (une vidéo = une histoire continue) : panne + avis,
caution + ménage, panier + fraude + litige ; le bruit reste seul ; le thermostat rejoint la
compilation. Série finale, dossiers `reel-08-…` à `reel-15-…` :

| Reel | Titre | Histoire | Cartes, dans l'ordre | Composants réels repris | Voix FR |
|---|---|---|---|---|---|
| 08 | « 23 h 40 » | La fête, les voisins, la récidive | Jauge de bruit → `NOISE_WARNING_SEND` (WhatsApp) → le calme revient → récidive → `CALENDAR_BLOCK` | `NoiseGauge`, carte HITL (`AnimatedHitlMockup`), téléphone + fil WhatsApp, planning « Bloqué » | Lucie |
| 09 | « La clim en panne » | Incident pendant le séjour, puis l'avis | Message du voyageur → intervention → `GOODWILL_REFUND` avant l'avis → avis → `REVIEW_DRAFT_REPLY` (Insérer → un mot corrigé → Publier) | Carte HITL, `ServiceRequestCard`, `RatingStars`, `ReviewReplyDialog` | Noé |
| 10 | « Après le départ » | Le jour du départ, les photos du ménage | `WORK_REVIEW` → dégât sur une photo → `DEPOSIT_WITHHOLD` (plafonné) → `CLEANING_PAYOUT` → `LINEN_STOCK_ORDER` | Carte HITL, grille de photos, `PayoutRecap`, piste de ménage | Lucie |
| 11 | « Les fiches de police » | Une obligation par pays | Fiche remplie depuis le livret → Maroc (DGSN), France (Chekin), Arabie saoudite (Shomoos) → « Déclaré » ; taxe de séjour, ZATCA, NTMP, RGPD | Onglets pays (L10), formulaire, tampon, carte HITL `POLICE_DECLARE` | Noé |
| 12 | « Deux nuits de plus » | Le voyageur qui veut rester | Message lu → `STAY_MODIFICATION` chiffrée → accord du voyageur → planning, ménage et code qui suivent | Fil de messages, carte HITL, téléphone voyageur, planning | Lucie |
| 13 | « Le direct, sans les risques » | Les risques de paiement du site direct | `CART_RECOVERY_SEND` (1 h, 24 h, 72 h) → `FRAUD_BLOCK` → `CHARGEBACK_SUBMIT` | Vitrine directe (L13), carte HITL, pile de preuves | Noé |
| 14 | « Le propriétaire inquiet » | Le mois en baisse | KPI en recul → `OWNER_REVENUE_NOTE` → relevé mensuel → `OWNER_PAYOUT` | `StatTile`, carte HITL, portail propriétaire (L25), `PayoutRecap` | Lucie |
| 15 | « Les cartes de la journée » | Une journée d'hôte apaisée | Six cartes validées + thermostat réglé à distance, puis l'automatisation : règle de confiance (« Activer »), ménage → Auto, caution → Agir puis notifier, remboursements toujours validés | Pile de cartes HITL (L23), cadran de thermostat, réglages d'autonomie (Suggère / Notifie / Auto) | Noé |

**Limites à respecter dans les scripts** (vérifiées dans le code) :
- Reel 15 : le thermostat se lit et se règle à distance, mais **aucun préchauffage automatique
  avant l'arrivée** et **aucune alerte d'humidité** n'existent (l'humidité est mesurée, pas
  surveillée). Montrer l'hôte qui règle, pas une automatisation.
- Reel 11 : la fiche de police se remplit réellement depuis le livret et le check-in en ligne ;
  la transmission est RÉELLE en France (via Chekin), **ANTICIPÉE au Maroc (DGSN) et en Arabie
  saoudite (Shomoos)** : ces deux téléservices n'ont pas d'API publique et demandent un
  partenariat officiel (stratégies « stub honnête » dans le code). À livrer avant diffusion.
- Reel 13 : le score de fraude est désactivé par défaut (`clenzy.booking.fraud-scoring.enabled`),
  la relance automatique des paniers aussi : les activer avant diffusion, ou montrer la carte HITL
  (l'agent propose, l'hôte valide), ce que fait la vidéo.
- Tout ce qui touche à l'argent (caution, geste, litige, versement) reste une carte validée par
  l'hôte, jamais une action automatique : c'est le message.

## 11. Pistes de reels (un aléa, une carte, un geste)

| # | Titre de travail | L'aléa | Les cartes montrées | Composants à réutiliser |
|---|---|---|---|---|
| A | « 23 h 40 » | Fête dans l'appartement | Pic de décibels → avertissement WhatsApp → blocage du calendrier | Téléphone, courbe de décibels (M10 urgence), carte |
| B | « L'avis 1 étoile » | Avis négatif | Carte modération → brouillon IA → l'hôte corrige un mot → publié | Fiche avis, frappe au clavier, carte |
| C | « La clim en panne » | Incident pendant le séjour | Intervention → geste commercial → avis 5 étoiles | Planning, carte, photo voyageur |
| D | « Le ménage qui ne vient pas » | Désistement | Réassignation → contrôle photo → versement débloqué | Piste ménage (L07), photos, carte |
| E | « Le litige » | Rétrofacturation | Dossier de preuves assemblé en un clic | Documents qui s'empilent, carte |
| F | « Le propriétaire inquiet » | Mois en baisse | Note de revenus envoyée avant l'appel | Relevé (reel 07), graphique, email |
| G | « Les fiches de police » | Obligation légale d'enregistrer chaque voyageur | Même geste, deux pays : fiche DGSN au Maroc → télédéclarée ; fiche Shomoos en Arabie saoudite → transmise | Écran scindé Marrakech / Riyad (comme le Reel 03), formulaire, tampon « Déclaré » |
| H | « Les cartes de la journée » | Le quotidien | Six cartes différentes validées en 30 s (bruit, avis, caution, ménage, départ tardif, relevé) | File de cartes, pouce |
