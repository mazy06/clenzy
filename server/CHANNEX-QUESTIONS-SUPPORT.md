# Channex — questions ouvertes pour le support et le commercial

> English version: [CHANNEX-QUESTIONS-SUPPORT.en.md](CHANNEX-QUESTIONS-SUPPORT.en.md).
> C'est celle qu'on envoie à Channex ; celle-ci est la référence interne.
>
> Le formulaire PDF se regénère avec
> `python3 server/generate_channex_questions_pdf.py --out ~/Desktop`
> ([generate_channex_questions_pdf.py](generate_channex_questions_pdf.py)).
>
> **Ces trois fichiers portent le même contenu.** Toute modification doit être
> portée dans les trois — sans quoi le PDF envoyé finira par contredire nos
> propres documents.

> Établi le 2026-08-07, à partir d'un audit de notre implémentation confrontée à
> la documentation publique (`docs.channex.io`).
>
> **Chaque question ci-dessous naît d'un point que la documentation ne tranche
> pas.** Aucune n'est une demande d'explication générale : ce sont des zones
> d'ombre qui nous ont fait, ou nous feraient, prendre une décision technique à
> l'aveugle. La source de l'ambiguïté est citée à chaque fois.
>
> Priorités : **P0** bloque un chantier en cours · **P1** conditionne un choix
> d'architecture · **P2** informatif, à confirmer sans urgence.

---

## 1. Cloisonnement multi-organisations (groups)

Contexte : nous sommes un PMS multi-tenant sur **une seule clé API** Channex.
`GET /properties` renvoie donc le compte entier, toutes nos organisations
clientes confondues. Nous avons construit l'isolation sur les **groups** — un
group par organisation, filtrage de la découverte sur le contenu des groups.

| # | Prio | Question |
|---|---|---|
| 1.1 | **P0** | Le **widget iframe de connexion de canal** respecte-t-il les frontières de group ? Quand notre utilisateur ouvre l'assistant sur une propriété du group A, peut-il voir ou mapper des propriétés du group B ? *Notre isolation côté API serait sans valeur si l'iframe expose tout le compte.* |
| 1.2 | **P0** | Existe-t-il une **clé API par group** (ou un jeton restreint à un group) ? Ce serait une isolation bien plus solide que notre filtrage applicatif, qui reste défensif. |
| 1.3 | P1 | Une propriété créée avec `group_id` rejoint-elle **aussi** un group par défaut du compte ? Nous détachons systématiquement des autres groups par précaution — est-ce nécessaire ? |
| 1.4 | P1 | Y a-t-il une **limite au nombre de groups** par compte ? Nous en créons un par organisation cliente. |
| 1.5 | P2 | Les **Group Users** peuvent-ils servir à donner à un de nos clients un accès dashboard restreint à son seul group, sans voir les autres ? |

## 2. Limites de débit

Source de l'ambiguïté : `api-v.1-documentation/rate-limits` dit littéralement
« The limit is 20 ARI total per minute **total** and broken down into 2
endpoints : 10 Restrictions & Price Requests **per minute per property**, 10
Availability Requests **per minute per property** ». Le mot « total » et la
mention « per property » se contredisent.

| # | Prio | Question |
|---|---|---|
| 2.1 | **P0** | Les 20 ARI/minute sont-ils **par propriété** ou **par compte** ? Nous avons dimensionné notre agrégateur sur l'hypothèse « par propriété » (2+2 appels/min/propriété). Si la limite est par compte, notre architecture ne tient pas au-delà de ~5 propriétés actives. |
| 2.2 | **P0** | S'il existe un plafond **au niveau du compte**, quelle est sa valeur, et évolue-t-il avec le nombre de propriétés sous contrat ? |
| 2.3 | P1 | Les endpoints **hors ARI** (properties, channels, bookings, groups) ont-ils une limite ? Elle n'est documentée nulle part. Nos écrans d'administration enchaînent plusieurs `GET /groups/:id` et `GET /channels`. |
| 2.4 | P1 | Renvoyez-vous un en-tête **`Retry-After`** sur un 429 ? La doc n'en mentionne aucun ; nous appliquons donc une pause fixe d'une minute, comme recommandé. |
| 2.5 | P2 | Y a-t-il un **maximum d'entrées** par appel `POST /availability` ou `POST /restrictions` ? La doc n'en cite aucun. Nous découpons à 5000 entrées, par prudence et non par contrainte connue. |

## 3. Taxes et taxe de séjour

Contexte : marché **Maroc et France**, où la taxe de séjour communale est une
obligation. Notre modèle interne la couvre ; nous voulons savoir si Channex peut
la porter jusqu'aux plateformes.

