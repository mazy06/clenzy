# Intégration GetYourGuide — Handoff

> Marketplace d'activités GetYourGuide dans le livret d'accueil. Même approche que Klook :
> deep links maintenant (Forme 1, livré) + demande d'accès Partner API en parallèle (Forme 2).
> Maj : 2026-06-08.

## TL;DR — GetYourGuide est bien plus ouvert que Klook

- **Programme affilié** : portail `partner.getyourguide.com`, ~8 % de commission, cookie **31 jours**
  (1st-party), **Affiliate Link Builder** (URL → lien court `gyg.me`). ID de tracking = **Partner ID / Cookie ID**.
- **Partner API publique et documentée** : `code.getyourguide.com/partner-api-spec` +
  repo `github.com/getyourguide/partner-api-spec` + `api.getyourguide.com`. Accès = créer un **compte
  partenaire** → **token d'accès API** (SSL). Programme **Connectivity Partner** à 3 tiers.
- → Contrairement à Klook, l'API produit est accessible « out of the box » sur demande de compte partenaire.

## Forme 1 — Deep links (LIVRÉ, mécanisme partagé avec Klook)

**Comment l'hôte s'en sert**
1. **Connecter GetYourGuide** : onglet *Intégrations* → carte GetYourGuide → saisir le **Partner ID** (champ
   « ID affilié ») + activer. → `PUT /api/activities/configs/GETYOURGUIDE`.
2. **Ajouter des activités** au livret en collant un lien `https://www.getyourguide.com/...`.
3. Au service du livret, Clenzy ajoute automatiquement `?partner_id=<votreID>` aux liens `getyourguide.com`
   non déjà trackés. Les liens courts `gyg.me` (déjà trackés) sont laissés intacts.

**Implémentation** — mécanisme **partagé multi-providers** (cf. `HANDOFF_KLOOK.md`) :
- `server/.../integration/activities/AffiliateLinkDecorator.java` — interface (algorithme `wrap` partagé).
- `server/.../integration/activities/GetYourGuideAffiliateLinkDecorator.java` — `@Component` :
  param **`partner_id`**, domaine `getyourguide.com` (apex + sous-domaines). `gyg.me` non touché (autre domaine).
- `server/.../service/WelcomeGuideService.java` — `decorateAffiliateLinks(json, orgId)` applique tous les
  décorateurs actifs (Klook + GetYourGuide + …) en chaîne ; chacun ne modifie que les URL de son domaine.
- Tests : `AffiliateLinkDecoratorTest` (Klook + GetYourGuide + isolation + null-safe). Frontend : la caption
  `welcomeGuide.curation.affiliateHint` mentionne déjà GetYourGuide (rien à changer).

**Limite assumée** : commission suivie côté portail GetYourGuide (CPS, cookie 31j), pas de postback → le split
par contrat de gestion ne s'auto-remplit pas (réconciliation portail, ou Forme 2 si l'API expose les ventes).

### ⚠️ À CONFIRMER
Le wrapping suppose le param **`partner_id`**. Vérifier dans l'**Affiliate Link Builder** du portail le format
exact du lien généré (param `partner_id`, éventuel `cmp` de campagne). Si différent → ajuster
`GetYourGuideAffiliateLinkDecorator.affiliateParam()`.

## Forme 2 — Catalogue natif via Partner API (À DÉBLOQUER → demande ci-dessous)

Au déblocage : implémenter `GetYourGuideActivityClient implements ActivityCatalogClient` (calquer
`ViatorActivityClient`) → `provider()=GETYOURGUIDE`, `search(query, config)` appelle la Partner API
(token via `config.getApiKey()`), mapping défensif. Lien produit + `partner_id` via
`GetYourGuideAffiliateLinkDecorator.wrap(...)`. `searchForGuide(token)` agrège déjà. `application.yml` :
`clenzy.activities.getyourguide.base-url` (défaut dans `@Value`, comme Viator). Réf. spec :
`code.getyourguide.com/partner-api-spec`. **Pas de code spéculatif posé maintenant (YAGNI)** — on implémente
sur la doc réelle + token.

---

## DEMANDE D'ACCÈS — où candidater

- **Affilié (Forme 1)** : `partner.getyourguide.com` → rejoindre le programme + récupérer le **Partner ID**
  (Affiliate Link Builder). Déjà membre via `mazytoufik@proton.me`.
- **Partner API (Forme 2)** : demander un **compte partenaire + token** via la page API
  (`api.getyourguide.com` / `code.getyourguide.com`) ou le formulaire de contact partenaire du portail.
  Mentionner le besoin (affichage catalogue + liens affiliés) → ils orientent vers le tier de connectivité adapté.

### Email — FR (prêt à envoyer)

> Objet : Demande d'accès à la Partner API GetYourGuide — affichage natif du catalogue
>
> Bonjour,
>
> Nous opérons **Clenzy** (app.clenzy.fr), un PMS (logiciel de gestion locative courte durée) édité par la
> société **Sinatech SAS** (France). Notre logiciel est utilisé par des conciergeries et propriétaires opérant
> en **France, au Maroc, en Arabie Saoudite, aux Émirats Arabes Unis, à Oman et au Qatar**. Nous sommes membres
> de votre programme d'affiliation (Partner ID : ZZREWEK, taux 16 %).
>
> Nous proposons un **livret d'accueil numérique** aux voyageurs et y intégrons des activités GetYourGuide
> selon la **destination du logement**, via nos liens d'affiliation (`partner_id`). Nous souhaitons passer à
> un **affichage natif du catalogue** dans l'application.
>
> Pourriez-vous nous indiquer la procédure de **création d'un compte partenaire** et d'obtention d'un **token
> d'accès à la Partner API** (recherche d'activités par destination ; contenu produit : titre, image, prix,
> note, disponibilité, lien trackable), les **conditions d'éligibilité** (tiers de connectivité), la
> **documentation** et l'éventuel **environnement de test** ? Volume actuel : ~30 logements, ~90 voyageurs/mois,
> en croissance (France + MENA).
>
> Merci d'avance,
> Toufik MAZY — CEO associé, Clenzy — Sinatech SAS — mazytoufik@proton.me — app.clenzy.fr

### Email — EN (ready to send)

> Subject: GetYourGuide Partner API access request — native catalog display
>
> Hello,
>
> We run **Clenzy** (app.clenzy.fr), a short-term-rental property management system operated by **Sinatech
> SAS** (France). It's used by property managers and hosts operating in **France, Morocco, Saudi Arabia, the
> United Arab Emirates, Oman and Qatar**. We're members of your affiliate program (Partner ID: ZZREWEK,
> 16% rate).
>
> We offer a **digital guest welcome guide** and embed GetYourGuide activities based on each **property's
> destination**, through our affiliate links (`partner_id`). We'd like to move to a **native catalog display**
> in the app.
>
> Could you share the process to **create a partner account** and obtain a **Partner API access token**
> (activity search by destination; product content: title, image, price, rating, availability, trackable
> link), the **eligibility criteria** (connectivity tiers), the **documentation**, and any **sandbox**? Current
> volume: ~30 properties, ~90 travelers/month, growing (France + MENA).
>
> Best regards,
> Toufik MAZY — CEO & co-founder, Clenzy — Sinatech SAS — mazytoufik@proton.me — app.clenzy.fr
