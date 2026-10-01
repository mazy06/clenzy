# Baitly · Série « Conciergeries » : pourquoi une conciergerie choisit Baitly

> **À quoi sert ce fichier.** Proposition de vidéos marketing pour les conciergeries (gestion
> déléguée de logements pour le compte de propriétaires) : inventaire des arguments, chacun adossé
> à un problème récurrent du métier et à ce que Baitly fait **réellement** dans le code, puis le
> plan de la série.
> **Comment l'utiliser.** Choisir les vidéos au §3, écrire les scripts à partir des accroches,
> relire le §4 avant chaque voix off pour ne rien promettre de faux.
> **À qui il s'adresse.** Marketing, rédaction des scripts, équipe commerciale.
> Relevé le 28 septembre 2026 dans `server/src/main/java/com/clenzy/` (cartes
> `SupervisionActionType`, `ManagementCommissionCalculator`, `CommissionInvoiceService`,
> `OwnerStatementService`, `OwnerConstellationService`, `service/assignment/`,
> `payment/payout/executor/`, `integration/pennylane/`), `mobile/src/screens/` et
> `analyse-concurrentielle/10-synthese.md`.

## 1. Ce qui change quand on parle à une conciergerie

La série 08-15 parle à un hôte qui vit un aléa sur **un** logement. Une conciergerie vit les mêmes
aléas **multipliés par trente**, avec deux choses en plus : des **propriétaires** à qui elle doit
des comptes, et une **équipe** à faire tourner. Elle vend un service : sa marge dépend de son
back-office, sa survie dépend de ses mandats.

Ses trois peurs, qui donnent les trois leviers de la série :

| Levier | La peur | Ce que la vidéo doit faire sentir |
|---|---|---|
| **Réduire les coûts** | La marge part en soirées Excel, en ménages payés pour rien, en dépenses jamais refacturées | Chaque euro est calculé, justifié, refacturé |
| **Garder ses propriétaires** | Le message du propriétaire qui « réfléchit à reprendre son appartement » | Le propriétaire voit tout ce qui est fait pour lui, avant de poser la question |
| **Grandir sans s'épuiser** | Chaque nouveau mandat veut dire une embauche de plus et un téléphone qui ne s'arrête plus | Plus de logements, sans plus d'allers-retours |

**Positionnement à tenir.** Baitly est l'outil de la conciergerie, pas un concurrent : il augmente
sa marge au lieu de prendre une commission sur les loyers. Si c'est une position assumée, la dire
(« Baitly ne gère aucun logement en propre ») : c'est un argument face aux acteurs qui vendent
à la fois le logiciel et la gestion. **À valider** avant de l'écrire dans une vidéo.

## 2. Inventaire des arguments

Chaque ligne part d'un problème qui revient **tous les mois** ou **toutes les semaines**.

### A. Garder ses propriétaires (satisfaction, rétention)

