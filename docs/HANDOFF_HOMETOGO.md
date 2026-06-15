# HANDOFF — Intégration OTA HomeToGo (analyse offre + plan de rapprochement)

> Statut : **anticipation / pré-partenariat**. Aucun code de production ajouté. Ce document
> prépare la décision et la prise de contact. Rédigé le 2026-06-05.
> Contacts HomeToGo : `partner@hometogo.com` (partenariats) · `partnersupport@hometogo.com` (support intégration).

---

## 1. TL;DR (pour décideur pressé)

- **HomeToGo n'est PAS une OTA classique** : c'est un **métamoteur + marketplace** de location courte durée,
  doublé d'un bras B2B (**HomeToGo_PRO**). Il agrège l'offre de PMS / channel managers et renvoie /
  capture des réservations. Il **possède aussi un PMS** (Smoobu) et **Interhome** → relation de *coopétition*.
- **Pas de sandbox public, pas de portail développeur, pas d'OpenAPI public.** La connectivité supply est
  **gated** : accord partenaire → « Connection Manager » → certification → supplier/listing IDs. Le « test »,
  c'est leur étape de certification, pas un self-service.
- **Le modèle réel = API two-way** (push contenu/tarifs/règles/dispos sur 18 mois + réception des réservations
  et données guest en temps réel, **avec transmission de la carte bancaire du guest au PMS** qui débite selon ses
  règles). **Ce n'est PAS un simple iCal** — or notre scaffolding actuel suppose `partnerId + icalUrl` (inexact).
- **Clenzy a déjà DEUX routes possibles vers HomeToGo** :
  - **Route A — via Channex (agrégateur déjà intégré)** : `hometogo` est un `otaType` supporté par notre module
    Channex. ~80 % plombé. Mise en prod rapide, sans certification directe de Clenzy. Coût : commission Channex.
  - **Route B — partenariat connectivité direct** : on construit un `HomeToGoChannelAdapter` contre leur API
    privée, on se fait certifier. Meilleure marge + relation directe, mais gated et plus long.
- **Action immédiate recommandée** : envoyer l'email de prise de contact (§7) pour obtenir doc API + sandbox +
  conditions commerciales. **En parallèle**, si on veut HomeToGo live vite, livrer via la Route A.
  Trancher A vs B **une fois les conditions HomeToGo connues** (commission directe vs coût tout compris Channex).

---

## 2. Que vend HomeToGo (offre partenaire)

