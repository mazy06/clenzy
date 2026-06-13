# Prises de contact partenaires — emails prêts à envoyer

> Cartes Backlog du board Baitly Kanban. 17 partenaires. Channex en priorité. Importer aussi via `TRELLO_BACKLOG_IMPORT.csv`.

## 1. Contact Channex — accès production + conditions agrégateur

- **Catégorie** : Distribution · **Priorité** : Priorité haute
- **Objectif** : Hub channel manager qui débloque plusieurs OTA d'un coup (dont HomeToGo, déjà ~80% plombé). À prioriser : conditionne la stratégie distribution.
- **Contact** : Portail Channex + support partenaire (docs.channex.io)
- **À demander** : Tarif/commission · périmètre OTA (HomeToGo, Booking, Vrbo, MENA) · environnement de test · étapes de certification PMS · contact technique go-live

```
Subject: PMS partnership — Channex channel manager integration (Clenzy)

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We're integrating Channex as our channel manager to distribute managed inventory to multiple OTAs from a single connection; our integration is already ~80% built against your API. Before going to production we'd like to confirm:

  1. Production onboarding and pricing (per-property / per-booking fee or commission).
  2. The full list of OTA channels available through your catalog — in particular HomeToGo, Booking.com, Vrbo/Abritel, and any MENA-relevant channels.
  3. Access to a test environment and the certification steps for a PMS.
  4. Supported markets, currencies and content/photo requirements.
  5. A technical / solutions contact for go-live.

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 2. Contact HomeToGo — partenariat connectivité supply

- **Catégorie** : Distribution · **Priorité** : Important
- **Objectif** : Trancher Route A (via Channex) vs Route B (connectivité directe) selon leur commission. Détail complet dans HANDOFF_HOMETOGO.md.
- **Contact** : partner@hometogo.com (cc partnersupport@hometogo.com)
- **À demander** : Doc API two-way · sandbox + supplier ID de test · taux de commission · modèle d'encaissement (CB pass-through) · direct vs via Channex

```
Objet: Partenariat connectivité PMS — Clenzy (Property Management System)

Bonjour,

Nous opérons Clenzy (app.clenzy.fr), un PMS (logiciel de gestion locative courte durée) édité par Sinatech SAS (France), utilisé par des conciergeries et propriétaires en France, au Maroc, en Arabie Saoudite, aux Émirats arabes unis, à Oman et au Qatar. Nous gérons aujourd'hui une trentaine de logements (~90 voyageurs/mois), en croissance.

Nous souhaitons étudier un partenariat de connectivité / supply avec HomeToGo, afin de distribuer notre inventaire géré sur la marketplace HomeToGo via une intégration two-way temps réel (disponibilités, tarifs, contenu, réception des réservations).

Pourriez-vous nous transmettre :
  1. La doc connectivité / API pour une intégration PMS directe (push ARI + contenu, API de réservation, modèle de transmission de la carte du voyageur).
  2. L'existence d'un environnement de test / staging et la procédure pour obtenir des credentials de test et un supplier ID de test.
  3. Le processus et le délai de certification, ainsi qu'un contact technique / solutions.
  4. Le modèle commercial : taux de commission / CPA, modèle de versement, facturation.
  5. Si vous privilégiez une intégration directe ou via un agrégateur déjà certifié (ex. Channex), et l'éventuelle différence de conditions commerciales.

Bien cordialement,
Toufik MAZY — CEO & co-fondateur, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 3. Contact Klook — accès API affilié / data-feed

- **Catégorie** : Activités · **Priorité** : Standard
- **Objectif** : Passer des deep links (livré) à l'affichage natif du catalogue. Email complet dans HANDOFF_KLOOK.md.
- **Contact** : affiliate@klook.com + formulaire Contact Us du portail (compte mazytoufik@proton.me)
- **À demander** : Éligibilité API affilié · doc technique · auth (clé/OAuth) · sandbox. ⚠️ confirmer tracking direct (aid) vs réseau