| # | Prio | Question |
|---|---|---|
| 3.1 | **P0** | Les `taxes` / `tax_sets` sont-ils **effectivement transmis aux OTA** (Airbnb, Booking.com, Vrbo, Expedia), ou servent-ils uniquement à l'affichage et au reporting dans Channex ? *Ni la page Taxes ni la page Channel API ne le disent.* **Sans réponse positive, nous n'investissons pas.** |
| 3.2 | **P0** | Si oui : **quels canaux** consomment réellement les taxes, et sous quelle forme (incluse dans le prix, ajoutée, affichée à part) ? |
| 3.3 | **P0** | Comment exprimer une **exonération par âge** (« gratuit pour les moins de 18 ans ») ? Airbnb et Booking.com connaissent ce concept ; le modèle de taxe Channex ne semble pas l'exposer. *C'est notre unique vrai blocage : sans lui, une taxe transmise serait surestimée dès qu'un séjour comporte des enfants, et nous préférons ne rien transmettre que transmettre un montant faux.* |
| 3.4 | P1 | Comment exprimer un **plafond par personne et par nuit** (montant maximum au-delà duquel la taxe ne progresse plus) ? Fréquent dans les barèmes communaux français. |
| 3.5 | P1 | `applicable_date_ranges` est limité à **20 plages**. Est-ce suffisant pour un barème saisonnier pluriannuel, ou faut-il recréer la taxe chaque année ? |
| 3.6 | P2 | Le `level` d'un tax set gouverne-t-il bien la **taxation en cascade** (une surcharge départementale calculée sur la taxe communale, et non sur le prix nu) ? |

## 4. Contenu poussé vers les plateformes

| # | Prio | Question |
|---|---|---|
| 4.1 | P1 | **Quels canaux consomment quoi** — `description`, `photos`, `facilities`, `hotel_policies` ? La page Channel API se borne à « chaque mapping de canal est différent ». Nous voudrions savoir quel contenu produit un effet réel avant de construire les correspondances. |
| 4.2 | P1 | Le catalogue de **facilities est en lecture seule** (181 entrées) et vous invitez à vous contacter pour un ajout. Quel est le **délai** d'une demande d'ajout, et acceptez-vous des équipements spécifiques à la location saisonnière au Maroc (hammam, terrasse-riad, patio) ? |
| 4.3 | P1 | Les **hotel policies** sont-elles **exigées** par un canal en particulier (complétude du contenu Booking.com, prérequis Google Vacation Rental) ? `POST /hotel_policies` impose stationnement, accès internet, animaux et tabac — champs qu'un PMS de location courte durée ne détient pas toujours. Peut-on créer une policy partielle ? |
| 4.4 | P2 | La politique d'annulation se porte-t-elle bien sur le **rate plan** et les booking settings, et non sur la hotel policy ? Notre lecture de la doc le suggère, nous voulons le confirmer. |

## 5. Webhooks

| # | Prio | Question |
|---|---|---|
| 5.1 | **P0** | Vos webhooks n'embarquent **aucune signature HMAC**. Le secret partagé en en-tête custom est-il votre recommandation officielle, ou existe-t-il un mécanisme de signature non documenté ? Une **plage d'adresses IP** à autoriser en liste blanche ? *Nous recevons par ce canal des réservations qui déclenchent des effets financiers.* |
| 5.2 | P1 | Une signature cryptographique est-elle à votre feuille de route ? À quelle échéance ? |
| 5.3 | P1 | Que se passe-t-il si nous **n'acquittons jamais** une réservation ? `non_acked_booking` se déclenche après 30 minutes — ensuite ? Y a-t-il une conséquence côté canal (annulation automatique, alerte à l'hôte) ? |
| 5.4 | P2 | Quelle est votre **politique de réémission** en cas d'échec de notre endpoint (nombre de tentatives, espacement, abandon) ? |

## 6. Connexion des canaux et compte whitelabel

Contexte : sur un compte standard, nous ne pouvons pas créer un canal par API et
passons par votre widget iframe. Nous avons dû inventer une propriété « pivot »
comme point d'ancrage de l'OAuth.