| Problème récurrent | Ce qu'il coûte | Réponse Baitly | Dans le produit | Statut |
|---|---|---|---|---|
| Le relevé mensuel fait à la main pour chaque propriétaire | Des soirées, des erreurs, la confiance | Relevé calculé depuis les reversements payés, envoyé par email avec PDF, en carte ou en automatique | `OwnerStatementService`, `OWNER_STATEMENT_SEND` | En place |
| « Où est mon virement ? » | Appels, relances, retards | Reversements calculés, approuvés d'une carte, puis fichier de virements SEPA ou versement Stripe Connect / Wise | `OWNER_PAYOUT`, `AccountingExportController` (`sepa-xml`), `payment/payout/executor/` | En place (approuver ne vire pas : voir §4) |
| Le mois en baisse, le propriétaire qui doute | Le mandat qui part | Note factuelle (mois vs même mois l'an dernier) envoyée **avant** qu'il appelle | `OWNER_REVENUE_NOTE` | En place (déjà montré dans le Reel 14) |
| « Je paie 20 % pour quoi ? » : le travail invisible | Le mandat qui part | Page propriétaire **à vos couleurs** (logo, couleur) : ce que les agents ont fait pour son bien sur 30 jours, revenus, commission, net. Baitly n'y apparaît jamais | `OwnerConstellationService`, `PublicOwnerConstellation.tsx`, branding | En place (lien en lecture seule) |
| Des travaux découverts sur le relevé | Le litige | Demande d'accord envoyée au propriétaire avec le coût estimé, avant l'intervention | `OWNER_WORKS_APPROVAL` | En place (email) |

### B. Réduire les coûts, protéger la marge

| Problème récurrent | Ce qu'il coûte | Réponse Baitly | Dans le produit | Statut |
|---|---|---|---|---|
| Commission calculée sur le brut alors que le mandat dit « net des frais OTA » | Marge perdue ou propriétaire lésé | Commission calculée par contrat, sur les frais OTA réellement prélevés ; 4 modèles d'encaissement | `ManagementCommissionCalculator`, `ManagementContract` | En place (frais réels : Booking.com et Airbnb) |
| La facture de commission oubliée quand l'OTA paie le propriétaire | Commission jamais recouvrée | Facture de commission émise à l'import de la réservation | `CommissionInvoiceService` | En place |
| Le prix du ménage négocié au cas par cas | Marge rognée, tensions avec les prestataires | Prix conseillé (minutes × taux) décomposé ligne à ligne, tarif propre à chaque prestataire | Moteur Ménage, `HousekeeperRateService` | En place |
| Le ménage bâclé payé quand même | Reprise, mauvais avis | Contrôle photo, versement débloqué par la preuve | `WORK_REVIEW`, `CLEANING_PAYOUT`, `HousekeeperPayoutController` | En place (Reel 10, vu côté hôte) |
| Le ticket de caisse perdu, la dépense jamais refacturée | Perte sèche | Dépense avec justificatif, refacturée au propriétaire sur son relevé | `ProviderExpenseController`, `ServicePayer.OWNER` | En place |
| Trois devis de plombier à comparer | Temps, surcoût | Devis comparés, le recommandé approuvé d'une carte | `QUOTE_APPROVAL` | En place |
| La panne chère faute d'entretien | Réparation, nuits perdues | Tournée préventive proposée après 11 mois | `PREVENTIVE_MAINTENANCE` | En place |
| La ressaisie pour l'expert-comptable | Honoraires | Export FEC et CSV, synchronisation Pennylane | `AccountingExportController`, `integration/pennylane/` | En place |
| Cinq abonnements empilés (logiciel, channel manager, ménage, signature, compta) | Coût et double saisie | Un seul outil | Channex, Moteur Ménage, signature interne, exports | En place (voir limites §4) |

### C. Grandir sans s'épuiser

| Problème récurrent | Ce qu'il coûte | Réponse Baitly | Dans le produit | Statut |
|---|---|---|---|---|
| Le nouveau propriétaire gagné au café, perdu dans la paperasse | Délai avant le premier revenu | Mandat envoyé en signature électronique, contrat et commission paramétrés | `MANDATE_SIGN_SEND`, `ManagementContractController` | En place (signature interne) |
| La mise en ligne sur les plateformes | Des heures par logement | Publication sur les canaux depuis une carte | `CHANNEL_PUBLISH`, Channex | En place |
| Le planning ménage tenu sur un groupe WhatsApp | Oublis, doublons | Attribution classée avec échéances, réassignation automatique si désistement | `service/assignment/`, `REASSIGN_CLEANING`, `ASSIGNMENT_RECAP` | En place |
| L'équipe terrain qui rend compte par téléphone | Coordination sans fin | App mobile : missions du jour, checklist, photos, signature, signalement d'anomalie | `mobile/src/screens/housekeeper`, `technician`, `manager` | En place |
| Tout remonte au gérant | Le goulot, c'est lui | 46 cartes préparées par les agents, automatisation réglée par type (Suggère / Notifie / Auto), l'argent jamais automatique | `SupervisionActionType`, règles de confiance | En place (Reel 15) |
| Les nuits d'astreinte (bruit, arrivées, messages) | Le sommeil | Déjà couvert par les Reels 08, 09, 12 et 15 | | À réutiliser |

### D. Conformité (argument fort en France)

Facture inaltérable et numérotation séquentielle, facture de commission, export FEC, registre de
la taxe de séjour, fiche de police transmise via Chekin. Au Maroc et en Arabie saoudite : voir le
Reel 11 (DGSN et Shomoos **anticipés**, ZATCA et NTMP en place).

### E. Sa marque, pas la nôtre

Page propriétaire en marque blanche (§A) et site de réservation directe à la marque de la
conciergerie (Studio), avec ses risques de paiement couverts (Reel 13).

### Ce qui distingue Baitly (pour les supports commerciaux)

D'après le benchmark de juillet 2026 (`analyse-concurrentielle/10-synthese.md`) :
1. **Le ménage piloté jusqu'au paiement** : prix conseillé, tarif par prestataire, versement à la
   preuve photo, anomalie transformée en devis. Chaîne non trouvée en natif chez les logiciels
   comparés.
2. **La finance de conciergerie** : commission par contrat sur le net des frais OTA, facture de
   commission, reversements sur plusieurs rails, FEC, Pennylane. Les leaders américains ne couvrent
   pas les obligations françaises.
3. **Des agents qui préparent, une équipe qui tranche**, et une automatisation que chacun règle.
4. **Trois marchés** (France, Maroc, Arabie saoudite), arabe de droite à gauche, devises locales.

En vidéo, **ne nommer aucun concurrent et ne pas écrire « le seul »** (publicité comparative
encadrée, preuve exigée). Ces points restent pour les présentations commerciales, sourcés.

## 3. Proposition : un film pilier et cinq reels

Même grammaire que la série 08-15 (un moment précis, une carte, un geste), mais à l'échelle d'un
portefeuille : 38 propriétaires, 14 départs, 6 prestataires. Chiffres de **scénario** affichés dans
l'interface, jamais de gain mesuré en voix off. Voix FR en alternance Lucie / Noé, EN Mark.

| # | Titre | Levier | L'accroche (émotion) | Ce que ça coûte (économie) | Cartes et gestes, dans l'ordre | Promesse de fin | Voix FR |
|---|---|---|---|---|---|---|---|
| 16 | « Le 1er du mois » | Coûts | « Le 1er du mois, vous ne gérez plus des logements. Vous faites de la comptabilité. » Tableur à 38 onglets, 23 h | Soirées perdues, une commission mal calculée = un propriétaire furieux | Réservations de tous les canaux déjà rapprochées → commission par contrat (net des frais OTA) → `OWNER_STATEMENT_SEND` « 38 relevés prêts » → `OWNER_PAYOUT` « Approuver » → fichier de virements prêt → export FEC | « Trente-huit relevés. Deux validations. Vos soirées vous reviennent. » | Lucie |
| 17 | « Il voulait reprendre son appartement » | Propriétaires | 22 h, message WhatsApp d'un propriétaire : il pense reprendre son bien | Sur sa fiche : la commission annuelle que ce mandat représente | `OWNER_REVENUE_NOTE` le lendemain matin → lien vers **sa** page, aux couleurs de la conciergerie : actions du mois (prix ajustés, ménages contrôlés, avis répondus), revenus, net → sa réponse : « Finalement, on continue. » | « Vos propriétaires voient enfin tout ce que vous faites. » | Noé |
| 18 | « 10 h 52 » | Coûts + qualité | 14 départs aujourd'hui, arrivée à 15 h, une prestataire annule | Le ménage négocié au téléphone, le ménage bâclé payé quand même | Mission « Annulée » → prestataires classés (distance, disponibilité) → réassignation → prix conseillé décomposé → app terrain : checklist et photos → `WORK_REVIEW` → `CLEANING_PAYOUT` « Versé » → une anomalie photographiée devient un devis | « Le bon prix, la bonne personne, payée quand le travail est fait. » | Lucie |
| 19 | « La facture du plombier » | Marge + confiance | Une fuite, trois devis, et un propriétaire qui n'a rien validé | Dépense contestée, ticket perdu, jamais refacturé | `QUOTE_APPROVAL` (devis comparés) → `OWNER_WORKS_APPROVAL` « Accord demandé, 480 € » → justificatif photographié → la ligne apparaît sur son relevé → `PREVENTIVE_MAINTENANCE` pour les logements du même immeuble | « Chaque euro dépensé est validé, justifié, refacturé. » | Noé |
| 20 | « Le 50e logement » | Grandir | « Signer un nouveau propriétaire devrait être une bonne nouvelle. Pas une nouvelle embauche. » | Chaque mandat de plus = plus de paperasse, plus d'appels | `MANDATE_SIGN_SEND` → mandat signé, modèle d'encaissement et commission choisis → `CHANNEL_PUBLISH` → le logement entre au planning (compteur 49 → 50) → les cartes se répartissent entre l'équipe → réglages d'automatisation (repris du Reel 15) | « Plus de logements. Pas plus de chaos. » | Lucie |
| P | « Le mois d'une conciergerie » (75 à 90 s, 9:16 et 4:5 pour LinkedIn) | Les trois | Le 1er (relevés), le 3 (mandat signé), le 12 (ménage annulé), le 18 (plombier), le 28 (propriétaire rassuré), le 30 (50e logement) | Montage des cinq reels | Une carte par jour du mois | « Moins de coûts. Plus de logements. Des propriétaires qui restent. » | Noé |

**Ordre de production conseillé** : 16 (la douleur la plus partagée, et notre terrain le plus
fort), 18 (le différenciateur le plus net), 17 (la plus forte charge émotionnelle), 20, 19, puis
le film pilier, monté à partir des scènes des cinq reels.

**Recouvrements assumés.** Le 17 reprend la note de revenus du Reel 14, mais l'histoire change
(le mandat en danger, la page en marque blanche) ; le 18 reprend le versement à la preuve du
Reel 10, mais à l'échelle d'une journée à 14 départs, avec le prix conseillé et la réassignation.

**Option France uniquement** : « Le contrôle » (facture inaltérable, FEC, facture de commission,
taxe de séjour), si les arguments de conformité doivent porter seuls.

## 4. À ne pas promettre

- **Migration depuis un autre logiciel** : le service de migration est un squelette (volumes
  estimés en dur). Ne pas dire « on importe tout depuis votre ancien outil ».
- **Reversements** : approuver un reversement n'exécute aucun virement ; le virement part par le
  fichier SEPA ou le rail de paiement configuré. Montrer « Approuver », puis « fichier de virements
  prêt ». Vérifier quels rails (Stripe Connect, Wise, Open Banking) sont actifs en production.
- **Accord du propriétaire pour des travaux** : c'est un email avec le coût estimé ; sa réponse
  n'est pas captée dans Baitly. Ne pas montrer le propriétaire cliquer « J'accepte ».
- **Page propriétaire** : un lien en lecture seule qui expire, pas un compte avec identifiant.
- **App terrain** : pas de notification push (non écrite). La mission apparaît dans « Missions du
  jour », sans bannière de notification.
- **Tarification** : pas de données de marché concurrentes (PriceLabs retiré). Ne pas dire
  « remplace votre outil de tarification ».
- **Prix de Baitly** : modèle (par utilisateur ou par logement) non tranché, aucun prix en vidéo.
- **Gains chiffrés** (heures gagnées, pourcentages) : rien de mesuré ; pas de chiffre de gain en
  voix off.
- **Déploiement** : plusieurs briques sont sur `main` et pas encore en production ; vérifier
  chaque écran montré avant diffusion.

## 5. Décisions à prendre avant les scripts

1. **Devise** : la série 08-15 affiche le Maroc (MAD) en français. Ici, les arguments forts sont
   français (facture inaltérable, FEC, Pennylane) : proposition, **euros** en FR comme en EN, le
   temps « FEC » remplacé par « export comptable » en anglais. Une variante Maroc (MAD, DGSN)
   reste possible ensuite.
2. **« Baitly ne gère aucun logement en propre »** : position commerciale à confirmer avant de
   l'utiliser.
3. **Nom de la conciergerie fictive** affichée sur la page en marque blanche (à vérifier
   qu'il n'existe pas).