```
Objet: Demande d'accès à l'API affilié / data-feed Klook — affichage natif du catalogue

Bonjour,

Nous opérons Clenzy (app.clenzy.fr), un PMS (logiciel de gestion locative courte durée) édité par Sinatech SAS (France), utilisé par des conciergeries et propriétaires en France, au Maroc, en Arabie Saoudite, aux Émirats arabes unis, à Oman et au Qatar. Nous gérons aujourd'hui une trentaine de logements (~90 voyageurs/mois), en croissance.

Nous sommes déjà membres de votre programme d'affiliation (compte : mazytoufik@proton.me). Nous proposons un livret d'accueil numérique aux voyageurs et souhaitons y afficher des activités Klook selon la destination du logement, avec réservation via nos liens d'affiliation. Aujourd'hui nous utilisons les deep links ; nous voulons passer à un affichage natif du catalogue.

Pourriez-vous nous indiquer l'accès disponible à votre API affilié / data-feed (recherche d'activités par destination, contenu produit : titre, image, prix, note, lien trackable), les conditions d'éligibilité, la documentation, l'authentification (clé / OAuth) et l'éventuel environnement de test ?

Si une intégration distributeur est plus adaptée, nous sommes ouverts à en discuter.

Bien cordialement,
Toufik MAZY — CEO & co-fondateur, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 4. Contact GetYourGuide — accès Partner API + token

- **Catégorie** : Activités · **Priorité** : Standard
- **Objectif** : Compte partenaire + token pour catalogue natif. Déjà membre affilié (Partner ID ZZREWEK, 16%). Email dans HANDOFF_GETYOURGUIDE.md.
- **Contact** : partner.getyourguide.com / code.getyourguide.com/partner-api-spec
- **À demander** : Création compte partenaire · token API · tier de connectivité · doc + sandbox

```
Objet: Demande d'accès à la Partner API GetYourGuide — affichage natif du catalogue

Bonjour,

Nous opérons Clenzy (app.clenzy.fr), un PMS (logiciel de gestion locative courte durée) édité par Sinatech SAS (France), utilisé par des conciergeries et propriétaires en France, au Maroc, en Arabie Saoudite, aux Émirats arabes unis, à Oman et au Qatar. Nous gérons aujourd'hui une trentaine de logements (~90 voyageurs/mois), en croissance.

Nous sommes membres de votre programme d'affiliation (Partner ID : ZZREWEK, taux 16%). Nous proposons un livret d'accueil numérique et y intégrons des activités GetYourGuide selon la destination du logement, via nos liens d'affiliation (partner_id). Nous souhaitons passer à un affichage natif du catalogue dans l'application.