| Axe | Détail |
|-----|--------|
| Nature | Métamoteur (compare Airbnb/Vrbo/Booking…) **+ marketplace** propre (réservation sur HomeToGo) **+ HomeToGo_PRO** (SaaS/services B2B). |
| Échelle | Acquisition d'**Interhome** (≈40 000 logements, 28 pays), de **Smoobu** (PMS) et e-domizil. Se positionne comme *« plus gros fournisseur direct vers plateformes tierces »*. Leader européen. |
| Côté **demande** | **Doppelgänger** = white-label / API d'affiliation pour **embarquer l'inventaire HomeToGo sur VOTRE site**. ❌ Pas ce qu'on veut. |
| Côté **offre** (ce qu'on veut) | **Connectivity / Supply partner program** : un PMS **pousse ses logements** vers la marketplace HomeToGo. Onboarding piloté par un « Connection Manager ». |
| Connexion | **API two-way** : transmission temps réel de *property info, tarifs, règles, disponibilités* ; retour des *réservations + données guest* au fil de l'eau. Dispos recommandées sur **18 mois**. Propagation des changements jusqu'à **48 h**. |
| Paiement | **HomeToGo transmet la CB du guest au PMS** ; le PMS **débite** selon ses règles (PM = *merchant of record*). HomeToGo ne conserve la CB que ~10 jours. (Modèle « PM-collect » par pass-through carte.) |
| Commercial | **Commission par réservation (modèle CPA marketplace)**, taux **négocié par partenaire — à confirmer**. Facturation mensuelle (check-in du mois précédent), paiement à 10 jours, virement bancaire. |
| Approbation | Chaque logement est **revu/approuvé** → email avec un **HomeToGo listing ID** par logement. |

**PMS déjà connectés** (preuves d'un programme mûr) : OwnerRez, Track, Guesty, Hostfully, Rentals United, NextPax…

---

## 3. Sandbox / environnement de test — réponse

**Non, pas de sandbox self-service public.** Constats :

- **GitHub `github.com/hometogo`** : 2 repos seulement (`hometogo-data-code-snippets` en Python, `redis-proxy`
  archivé) — **rien** sur la connectivité/supply, aucun SDK, aucun OpenAPI.
- **Pages publiques** (`/partner/`, `/doppelgaenger/`) : orientées **demande/affiliation**, aucune doc technique supply.
- La doc connectivité, les credentials et l'environnement de test sont **délivrés après signature de l'accord
  partenaire** et pilotés par un Connection Manager / l'équipe Solutions.
- ⇒ **Le « test », c'est leur étape de certification.** Il faut donc **demander explicitement** dans l'email :
  doc API, environnement de **staging/sandbox**, **credentials de test** et **supplier ID** de test.

> Raccourci possible : passer par un **agrégateur déjà certifié HomeToGo** (Channex — qu'on a déjà —, Rentals United,
> NextPax). Leur propre sandbox sert alors d'environnement de test, sans certification directe de Clenzy.

---

## 4. État du code Clenzy aujourd'hui

### 4.1 Ce qui existe (scaffolding « stub »)
- `ChannelName.HOMETOGO` — enum présent (commentaire « partner ID + endpoint iCal »).
  `server/src/main/java/com/clenzy/integration/channel/ChannelName.java:28`
- `ChannelConnectionService` — HomeToGo traité en **stub** : `connect()` chiffre `{partnerId, icalUrl}` en JSON
  dans `credentials_ref` (préfixe `stub:`) ; `testConnection()` **valide juste la présence des champs**, aucun
  appel API. **Aucun `ChannelConnector` enregistré** → **zéro sync réelle**.
  `server/src/main/java/com/clenzy/integration/channel/service/ChannelConnectionService.java:71-79, 166-167, 372-403`
- Frontend : entrée catalogue `available: true` + formulaire `partnerId`+`icalUrl`.
  `client/src/services/channels/otaChannels.ts:115-124` · `client/src/services/api/channelConnectionApi.ts:95-98`

### 4.2 Ce qui existe AUSSI (et change tout) — la route Channex
- **Channex est intégré** (`integration/channex/`) et son catalogue OTA **supporte `hometogo`** comme `otaType`.
  `server/src/main/java/com/clenzy/integration/channex/model/ChannexOtaChannel.java:38-43`
- Les réservations entrantes via Channex pour des slugs sans canal dédié (dont HomeToGo) sont aujourd'hui
  **bucketées `source=OTHER`**. `server/src/main/java/com/clenzy/integration/channex/service/ChannexBookingService.java:357`

### 4.3 Le GAP à acter
- Le stub `partnerId + icalUrl` **ne correspond à aucune des deux vraies routes** :
  - iCal **ne peut pas** pousser des tarifs, ni recevoir réservations/CB, ni fournir des listing IDs.
  - Route A : HomeToGo n'est **pas** un canal autonome — c'est un **toggle `otaType=hometogo` sous Channex**.
  - Route B : les credentials seraient un **supplier ID + API key/secret (ou OAuth) émis par HomeToGo**, pas une URL iCal.
- ⇒ Le stub est un **placeholder cosmétique** (inerte). À **re-câbler ou gater** une fois la route choisie, pour
  éviter qu'un host saisisse une URL iCal qui ne fait rien.

---

## 5. Les deux routes d'intégration (comparatif)

| Critère | **Route A — via Channex (agrégateur)** | **Route B — connectivité directe** |
|---|---|---|
| Effort dev | Faible (~80 % plombé) : activer `otaType=hometogo`, mapper la `source=HOMETOGO`, UI | Élevé : `HomeToGoChannelAdapter` complet (push ARI/contenu + booking API) + certification |
| Time-to-market | **Rapide** (jours/semaines) | Lent (gated + certif, semaines/mois) |
| Certification | Faite par Channex | À faire par Clenzy avec HomeToGo |
| Coût | **Commission/fee Channex** en plus | Commission HomeToGo seule (meilleure marge) |
| Contrôle / features | Limité au périmètre Channex×HomeToGo | Total (contenu, promos, HomeToGo_PRO) |
| Dépendance | Channex (couverture marchés/fonctions) | HomeToGo direct |
| Risque | Faible | Moyen (spec privée, effort certif) |

**Reco** : démarrer **B sur le plan relationnel** (email maintenant, pour connaître doc/sandbox/commission) ;
si besoin business de live rapide, **livrer A en parallèle** ; **trancher A vs B** quand HomeToGo aura chiffré la
commission directe (à comparer au coût tout-compris Channex).

---

## 6. Plan d'implémentation (quand la route sera tranchée)

### Route A — via Channex (si choisie)
1. Mapper `source=HOMETOGO` dans `ChannexBookingService` (au lieu de `OTHER`) pour les bookings entrants HomeToGo.
2. Exposer `hometogo` comme `otaType` activable dans l'UI Channex (mapping property → channel HomeToGo).
3. Vérifier le push ARI/contenu générique Channex couvre les exigences HomeToGo (contenu/photos, 18 mois de dispo).
4. **Retirer / gater** le stub `HOMETOGO` de `ChannelConnectionService` (éviter le doublon trompeur iCal).
5. Tests d'intégration via la sandbox Channex.

### Route B — connectivité directe (si choisie)
1. Obtenir : doc API + **supplier ID** + credentials de test + accès staging (via l'email §7).
2. Créer `server/.../integration/hometogo/` : `config/`, `model/HomeToGoConnection` (supplier ID, API key/secret
   ou OAuth — **pas** d'iCal), `repository/`, `service/HomeToGoApiClient`, `service/HomeToGoSyncService`.
3. `HomeToGoChannelAdapter implements ChannelConnector` : capabilities (OUTBOUND_CALENDAR, OUTBOUND_RESTRICTIONS,
   CONTENT_SYNC, INBOUND_RESERVATIONS, …) ; brancher sur le pipeline Outbox→Kafka→`ChannelSyncService`.
4. Réception booking + **pass-through CB** → créer la réservation et stocker la CB selon nos règles PCI.
5. Migration Liquibase **`0181__create_hometogo_connection.sql`** (dernier changeset actuel = `0180`).
6. Re-câbler le formulaire frontend (supplier ID + clés) ; remplacer le stub.
7. Certification HomeToGo (jeu de tests fourni par leur équipe Solutions).

---

## 7. Email de prise de contact (prêt à envoyer)

> Destinataire : `partner@hometogo.com` (cc `partnersupport@hometogo.com`).
> ⚠️ Compléter les `[…]` (identité, volumétrie, marchés) avant envoi.

### Version EN (recommandée — routage équipe connectivité centrale)

```
To: partner@hometogo.com
Cc: partnersupport@hometogo.com
Subject: PMS connectivity partnership — Clenzy (Property Management System)

Hello HomeToGo Partnerships team,

I'm reaching out on behalf of Clenzy, a multi-tenant Property Management System (PMS) for
short-term rentals serving property managers and hosts in [France / Europe / MENA]. We currently
manage [X properties across Y organizations] and distribute to channels such as Airbnb, Booking.com,
Vrbo/Abritel, Expedia and others.

We would like to explore becoming a HomeToGo connectivity / supply partner, so that our managed
inventory can be distributed to the HomeToGo marketplace with a two-way, real-time integration
(availability, rates, content, and inbound reservations).

To scope the integration on our side, could you please share:

  1. Connectivity / API documentation for a direct PMS integration (ARI + content push,
     reservation/booking API, and the guest-payment / card pass-through model).
  2. Whether a test / staging (sandbox) environment is available, and how we obtain test
     credentials and a test supplier ID.
  3. The certification process, expected timeline, and a technical/solutions contact.
  4. The commercial model: commission / CPA structure and rate, payout model
     (PM-collect via card pass-through vs. HomeToGo-collect), and invoicing terms.
  5. Market coverage relevant to us ([France] + others), instant-book vs. request-to-book support,
     content/photo requirements, supported languages and currencies.
  6. Whether you prefer/accept a direct connectivity integration, or distribution via an existing
     certified aggregator (e.g. Channex) — and any difference in commercial terms between the two.

We're flexible on the path (direct or via a certified aggregator) and happy to schedule a call.

Best regards,
[Full name]
[Title], Clenzy
[email] · [phone] · [website]
```

### Version FR (si vous préférez écrire à l'équipe FR via hometogo.fr)

```
À : partner@hometogo.com
Cc : partnersupport@hometogo.com
Objet : Partenariat connectivité PMS — Clenzy (Property Management System)

Bonjour l'équipe Partenariats HomeToGo,

Je vous contacte au nom de Clenzy, un PMS (Property Management System) multi-tenant pour la
location courte durée, au service de gestionnaires et propriétaires en [France / Europe / MENA].
Nous gérons aujourd'hui [X logements sur Y organisations] et distribuons déjà sur des canaux comme
Airbnb, Booking.com, Vrbo/Abritel, Expedia, etc.

Nous souhaitons étudier un partenariat de connectivité / supply avec HomeToGo, afin de distribuer
notre inventaire géré sur la marketplace HomeToGo via une intégration two-way temps réel
(disponibilités, tarifs, contenu et réception des réservations).

Pour cadrer l'intégration de notre côté, pourriez-vous nous transmettre :

  1. La documentation connectivité / API pour une intégration PMS directe (push ARI + contenu,
     API de réservation, et le modèle de paiement / transmission de la carte du voyageur).
  2. L'existence d'un environnement de test / staging (sandbox) et la procédure pour obtenir des
     credentials de test et un supplier ID de test.
  3. Le processus et le délai de certification, ainsi qu'un contact technique / solutions.
  4. Le modèle commercial : structure et taux de commission / CPA, modèle de versement
     (encaissement par le gestionnaire via transmission carte vs. encaissement HomeToGo) et facturation.
  5. La couverture marché pertinente pour nous ([France] + autres), le support instant-book vs.
     request-to-book, les exigences de contenu/photos, langues et devises supportées.
  6. Si vous privilégiez/acceptez une intégration directe, ou via un agrégateur déjà certifié
     (ex. Channex) — et l'éventuelle différence de conditions commerciales entre les deux.

Nous sommes ouverts sur la voie d'intégration (directe ou via agrégateur certifié) et disponibles
pour un échange.

Bien cordialement,
[Nom complet]
[Fonction], Clenzy
[email] · [téléphone] · [site web]
```

---

## 8. Décisions

**Prises le 2026-06-05 :**
- ✅ **Stratégie : « email d'abord, code après ».** On contacte HomeToGo pour obtenir doc API / sandbox /
  conditions commerciales **avant** d'écrire le code d'intégration. On tranchera Route A vs B à la lumière de
  leur commission.
- ✅ **Stub HomeToGo gaté « Bientôt » dans l'UI** (évite une connexion iCal inopérante). 2 fichiers, typecheck OK,
  **non commité** :
  - `client/src/services/channels/otaChannels.ts` — HomeToGo `available: true → false`.
  - `client/src/services/api/channelConnectionApi.ts` — `'hometogo'` retiré de `CONNECTABLE_CHANNELS`.
  - Effet : carte « Bientôt » + grisée dans la vitrine Intégrations **et** l'onglet Channels ; dialog sans
    formulaire ; reste recherchable. Convention identique aux canaux MENA (almosafer/tajawal/wego).
  - Réactivation = revert de ces 2 lignes quand la vraie route sera livrée.

**Encore ouvertes :**
1. **Route A (Channex) vs B (direct) vs les deux** ? (dépend de la commission HomeToGo).
2. **Qui envoie l'email** et sous quelle identité légale / volumétrie / marchés (compléter les `[…]` du §7).

---

## 9. Sources

- HomeToGo partenaires : https://www.hometogo.com/partner/ · Doppelgänger : https://www.hometogo.com/doppelgaenger/
- OwnerRez × HomeToGo (modèle two-way, CB pass-through, listing ID) :
  https://www.ownerrez.com/support/articles/channel-management-api-integrations-hometogo-setup-connecting
- Guesty (modèle PMS + sync) : https://www.guesty.com/blog/hometogo-everything-hosts-should-know/
- Rentals United (agrégateur HomeToGo) : https://rentalsunited.com/vacation-rental-services/hometogo/
- Stratégie / Interhome / HomeToGo_PRO :
  https://www.rentalscaleup.com/hometogo-interhome-pricelabs-161-integrations-booking-genius-rewards-visa-roundup/
- GitHub org (aucune API publique) : https://github.com/hometogo
- Channex API (catalogue OTA, dont hometogo) : https://docs.channex.io/api-reference/channels
```
