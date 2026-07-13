# Modes d'intégration checkout (embedded / iframe / hosted-fields / redirect)

> Compagnon de [ADR-paiement-multi-provider.md](ADR-paiement-multi-provider.md).
> Objectif : figer le contrat du port pour que **toutes** les intégrations
> « in-page » futures (PSP régionaux, PayPal) s'ajoutent **sans rework** de
> l'architecture. Recherche providers menée en 2026-07.

## 1. Constat : « embedded » recouvre 3 mécanismes différents

Tous les grands providers offrent un mode « le client ne quitte pas le site »,
mais par des voies **incompatibles** entre elles :

| Provider | Mode in-page | Mécanisme technique | Le backend renvoie |
|---|---|---|---|
| **Stripe** | Embedded Checkout | `clientSecret` + composant JS `<EmbeddedCheckout>` monté inline | `clientSecret` |
| **PayTabs** | iFrame Mode (`framed`, `framed_message_target`) | Page hébergée dans une `<iframe>` + `postMessage` JS | une **redirect URL** (iframée) |
| **CMI** | « CMI Pay » iFrame (à demander à l'onboarding) | Page hébergée dans une `<iframe>`, branding conservé | une **redirect URL** (iframée) |
| **PayZone** | Formulaire en iframe sécurisée | Page/form hébergé dans une `<iframe>` | une **redirect URL** (iframée) |
| **PayPal / Braintree** | Card Fields / Hosted Fields (SDK JS v6) | iframes **au niveau des champs** + flux `createOrder → token → capture` | token / orderId (flux 2-temps) |

**Conclusion** : le `clientSecret` est **spécifique à Stripe**. Les PSP régionaux
(PayZone/CMI/PayTabs) font de l'« embedded » en **iframant leur redirect URL**.
PayPal introduit un flux **2-temps** (champs hébergés → token → capture).

## 2. Le piège d'archi évité

Déduire le rendu de « `clientSecret != null` » (ou du type de provider) côté front
casserait dès qu'on branche l'iframe régional (pas de clientSecret) ou PayPal.

**Décision : le `PaymentResult` est auto-descriptif.** Il porte un
`PaymentPresentationMode` que le front lit tel quel — le contrat front/back ne
change plus quand un provider ajoute un mode in-page.

```
enum PaymentPresentationMode { REDIRECT, IFRAME, CLIENT_SECRET, HOSTED_FIELDS }
```

| Mode | Front fait… | Champ porteur | Providers |
|---|---|---|---|
| `REDIRECT` | navigation pleine page | `redirectUrl` | tous (fallback universel) |
| `IFRAME` | rend `redirectUrl` dans une `<iframe>` + écoute `postMessage` | `redirectUrl` | PayTabs, CMI, PayZone |
| `CLIENT_SECRET` | monte le composant JS du provider | `clientSecret` (+ `providerType`) | Stripe |
| `HOSTED_FIELDS` | monte le SDK champ-par-champ, collecte un token | `clientSecret`/token (+ `providerType`) | PayPal, Braintree (futur) |

Factories : `PaymentResult.success(...)` → `REDIRECT` ; `.iframe(...)` → `IFRAME` ;
`.embedded(...)` → `CLIENT_SECRET`. (`HOSTED_FIELDS` réservé, non câblé.)

## 3. Ce qui est déjà en place (n'exige PAS de rework)

- **Capacité** `PaymentCapability.EMBEDDED_CHECKOUT` = « le provider sait faire du
  in-page ». Déclarée par Stripe aujourd'hui. Le resolver capability-aware
  (`requiredCapabilities`) route les flux `embedded=true` vers un provider capable.
- **Requête** : `PaymentOrchestrationRequest`/`PaymentRequest` portent déjà
  `embedded`, `expiresAtEpochSeconds`, `saveCardForFutureUse`.
- **Réponse** : `PaymentResult` porte `redirectUrl`, `clientSecret`,
  `presentationMode`. Le endpoint booking checkout renvoie `presentationMode` +
  le champ pertinent (null-safe).

## 4. Roadmap d'ajout d'un PSP régional en embedded (sans toucher au port)

Pour brancher, p.ex., **PayTabs framed** plus tard :

1. Adapter `PayTabsPaymentProvider.createPayment` : si `request.embedded()`, créer
   la paypage en mode `framed`/`framed_message_target` et renvoyer
   `PaymentResult.iframe(providerTxId, redirectUrl)`.
2. Déclarer `EMBEDDED_CHECKOUT` dans `getCapabilities()` de l'adaptateur.
3. Front booking engine : gérer `presentationMode == "IFRAME"` (monter une
   `<iframe src=redirectUrl>` + écouter le `postMessage` de complétion). **C'est le
   seul travail front** — et il est fait une fois pour tous les PSP iframe.
4. Rien à changer dans l'orchestrateur, le port, ni la complétion : le resolver
   inclura automatiquement PayTabs pour un flux embedded en devise/pays compatibles.

> Contrainte technique iframe : le provider doit autoriser le framing
> (`X-Frame-Options`/CSP `frame-ancestors`). PayTabs/CMI/PayZone l'autorisent
> explicitement en mode framed ; à valider en sandbox à l'onboarding.

## 5. Cas PayPal (flux 2-temps) — la seule vraie extension future

`HOSTED_FIELDS` implique un flux `createOrder → token client → capture` qui ne
tient pas dans le « un appel `createPayment` renvoie une URL/secret ». Deux options
le moment venu, **sans casser l'existant** :

- **Option simple** : utiliser le flux PayPal **redirect/popup** (Smart Buttons) →
  rentre dans `REDIRECT`, zéro extension.
- **Option champs hébergés** : ajouter au port une étape `confirmPayment(token)`
  (capture côté serveur) + `HOSTED_FIELDS`. Extension **additive** (nouvelle
  méthode d'interface avec `default`), pas un rework.

## 6. Invariant

Le front ne doit **jamais** brancher sur le type de provider ni sur la présence
d'un `clientSecret` : **toujours** sur `presentationMode`. Tout nouveau mode in-page
= une valeur d'enum + un adaptateur qui la renvoie + un bout de rendu front. Le
contrat du port reste stable.

## 7. Flux Stripe-only **par nature** (hors port multi-provider, intentionnel)

Certains flux n'ont **aucun analogue PSP** : les router via le port multi-provider
n'apporterait aucun bénéfice et y ferait fuiter des concepts Stripe. Ils restent
**Stripe-direct assumés** (même statut que la caution, décision D3 de l'ADR) :

| Flux | Pourquoi Stripe-only | Traitement |
|---|---|---|
| **Caution / dépôt de garantie** | Pré-autorisation + capture manuelle + carte enregistrée off-session (PREAUTH + CUSTOMER) ; PSP régionaux ne l'exposent pas (D3). | Stripe-direct (`BookingEngineDepositService`, `SecurityDepositPaymentService`) ; capability-gated côté port pour le checkout séjour. |
| **Payment Sheet mobile** | Assemble `Customer` + **EphemeralKey** + `PaymentIntent`/`Subscription` + `publishableKey` pour le SDK Stripe React Native. L'EphemeralKey et le Payment Sheet sont **spécifiques au SDK mobile Stripe** ; aucun équivalent PayZone/CMI/PayTabs (redirect/iframe web uniquement). La variante `subscription` relève par ailleurs de la Vague 3 (récurrent). | Stripe-direct (`MobilePaymentService`). **Ne PAS forcer dans le port** : ce serait une méthode Stripe-only sans valeur multi-provider. |
| **Livraison de biens physiques (shop)** | La collecte d'adresse de livraison **et** sa relecture à la complétion (`session.getShippingDetails()`) sont Stripe-spécifiques. | Migré via le port (create-side orchestré + champ `shippingAddressCountries`) mais **provider épinglé Stripe** (`preferredProvider=STRIPE`). Relaxable si un PSP expose un jour la collecte d'adresse. |
| **Versement ménage** (Vague 4) | `HousekeeperPayoutConfig` ne porte que `stripeAccountId` : mono-rail Stripe Connect **par design** (contrairement aux payouts propriétaire, multi-rail via `PayoutExecutor`). | Reste Stripe Connect ; l'appel `Transfer` est extrait dans l'adaptateur partagé `StripeConnectTransferClient` (plus de types Stripe dans le service). Multi-rail ménage (Manual MA) = décision produit + extension `HousekeeperPayoutConfig`, non faite. |

> Règle : un flux « Stripe-only par nature » passe le port **uniquement** si l'appel
> Stripe se déplace dans l'adaptateur `StripeProvider` sans introduire d'abstraction
> multi-provider factice. Sinon il reste Stripe-direct assumé et **documenté ici**.
> Objectif ADR « plus aucun Stripe direct hors adaptateurs » = pour l'**entrant
> multi-provider** ; ces flux Stripe-only en sont l'exception explicite.
