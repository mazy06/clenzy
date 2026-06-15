# Intégration Klook — Handoff

> Marketplace d'activités Klook dans le livret d'accueil. Décision : **les deux** —
> deep links maintenant (Forme 1, livré) + demande d'accès API produit en parallèle (Forme 2).
> Maj : 2026-06-08.

## TL;DR

Le compte d'affiliation Klook standard **ne donne pas d'API produit** : il expose des
**deep links** (bouton *Generate Deeplink* → URL trackée), bannières/widgets et le tracking +
commission **dans le portail Klook** (ou un réseau type Travelpayouts/Partnerize).

Pour un **affichage natif du catalogue**, deux voies existent :
- **API affilié / data-feed** (légère, CPS) → demande via `affiliate@klook.com` / ton réseau. **← voie retenue.**
- **API distributeur / merchant** (`klook.com/partner/` « Become a distributor » ; doc `klook.gitbook.io/openapi`) →
  réservation Klook in-app, partenariat B2B (contrat, settlement). Plus lourde.

### Pourquoi l'API affilié/data-feed colle le mieux à Clenzy
L'archi activités existante = **fetch catalogue → afficher → rediriger vers le `bookingUrl` du provider**
(`ActivityCatalogClient.search()` → `ActivityDto{titre, image, prix, note, bookingUrl}`, clic = redirection).
Pas de tunnel de réservation/paiement d'activité in-app ; commission en modèle CPS. La voie affilié
s'emboîte direct (`KlookActivityClient.search()` calqué sur `ViatorActivityClient`). La voie distributeur
imposerait de construire réservation + paiement + settlement → projet à part, plus tard.

## Forme 1 — Deep links (LIVRÉ, fonctionne avec le compte affilié actuel)