Pourriez-vous nous indiquer la procédure de création d'un compte partenaire et d'obtention d'un token d'accès à la Partner API (recherche d'activités par destination ; contenu : titre, image, prix, note, disponibilité, lien trackable), les conditions d'éligibilité (tiers de connectivité), la documentation et l'éventuel environnement de test ?

Bien cordialement,
Toufik MAZY — CEO & co-fondateur, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 5. Contact Viator (TripAdvisor) — Partner API activités

- **Catégorie** : Activités · **Priorité** : Standard
- **Objectif** : ViatorActivityClient sert déjà de modèle de référence. Confirmer/obtenir l'accès Partner API + clé pour activer le provider.
- **Contact** : partnerresources.viator.com (Viator Partner API)
- **À demander** : Clé API partenaire · conditions affiliation (CPS) · doc recherche par destination · sandbox

```
Subject: Viator Partner API access — activity catalog for a PMS welcome guide

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We operate a digital guest welcome guide and want to display relevant Viator experiences by property destination, with booking through our affiliate links; we've modeled our activity client on the Viator Partner API.

Could you share: access to the Viator Partner API (affiliate / CPS), API key issuance, documentation for destination search and product content (title, image, price, rating, bookable link), eligibility criteria, and any sandbox? Current volume ~30 properties / ~90 travelers per month, France + MENA.

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 6. Contact Tuya — compte développeur Cloud + partenariat

- **Catégorie** : IoT · **Priorité** : Standard
- **Objectif** : Accès à l'écosystème Tuya (serrures, capteurs, prises) via Tuya IoT Cloud.
- **Contact** : iot.tuya.com (Tuya IoT Platform / programme partenaire)
- **À demander** : Compte développeur Cloud · clés API (Access ID/Secret) · data center EU/MENA · modèle d'autorisation device · rate limits · test

```
Subject: Tuya IoT Cloud — developer / partner access for a property management platform

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We're integrating smart devices (locks, sensors, plugs) into our PMS for short-term rentals and would like to access the Tuya IoT Cloud.

Could you advise on: developer / partner account setup, Cloud API credentials (Access ID / Secret), the recommended data center for EU + MENA, the device-authorization model for managing devices on behalf of our users, rate limits, a test environment, and pricing for commercial use?

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 7. Contact Netatmo — programme Netatmo Connect (API OAuth)

- **Catégorie** : IoT · **Priorité** : Standard
- **Objectif** : Thermostats / capteurs / caméras via l'API Netatmo Connect.
- **Contact** : dev.netatmo.com (Netatmo Connect)
- **À demander** : Création app OAuth · scopes disponibles · rate limits · conditions usage commercial / partenariat

```
Objet: Netatmo Connect — accès API pour une plateforme de gestion locative

Bonjour,

Nous opérons Clenzy (app.clenzy.fr), un PMS (logiciel de gestion locative courte durée) édité par Sinatech SAS (France), utilisé par des conciergeries et propriétaires en France, au Maroc, en Arabie Saoudite, aux Émirats arabes unis, à Oman et au Qatar. Nous gérons aujourd'hui une trentaine de logements (~90 voyageurs/mois), en croissance.

Nous souhaitons intégrer les produits Netatmo (thermostats, capteurs, caméras) à notre PMS.

Pourriez-vous nous préciser : la création d'une application sur Netatmo Connect (OAuth), les scopes disponibles, les limites de débit, et les conditions d'usage commercial / partenariat pour gérer des appareils au nom de nos utilisateurs ?

Bien cordialement,
Toufik MAZY — CEO & co-fondateur, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 8. Contact Minut — confirmation tier API / partenariat revendeur

- **Catégorie** : IoT · **Priorité** : Standard
- **Objectif** : Déjà intégré (alertes bruit). Formaliser le tier API / programme partenaire ou revendeur (volumes, conditions).
- **Contact** : Contact partenaire Minut / account manager
- **À demander** : Conditions programme partenaire/revendeur · tarifs volume · roadmap API + rate limits · support intégration

```
Subject: Minut partner / reseller program — noise monitoring for a STR PMS

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We already integrate Minut for noise alerts in our PMS and would like to formalize a partner or reseller relationship.

Could you share: partner / reseller program terms, volume pricing, API roadmap and rate limits, and an integration / support contact? We focus on France + MENA.

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 9. Contact KeyNest — accès API partenaire

- **Catégorie** : Accès · **Priorité** : Standard
- **Objectif** : Remise/gestion de clés via le réseau KeyNest (déjà dans la stack).
- **Contact** : Équipe partenariats KeyNest / API
- **À demander** : Accès API · doc (point de remise, codes, dispo) · conditions commerciales · couverture FR/MENA · sandbox

```
Subject: KeyNest API partnership — key exchange for a STR PMS

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We'd like to integrate KeyNest key exchange into our PMS so managers can arrange key drop-off / pickup and share codes with guests.

Could you share: API access, documentation (create drop-off point, retrieve codes / availability), commercial terms, coverage (France + MENA), and a sandbox?

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 10. Contact Brevo — plan API transactionnel + conditions volume

- **Catégorie** : Communication · **Priorité** : Standard
- **Objectif** : Email/SMS transactionnel (déjà en stack). Sécuriser le plan API, la délivrabilité et le tarif volume.
- **Contact** : Account manager Brevo / portail
- **À demander** : Plan API transactionnel · quotas + délivrabilité · IP dédiée · conditions volume · support SMS MENA

```
Objet: Brevo — plan API transactionnel & conditions volume pour un PMS

Bonjour,

Nous opérons Clenzy (app.clenzy.fr), un PMS (logiciel de gestion locative courte durée) édité par Sinatech SAS (France), utilisé par des conciergeries et propriétaires en France, au Maroc, en Arabie Saoudite, aux Émirats arabes unis, à Oman et au Qatar. Nous gérons aujourd'hui une trentaine de logements (~90 voyageurs/mois), en croissance.

Nous utilisons Brevo pour nos emails (et SMS) transactionnels au sein de notre PMS.

Pour cadrer notre montée en charge, pourriez-vous nous préciser : le plan API transactionnel adapté, les quotas et la délivrabilité, la possibilité d'une IP dédiée, les conditions tarifaires au volume, et le support SMS pour la zone MENA ?

Bien cordialement,
Toufik MAZY — CEO & co-fondateur, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 11. Contact WhatsApp (Meta) — Tech Provider / BSP + templates

- **Catégorie** : Communication · **Priorité** : Important
- **Objectif** : WhatsApp uniquement via l'API Meta. Sécuriser le statut Tech Provider/BSP et l'approbation des templates.
- **Contact** : Meta Business / WhatsApp Business Platform (ou BSP partenaire)
- **À demander** : Statut tech provider · process approbation templates · tarification conversation · numéros multi-pays MENA

```
Subject: WhatsApp Business Platform — Tech Provider / BSP onboarding for a PMS

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We send guest communications via the WhatsApp Business Platform (Meta Cloud API) from our PMS and would like to confirm and scale our setup:

  1. Onboarding as a Tech Provider (or guidance on a recommended BSP).
  2. The message-template approval process (e.g. transactional alerts to guests).
  3. Conversation-based pricing.
  4. Support for multiple sender numbers across France + MENA.

Could you point us to the right path?

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 12. Contact Yousign — plan API v3 + partenariat

- **Catégorie** : Signature · **Priorité** : Standard
- **Objectif** : Provider implémenté mais non branché. Débloquer le plan API pour l'activer.
- **Contact** : yousign.com (commercial API / partenaire)
- **À demander** : Plan API v3 · tarification (document/abonnement) · niveau eIDAS (SES/AES) · sandbox · conditions partenaire PMS

```
Objet: Yousign — plan API v3 & partenariat pour un PMS

Bonjour,

Nous opérons Clenzy (app.clenzy.fr), un PMS (logiciel de gestion locative courte durée) édité par Sinatech SAS (France), utilisé par des conciergeries et propriétaires en France, au Maroc, en Arabie Saoudite, aux Émirats arabes unis, à Oman et au Qatar. Nous gérons aujourd'hui une trentaine de logements (~90 voyageurs/mois), en croissance.

Nous intégrons la signature électronique des mandats de gestion dans notre PMS et souhaitons utiliser Yousign.

Pourriez-vous nous indiquer : le plan API (v3) adapté, la tarification (au document / abonnement), le niveau eIDAS (SES / AES), l'environnement de test (sandbox), et d'éventuelles conditions partenaire pour un éditeur de PMS ?

Bien cordialement,
Toufik MAZY — CEO & co-fondateur, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 13. Contact DocuSign — plan API + programme ISV

- **Catégorie** : Signature · **Priorité** : Standard
- **Objectif** : Provider implémenté non branché. Alternative/complément à Yousign.
- **Contact** : developers.docusign.com / programme partenaire ISV
- **À demander** : Plan API + tarif enveloppes · programme ISV/partenaire · conformité eIDAS · sandbox

```
Subject: DocuSign API & ISV partner program — e-signature for a PMS

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We embed e-signature for management mandates in our PMS and are evaluating DocuSign.

Could you share: the API plan and envelope pricing, the ISV / partner program for software vendors, eIDAS compliance options, and a sandbox?

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 14. Contact Pennylane — programme partenaire / API d'intégration

- **Catégorie** : Comptabilité · **Priorité** : Important
- **Objectif** : Synchroniser factures/compta (conformité NF) avec Pennylane.
- **Contact** : pennylane.com (programme partenaire / API)
- **À demander** : Accès API · doc (factures, écritures, clients/fournisseurs) · programme partenaire intégrateur · sandbox · conditions

```
Objet: Pennylane — programme partenaire & API d'intégration pour un PMS

Bonjour,

Nous opérons Clenzy (app.clenzy.fr), un PMS (logiciel de gestion locative courte durée) édité par Sinatech SAS (France), utilisé par des conciergeries et propriétaires en France, au Maroc, en Arabie Saoudite, aux Émirats arabes unis, à Oman et au Qatar. Nous gérons aujourd'hui une trentaine de logements (~90 voyageurs/mois), en croissance.

Nous éditons un PMS et souhaitons synchroniser la facturation et la comptabilité (conformité NF) avec Pennylane.

Pourriez-vous nous orienter vers : votre programme partenaire intégrateur, l'accès API et sa documentation (factures, écritures, clients / fournisseurs), les conditions, et un environnement de test ?

Bien cordialement,
Toufik MAZY — CEO & co-fondateur, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 15. Contact Breezeway — partenariat / API operations

- **Catégorie** : Opérations · **Priorité** : Standard
- **Objectif** : Coordination ménage/maintenance & check-in.
- **Contact** : breezeway.io (partnerships / API)
- **À demander** : Accès API · doc (tasks, scheduling, properties) · modèle de partenariat · couverture FR/MENA · sandbox

```
Subject: Breezeway partnership / API — operations & cleaning for a STR PMS

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We'd like to integrate Breezeway operations (cleaning, maintenance, inspections) with our PMS.

Could you share: API access and documentation (tasks, scheduling, properties), your partnership model, market coverage (we operate in France + MENA — please confirm availability), and a sandbox?

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 16. Contact Turno (ex-TurnoverBnB) — marketplace ménage + API

- **Catégorie** : Opérations · **Priorité** : Standard
- **Objectif** : Automatisation des prestations ménage (marketplace + API).
- **Contact** : turno.com (partner / API)
- **À demander** : Accès API · doc (projects/cleanings/scheduling) · couverture FR/MENA · conditions · sandbox

```
Subject: Turno API & partnership — cleaning automation for a STR PMS

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We'd like to integrate Turno (cleaner marketplace + scheduling) with our PMS.

Could you share: API access and documentation (projects / cleanings / scheduling), geographic coverage (France + MENA — please confirm), partnership terms, and a sandbox?

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

## 17. Contact PriceLabs — programme intégration PMS

- **Catégorie** : Pricing · **Priorité** : Standard
- **Objectif** : Tarification dynamique en complément du PriceEngine interne.
- **Contact** : pricelabs.co (PMS integration partner program)
- **À demander** : Accès API/programme intégration PMS · doc (sync prix/dispos) · modèle de connexion · conditions · sandbox

```
Subject: PriceLabs PMS integration partner program — dynamic pricing

Hello,

We run Clenzy (app.clenzy.fr), a multi-tenant short-term-rental property management system operated by Sinatech SAS (France), used by property managers and hosts across France, Morocco, Saudi Arabia, the UAE, Oman and Qatar. We currently manage around 30 properties (~90 travelers/month), growing.

We operate a PMS with an internal pricing engine and want to offer PriceLabs dynamic pricing as a complementary option to our users.

Could you share: your PMS integration partner program, API access and documentation (price / availability sync), the connection model (per-account authorization), commercial terms, and a sandbox?

Best regards,
Toufik MAZY — CEO & co-founder, Clenzy
Sinatech SAS — app.clenzy.fr — mazytoufik@proton.me
```