| # | Prio | Question |
|---|---|---|
| 6.1 | **P0** | Le contournement par **propriété pivot** — créer une propriété technique pour porter l'authentification OTA au niveau du compte — est-il le motif que vous recommandez, ou existe-t-il un endpoint prévu pour cela ? *Nous préférerions ne pas dépendre d'un contournement.* |
| 6.2 | **P0** | Que débloque exactement le **statut whitelabel** ? Nous avons identifié : création de canal par API, mapping d'une annonce sur une chambre, enregistrement de webhook par propriété. La liste est-elle complète ? **Conditions commerciales et tarif ?** |
| 6.3 | P1 | Un compte standard peut-il, à terme, **créer un canal par API** sans passer au whitelabel ? |
| 6.4 | P2 | Le widget iframe peut-il être **pré-rempli au-delà du filtre par OTA** (identifiants, sélection d'annonce) pour raccourcir le parcours de nos hôtes ? |

## 7. Application de paiement

| # | Prio | Question |
|---|---|---|
| 7.1 | **P0** | L'**API Payment Application** est-elle disponible sur un compte **standard**, ou réservée au whitelabel ? |
| 7.2 | **P0** | Fonctionne-t-elle avec des comptes Stripe **marocains** ? *Stripe n'opère pas au Maroc ; c'est déterminant pour notre marché principal.* Si non, prévoyez-vous d'autres fournisseurs (CMI, PayZone, ou un acquéreur local) ? |
| 7.3 | P1 | Quel est le **modèle de frais** : commission Channex par transaction, abonnement, ou uniquement les frais Stripe ? |
| 7.4 | P1 | Couvre-t-elle la **pré-autorisation / caution** (empreinte de carte sans débit, capture différée, libération) ? |
| 7.5 | P2 | Comment s'articule-t-elle avec la **tokenisation Stripe** déjà exposée sur les réservations ? Sont-ce deux chemins concurrents ou complémentaires ? |

## 8. Marché marocain

| # | Prio | Question |
|---|---|---|
| 8.1 | **P0** | Quels **canaux sont ouverts** à des logements situés au Maroc ? Airbnb, Booking.com, Expedia, Vrbo — y a-t-il des restrictions par pays ? |
| 8.2 | P1 | Le **MAD** est-il pris en charge comme devise de propriété et de rate plan sur l'ensemble des canaux ? |
| 8.3 | P1 | Existe-t-il des **exigences de contenu propres au Maroc** (classement, licence, numéro d'établissement) que les canaux imposent et que nous devrions collecter ? |

## 9. Limites de dimensionnement

| # | Prio | Question |
|---|---|---|
| 9.1 | P1 | Y a-t-il une **limite au nombre de propriétés** par compte ? La doc plafonne les room types (50) et rate plans (10 par room type) en location saisonnière, mais reste muette sur le compte. |
| 9.2 | P2 | Vous indiquez pouvoir **relever ces plafonds au cas par cas**. Quelle est la procédure, et le délai ? |

---

## Questions commerciales

| # | Question |
|---|---|
| C.1 | **Modèle tarifaire** : par propriété, par canal connecté, par réservation, ou forfait ? Grille exacte pour un parc de 10, 100 et 1000 logements. |
| C.2 | Une propriété **sans canal actif** (créée mais pas encore distribuée) est-elle facturée ? *Notre parcours en crée à l'avance ; l'exposition financière dépend de la réponse.* |
| C.3 | Le type `property_type: "apartment"` conditionne-t-il bien le **barème Vacation Rental** plutôt qu'hôtelier ? |
| C.4 | Les **propriétés pivots** techniques, et les propriétés orphelines que nous purgeons, entrent-elles dans le décompte facturé ? |
| C.5 | **Environnement de test** : le sandbox est-il gratuit et sans limite de durée ? Reflète-t-il le comportement réel des canaux, ou seulement l'API ? |
| C.6 | Quel est l'**engagement de service** (disponibilité, délai de réponse au support, canal d'escalade en incident de production) ? |
| C.7 | Où sont **hébergées les données** ? Question RGPD : sous-traitant au sens de l'article 28, DPA disponible, transferts hors UE ? |
| C.8 | Quel **préavis** en cas d'évolution incompatible de l'API ? Versionnez-vous, ou modifiez-vous v1 en place ? |

---

## Ce qui n'a pas besoin d'être demandé

Vérifié dans la documentation, sans ambiguïté — noté ici pour éviter de faire
perdre du temps à l'interlocuteur :

- Format ARI `date_from`/`date_to`, champs requis et optionnels.
- Catalogue des 25 types d'événements webhook.
- Contrainte « une propriété appartient à au moins un group », d'où l'ordre
  rattacher-puis-détacher.
- Absence de filtre `group_id` sur `GET /properties` (filtres : `id`, `title`,
  `is_active`) — d'où l'interrogation du group plutôt que des propriétés.
- Format `event_mask` en chaîne à points-virgules.