**Comment l'hôte s'en sert**
1. **Connecter Klook** : onglet *Intégrations* → carte Klook → saisir l'**ID d'affiliation** (`aid`) + activer.
   (Pas de clé API : le tier affilié n'en a pas.) → `PUT /api/activities/configs/KLOOK`.
2. **Ajouter des activités Klook** au livret (étape *Expériences*) : coller un lien `https://www.klook.com/activity/...`.
3. Au service du livret, Clenzy ajoute automatiquement `?aid=<votreID>` aux liens `klook.com` non déjà trackés.

**Implémentation (backend only, zéro migration — `curatedActivities` est un JSONB pass-through)**
> Mécanisme **partagé multi-providers** (généralisé pour Klook + GetYourGuide ; cf. `HANDOFF_GETYOURGUIDE.md`).
- `server/.../integration/activities/AffiliateLinkDecorator.java` — interface (algorithme `wrap` partagé) ;
  impl `KlookAffiliateLinkDecorator` (param `aid`, domaine klook.com). Ajoute le param aux URL du domaine non
  déjà trackées ; laisse intacts les liens déjà trackés ou d'un autre domaine. `AffiliateLinkDecoratorTest`.
- `server/.../dto/WelcomeGuidePublicDto.java` — `withCuratedActivities(String)` (copie du record).
- `server/.../service/WelcomeGuideService.java` — `decorateAffiliateLinks(json, orgId)` dans `buildPublicPayload`
  (boucle sur les configs actives → décorateur par provider). Défensif. Injection `ActivityAffiliateConfigRepository`
  + `List<AffiliateLinkDecorator>`.
- Frontend : caption `welcomeGuide.curation.affiliateHint` (fr/en/ar) dans l'éditeur d'activités.

**Limites assumées** : commission suivie côté portail Klook (pas de postback) → le split par contrat de
gestion ne s'auto-remplit pas ; sous-ID par réservation non posé en v1.

### ⚠️ À CONFIRMER (route de tracking)
Le wrapping suppose le param in-house **`aid`**. Vérifier : tracking **en direct** (`affiliate.klook.com`)
ou **via un réseau** (Travelpayouts/Partnerize/Involve Asia) ? Si réseau → coller les deep links du réseau
(laissés intacts). Param différent → ajuster `KlookAffiliateLinkDecorator.affiliateParam()`.

## Forme 2 — Catalogue natif via API affilié/data-feed (À DÉBLOQUER → demande ci-dessous)

Au déblocage : implémenter `KlookActivityClient implements ActivityCatalogClient` (calquer `ViatorActivityClient`)
→ `provider()=KLOOK`, `search(query, config)` appelle l'endpoint Klook (clé via `config.getApiKey()`), mapping
défensif (`@JsonIgnoreProperties`), **liste vide** si pas de clé / erreur ; lien produit + `aid` via
`KlookAffiliateLinkDecorator.wrap(...)`. `searchForGuide(token)` les agrège déjà. `application.yml` :
`clenzy.activities.klook.base-url` (défaut dans `@Value`, comme Viator). Si l'API expose les transactions →
import → `ActivityCommissionService.record(...)`. **Pas de code spéculatif posé maintenant (YAGNI).**

---

## DEMANDE D'ACCÈS — où envoyer

- **Si inscrit via le portail Klook in-house** (`affiliate.klook.com`) : email **`affiliate@klook.com`** +
  formulaire *Contact Us* du portail.
- **Si inscrit via un réseau** (Involve Asia, Travelpayouts…) : passer par le **gestionnaire de compte /
  contact annonceur du réseau** (les réseaux brokent souvent l'accès API/feed) **ET** copier `affiliate@klook.com`.
- **Repli distributeur** (si Klook oriente vers le B2B) : `klook.com/partner/` → **« Become a distributor »**.

### Infos partenaire (renseignées 2026-06-08)
- Marque/app : **Clenzy** — `app.clenzy.fr` · Raison sociale : **Sinatech SAS** (France)
- Marchés : France, Maroc, Arabie Saoudite, Émirats Arabes Unis, Oman, Qatar
- Compte affilié : `mazytoufik@proton.me` · Canal d'inscription : **portail Klook direct** (présumé)
  → tracking in-house = param `aid` → wrapping Forme 1 correct, pas de changement de code.
- Volume : ~30 logements gérés, ~90 voyageurs/mois (en croissance)
- Contact : Toufik MAZY — CEO associé — `mazytoufik@proton.me`

### Email — FR (prêt à envoyer)

> Objet : Demande d'accès à l'API affilié / data-feed Klook — affichage natif du catalogue
>
> Bonjour,
>
> Nous opérons **Clenzy** (app.clenzy.fr), un PMS (logiciel de gestion locative courte durée) édité par la
> société **Sinatech SAS** (France). Notre logiciel est utilisé par des conciergeries et propriétaires
> opérant en **France, au Maroc, en Arabie Saoudite, aux Émirats Arabes Unis, à Oman et au Qatar**. Nous
> sommes déjà membres de votre programme d'affiliation (compte : mazytoufik@proton.me).
>
> Nous proposons un **livret d'accueil numérique** aux voyageurs et souhaitons y afficher des activités
> Klook pertinentes selon la **destination du logement** (ville / géolocalisation), avec réservation via
> nos **liens d'affiliation**. Aujourd'hui nous utilisons les deep links ; nous voulons passer à un
> **affichage natif du catalogue** dans l'application.
>
> Pourriez-vous nous indiquer l'accès disponible à votre **API affilié / data-feed** : recherche
> d'activités par destination et contenu produit (titre, image, prix, note, lien trackable) ? Merci de
> préciser les **conditions d'éligibilité, la documentation technique, l'authentification (clé / OAuth)
> et l'éventuel environnement de test**. Nous gérons actuellement une trentaine de logements
> (~90 voyageurs/mois), en croissance, avec un focus France + MENA.
>
> Si une intégration **distributeur** est plus adaptée à notre cas, nous sommes ouverts à en discuter.
>
> Merci d'avance,
> Toufik MAZY — CEO associé, Clenzy — Sinatech SAS — mazytoufik@proton.me — app.clenzy.fr

### Email — EN (ready to send)

> Subject: Klook affiliate API / data-feed access request — native catalog display
>
> Hello,
>
> We run **Clenzy** (app.clenzy.fr), a short-term-rental property management system operated by **Sinatech
> SAS** (France). It's used by property managers and hosts operating in **France, Morocco, Saudi Arabia,
> the United Arab Emirates, Oman and Qatar**. We're already members of your affiliate program (account:
> mazytoufik@proton.me).
>
> We offer a **digital guest welcome guide** and want to display relevant Klook activities based on each
> **property's destination** (city / geolocation), with booking through our **affiliate links**. We
> currently use deep links and want to move to a **native catalog display** in the app.
>
> Could you share what **affiliate API / data-feed** access is available: activity search by destination
> and product content (title, image, price, rating, trackable link)? Please advise on **eligibility
> criteria, technical documentation, authentication (API key / OAuth), and any sandbox**. We currently
> manage around 30 properties (~90 travelers/month), growing, with a France + MENA focus.
>
> If a **distributor** integration is a better fit for our case, we're open to discussing it.
>
> Best regards,
> Toufik MAZY — CEO & co-founder, Clenzy — Sinatech SAS — mazytoufik@proton.me — app.clenzy.fr
