# Système de paiement multi-fournisseurs — documentation métier

> Document de référence **métier + architecture** du système de paiement Baitly.
> Compagnons techniques : [ADR-paiement-multi-provider.md](ADR-paiement-multi-provider.md)
> (décisions), [PAIEMENT-MODES-INTEGRATION-EMBEDDED.md](PAIEMENT-MODES-INTEGRATION-EMBEDDED.md)
> (modes d'intégration et frontières Stripe-only), [PAIEMENT-VAGUE2-RUNBOOK.md](PAIEMENT-VAGUE2-RUNBOOK.md)
> (méthode de migration). Dernière mise à jour : 2026-07-13, après exécution des vagues 1 à 5.

---

## 1. Pourquoi ce système existe

Baitly encaisse et reverse de l'argent dans **plusieurs juridictions**. Le lancement
commercial est **Maroc d'abord**, or **Stripe n'opère pas au Maroc**. Le système doit donc :

- faire cohabiter **Stripe** (international : EUR, USD…) et des **PSP régionaux**
  (PayZone / CMI au Maroc, PayTabs en Arabie Saoudite) **en parallèle** — une même
  organisation peut encaisser des EUR via Stripe **et** des MAD via un PSP local ;
- pouvoir **switcher** de fournisseur selon l'organisation, le pays, la devise et le
  type d'opération, **sans réécrire les flux métier** ;
- garantir les invariants **money-safety** (le serveur fixe les montants, aucun appel
  externe dans une transaction DB, idempotence partout).

## 2. Vue d'ensemble en langage métier

Le système sait faire **quatre choses**, chacune derrière une abstraction (« port ») :

| Besoin métier | Port | Fournisseurs branchés |
|---|---|---|
| **Encaisser un paiement one-shot** (séjour, solde, intervention, upsell, matériel, crédits IA…) | `PaymentProvider` (entrant) | Stripe, PayZone, CMI, PayTabs (PayPal prévu) |
| **Abonner un client** (abonnement SaaS récurrent : inscription, upgrade) | `SubscriptionProvider` | Stripe Billing (PayZone récurrent prévu pour le Maroc) |
| **Reverser de l'argent** (payout propriétaire, versement ménage) | `PayoutExecutor` (sortant) | Stripe Connect, SEPA, Wise, Open Banking, **Manual** (= « versé hors plateforme, tracé » — le rail Maroc au lancement) |
| **Poser une caution** (pré-autorisation à capture manuelle) | *(pas de port — Stripe direct, décision D3)* | Stripe uniquement |

Un **orchestrateur** (`PaymentOrchestrationService`) choisit le bon fournisseur pour
chaque encaissement, trace tout dans un **livre de comptes** (`PaymentTransaction`,
le « ledger ») et publie des **événements** qui déclenchent la mise à jour des objets
métier (réservation payée, intervention payée, crédits IA crédités…).

## 3. Architecture

```
Flux métier (booking · résa · différé · solde · SR · upsell · shop · crédits IA · abonnement)
        │        (plus AUCUN appel Stripe direct dans ces flux)
        ▼
┌──────────────── PaymentOrchestrationService ─────────────────┐
│ 1. idempotence (clé de lot → même session si double-clic)    │
│ 2. résolution : préféré → CAPACITÉS → devise → pays → Stripe │
│ 3. persist PENDING (tx courte)                               │
│ 4. appel provider — HORS transaction DB                      │
│ 5. persist résultat + event outbox (tx courte, atomique)     │
└───────┬──────────────────┬─────────────────┬─────────────────┘
   PaymentProvider   SubscriptionProvider   PayoutExecutor
   Stripe·PayZone·   StripeBilling          StripeConnect·SEPA·
   CMI·PayTabs       (PayZone récurrent à   Wise·OpenBanking·
                      venir)                Manual
        │
        ▼  (session de paiement : URL de redirection, clientSecret ou iframe)
   Le client paie chez le fournisseur
        │
        ▼  webhook (signé) : Stripe → StripeWebhookController /api/webhooks/stripe
        │                    PSP    → PaymentWebhookRouter    /api/webhooks/payments/{psp}
        ▼
   completeTransaction(transactionRef)  ──►  ledger COMPLETED
        │                                        │
        │                                        ▼  outbox → Kafka TOPIC_PAYMENT_EVENTS
        │                                   event PAYMENT_COMPLETED {sourceType, sourceId}
        │                                        │
        │                                        ▼
        │                              PaymentEventConsumer (provider-agnostique)
        │                              dispatch par sourceType → services de réconciliation
        │                              (entité métier PROCESSING → PAID + ledger wallets
        │                               + split + facture + notifications) — idempotent
        ▼
   (flux legacy non migrés : dispatch direct par metadata `type` dans le webhook Stripe)
```

**Le principe clé** : la complétion d'un paiement est **provider-agnostique**. Quel que
soit le fournisseur qui a encaissé, le webhook complète le **ledger**, le ledger publie
`PAYMENT_COMPLETED`, et un **consumer unique** réconcilie l'objet métier par
`(sourceType, sourceId)`. Ajouter un fournisseur ne change **rien** à la réconciliation.

## 4. Cycle de vie d'un paiement (exemple : solde d'acompte)

1. Le voyageur clique « payer le solde » → `BookingBalanceService` recalcule le montant
   **côté serveur** (`amountDue` de la réservation, jamais le montant envoyé par le client).
2. L'orchestrateur résout le fournisseur : réservation en MAD + PayZone actif → PayZone ;
   sinon Stripe. Une ligne `PaymentTransaction` est créée (`sourceType=BOOKING_BALANCE`,
   `sourceId=<id résa>`, statut PENDING → PROCESSING).
3. Le voyageur paie sur la page du fournisseur.
4. Le fournisseur notifie par **webhook signé** → `completeTransaction` → ledger COMPLETED
   → event `PAYMENT_COMPLETED`.
5. Le consumer route `BOOKING_BALANCE` → la réservation passe PARTIALLY_PAID → PAID,
   ledger/facture/emails suivent. **Idempotent** : une re-livraison du webhook ou un
   retry Kafka ne produit jamais un double crédit.

## 5. Flux métier et leur statut

| Flux | sourceType | Mode | Multi-fournisseur ? | Réconciliation |
|---|---|---|---|---|
| Paiement différé groupé (host) | `DEFERRED_INTERVENTIONS_HOST` | hébergé | ✅ (devise du lot) | consumer |
| Paiement différé groupé (logement) | `DEFERRED_INTERVENTIONS_PROPERTY` | hébergé | ✅ | consumer |
| Lien de paiement réservation | `RESERVATION` | hébergé | ✅ (devise résa) | consumer |
| Solde d'acompte booking | `BOOKING_BALANCE` | hébergé | ✅ (devise résa + pays propriété) | consumer |
| Checkout séjour booking | `BOOKING_CHECKOUT` | **embarqué** | ⚠️ capability-gated (embedded = Stripe aujourd'hui) | webhook legacy (Session : hold/acompte/caution) |
| Intervention unitaire | `INTERVENTION` | hébergé (embarqué encore Stripe-direct) | ✅ pour l'hébergé | webhook legacy (`findByStripeSessionId`) |
| Demande de service | `SERVICE_REQUEST` | hébergé + embarqué | ✅ / ⚠️ embedded | consumer |
| Upsell livret / booking | `UPSELL` | embarqué / hébergé | ⚠️ / ✅ | consumer |
| Crédits IA | `AI_CREDIT_TOPUP` | hébergé | ✅ | consumer |
| Shop matériel IoT | `HARDWARE_ORDER` | hébergé | ⚠️ capability-gated (`SHIPPING_ADDRESS`) | webhook legacy (relit l'adresse de livraison) |
| Inscription (abonnement) | *(port abonnement)* | embarqué + coupon | ⚠️ Stripe Billing seul aujourd'hui | webhook `type=inscription` |
| Upgrade forfait (abonnement) | *(port abonnement)* | hébergé | ⚠️ Stripe Billing seul aujourd'hui | webhook `type=upgrade` |
| Payout propriétaire | *(port sortant)* | — | ✅ multi-rail (dont Manual MA) | `PayoutExecutionService` |
| Versement ménage | *(adaptateur partagé)* | — | ❌ Stripe Connect par design | `HousekeeperPayoutRecorder` (CAS) |
| Caution / dépôt de garantie | — | pré-auth off-session | ❌ Stripe par décision **D3** | webhook Stripe |
| Payment Sheet mobile | — | PaymentIntent + EphemeralKey | ❌ Stripe-mobile-SDK | webhook `payment_intent.succeeded` |

Légende : ✅ = le fournisseur est résolu dynamiquement (devise/pays/config org).
⚠️ = passe par le port mais une **capacité** restreint aux fournisseurs capables
(aujourd'hui Stripe seul la déclare). ❌ = Stripe assumé, voir §7.

## 6. Capacités et résolution du fournisseur

### 6.1 Matrice des capacités (déclarées par chaque adaptateur)

| Capacité | Stripe | PayZone | CMI | PayTabs | Signification métier |
|---|---|---|---|---|---|
| `PAY` | ✅ | ✅ | ✅ | ✅ | encaisser un paiement one-shot |
| `REFUND` | ✅ | ✅ | ❌¹ | ✅ | rembourser via le port (API) |
| `PREAUTH` | ✅ | — | — | — | caution (pré-autorisation, capture différée) |
| `CUSTOMER` | ✅ | — | — | — | carte enregistrée (off-session) |
| `PAYOUT` | ✅ | — | — | — | reversement via le provider |
| `EMBEDDED_CHECKOUT` | ✅ | — | — | — | checkout inline (clientSecret) |
| `SHIPPING_ADDRESS` | ✅ | — | — | — | collecte d'adresse de livraison |
| `RECURRING` | ✅ (Billing) | *(prévu)* | — | — | abonnement récurrent |

> ¹ **CMI ne rembourse pas via le port** : les remboursements CMI se font
> manuellement au back-office marchand (pas d'API de refund). L'adaptateur ne
> déclare donc pas `REFUND` (honnêteté des capacités). Un remboursement d'une
> transaction CMI renvoie un échec explicite invitant à l'opération manuelle.
> Voir le [runbook de certification](PAIEMENT-CERTIFICATION-PSP-RUNBOOK.md).

### 6.2 Règles de résolution (dans l'ordre)

1. **Préférence explicite** du flux (`preferredProvider`) — rarissime, à éviter.
2. **Capacités requises** : dérivées automatiquement de la requête
   (embarqué → `EMBEDDED_CHECKOUT` ; carte enregistrée → `CUSTOMER` ;
   adresse de livraison → `SHIPPING_ADDRESS`). Un fournisseur incapable est
   **écarté**, même s'il matche la devise.
3. **Devise** : MAD → CMI puis PayZone ; SAR → PayTabs (si activés pour l'org).
4. **Pays** : premier fournisseur activé pour le pays de l'org.
5. **Repli Stripe** (couvre toutes les capacités).

> **Anti-enfermement (règle d'or)** : un flux ne doit **jamais** épingler un
> fournisseur en dur (`preferredProvider=STRIPE`) pour obtenir une fonctionnalité —
> il doit **demander la capacité**. Exemple : le shop demande `SHIPPING_ADDRESS` ;
> aujourd'hui seul Stripe la déclare, donc Stripe est résolu ; le jour où PayZone
> expose la collecte d'adresse, **une seule ligne** (déclarer la capacité dans son
> adaptateur) suffit pour que le shop devienne multi-fournisseurs. Aucun flux métier
> à retoucher.

### 6.3 Configuration par organisation

`PaymentMethodConfig` (écran Réglages → Paiements) : chaque org active ses
fournisseurs (enabled, sandbox, clés **chiffrées**, pays). Plusieurs fournisseurs
actifs en parallèle — la devise de la transaction tranche.

## 7. Exceptions Stripe-only : pourquoi, risques, chemins de déblocage

Certains flux restent liés à Stripe. **Ce n'est pas un oubli** : chaque cas est une
décision documentée, avec son degré de réversibilité et son chemin de sortie.

### 7.1 Trois degrés de liaison à Stripe

| Degré | Flux | Mécanisme de sortie |
|---|---|---|
| **Capability-gated** (le port est prêt, la contrainte est déclarative) | checkout séjour (embedded), SR/upsell embedded, shop (shipping) | Déclarer la capacité dans l'adaptateur du PSP le jour où il l'expose (+ rendu front `presentationMode=IFRAME` pour l'embedded, fait une fois pour tous les PSP). **Zéro modification des flux métier.** |
| **Décision produit révocable** | caution (D3), versement ménage mono-rail, abonnement Stripe Billing seul | Caution : la capacité `PREAUTH` existe déjà dans l'enum — migrer les services caution derrière l'orchestrateur quand un PSP la déclarera (ou tenir la caution « empreinte manuelle » au Maroc, comme décidé). Ménage : ajouter `payoutMethod` à `HousekeeperPayoutConfig` et réutiliser le `PayoutExecutorRegistry` existant (Manual pour le Maroc) — le rail est déjà construit. Abonnement : implémenter `PayzoneSubscriptionProvider` et étendre `SubscriptionProviderRegistry.resolve(currency)` (MAD → PayZone). |
| **Structurellement Stripe** | Payment Sheet mobile (EphemeralKey + PaymentIntent = SDK Stripe) | Pas de « déblocage » : pour une org PSP-only, le mobile bascule sur le **checkout hébergé** (webview/redirect) via l'orchestrateur — le Payment Sheet reste un confort réservé aux orgs Stripe. À traiter côté app mobile le moment venu. |

### 7.2 Ce qui protège contre l'enfermement (déjà en place)

- **`PaymentResult.presentationMode`** : le front branche sur `REDIRECT / IFRAME /
  CLIENT_SECRET / HOSTED_FIELDS`, jamais sur le type de fournisseur ni sur la
  présence d'un `clientSecret`. Les modes in-page des PSP (iframe) s'ajoutent sans
  changer le contrat front/back.
- **Réconciliation par ledger** : aucune entité métier n'est retrouvée « par un
  identifiant Stripe » dans les flux migrés — le couple `(sourceType, sourceId)` du
  ledger est neutre. (Le champ historique `stripeSessionId` stocke désormais un
  `providerTxId` générique ; son renommage en colonne `provider_session_id` est un
  chantier cosmétique possible, non bloquant.)
- **Capacités déclaratives** : toute fonctionnalité différenciante est une valeur
  d'enum + une déclaration d'adaptateur, pas un `if (provider == STRIPE)`.
- **Adaptateurs uniques** : tout appel SDK Stripe vit dans `payment/**` (providers,
  gateway, transfer client, billing) — les services métier n'importent plus les
  types Stripe, sauf les trois flux « structurellement Stripe » listés ci-dessus
  et les webhooks (qui parsent par nature le format de chaque fournisseur).

### 7.3 Ce qu'il resterait à faire pour un déblocage complet (backlog ordonné)

1. **Certification sandbox PayZone/CMI/PayTabs** (Vague 6 de l'ADR) — préalable à tout.
2. **Rendu front `IFRAME`** dans le booking engine (une fois, pour tous les PSP).
3. **`PayzoneSubscriptionProvider`** (abonnement MAD) si le self-serve Maroc l'exige.
4. **Multi-rail ménage** (Manual MA) — décision produit + extension de config.
5. **Fallback mobile hébergé** pour les orgs PSP-only.
6. Migration de la variante embedded de l'intervention unitaire (incohérence mineure :
   sa jumelle hébergée est orchestrée) et du lien de paiement B3 template-driven.

## 8. Invariants money-safety (non négociables)

1. **Le serveur fixe le montant** — recalculé depuis l'entité métier (devis, coût
   estimé, solde dû, catalogue) ; un montant client n'est au mieux qu'un cross-check.
2. **Aucun appel externe dans une transaction DB** — préparation en tx courte →
   appel fournisseur hors tx → persistance du résultat en tx courte ; effets externes
   post-commit.
3. **Idempotence de bout en bout** — clé d'idempotence stable à la création (une par
   lot/entité) ; complétion et réconciliation idempotentes (early-return + transition
   CAS) ; re-livraison webhook et retry Kafka sans double effet.
4. **Pas de `catch (Exception)` avaleur** — un échec de réconciliation part en
   retry/DLT Kafka ou lève une alerte de réconciliation admin explicite.
5. **Conversions monétaires** — `StripeAmounts.toMinorUnits` (HALF_UP, jamais de
   troncature) ; `BigDecimal.compareTo`, jamais `equals`.
6. **Webhooks signés** — signature vérifiée avant tout traitement (Stripe-Signature,
   HMAC PayTabs/PayZone, HASH SHA-512 CMI), secrets par organisation.

## 9. Ajouter un nouveau fournisseur d'encaissement (checklist)

1. Créer l'adaptateur `XxxPaymentProvider implements PaymentProvider` dans
   `payment/provider/` : `createPayment` (et `refundPayment`), pays/devises supportés,
   **capacités déclarées honnêtement** (ne déclarer que ce qui est réellement supporté).
2. Renvoyer un `PaymentResult` avec le bon `presentationMode`
   (`success()` = redirect, `iframe()` = page iframée, `embedded()` = clientSecret).
3. Ajouter la valeur à `PaymentProviderType` + l'endpoint webhook dans
   `PaymentWebhookRouter` (vérification de signature → `completeTransaction` /
   `failTransaction`). Whitelister l'endpoint dans `SecurityConfigProd`.
4. Si devise régionale forte : l'ajouter à `preferredProvidersForCurrency`.
5. Config org : activer le provider dans `PaymentMethodConfig` (clés chiffrées, sandbox).
6. Certification sandbox (paiement + refund + webhook + montants exacts) avant prod.
7. **Rien d'autre** : ni l'orchestrateur, ni les flux métier, ni la réconciliation
   ne changent.

## 9 bis. Reversements mensuels & mandat SEPA (payouts)

Baitly reverse chaque mois aux propriétaires/gestionnaires leur part nette. Ces
reversements passent par le **port sortant `PayoutExecutor`** (rails `StripeConnect`,
`SEPA`, `Wise`, `OpenBanking`, `Manual`). Pour automatiser des virements récurrents
sans re-saisie d'IBAN, on privilégie un PSP (ou une banque partenaire) capable de :

- enregistrer un **mandat SEPA** (SEPA Direct Debit/Credit, référence unique UMR + IBAN) — zone euro ;
- déclencher des **virements récurrents** par API, **idempotents**, avec référence marchande restituée ;
- hors SEPA (Maroc) : un **virement bancaire** adossé à une banque partenaire, avec export de règlement rapprochable ;
- notifier l'**issue du payout** (exécuté / rejeté / retourné) pour la réconciliation + alerte admin.

Un nouveau rail de payout se branche via le `PayoutExecutorRegistry` **sans toucher les
flux métier**. Détail des exigences (E2.5) et démarchage **par pays** : voir le dossier
`analyse-concurrentielle/pdf/paiement-multi-fournisseurs-dossier.pdf`.

## 9 ter. Alternatives full-stack à Stripe (3 ports + caution)

Les adaptateurs régionaux intégrés (PayZone/CMI/PayTabs) ne font que l'**encaissement**
(`PAY`/`REFUND`). Pour couvrir les **trois ports + caution** avec un autre fournisseur que
Stripe, trois PSP **full-stack** sont éligibles — chacun se branche via **un seul adaptateur**
qui déclarerait le même jeu de capacités que Stripe (`PAY`, `PREAUTH`, `CUSTOMER`, `PAYOUT`,
`RECURRING`, `REFUND`), **sans modifier les flux métier** :

- **Checkout.com** — full-stack, forte présence MENA/Golfe, règlement en MAD, onboarding
  accessible à une startup. **Candidat recommandé** pour le contexte Baitly.
- **Rapyd** — full-stack (Collect + Disburse + Wallet + payouts récurrents), fort sur les
  marchés émergents ; caution partielle (hold via wallet).
- **Adyen** — full-stack complet mais **enterprise-only** (seuils de volume élevés) → à l'échelle.

> **Nuance Maroc** : même un PSP full-stack ne remplace pas totalement l'acquiring **local
> carte MAD** (dominé par CMI). D'où la cible **multi-fournisseur** : un PSP full-stack
> (international + abonnement + payout + caution) **en parallèle** d'un acquéreur local
> (CMI/PayZone). Baitly n'est donc **pas verrouillé sur Stripe**. Comparatif détaillé
> (capacités, éligibilité, couverture Maroc) : §16 du dossier PDF.

## 10. Glossaire

| Terme | Définition |
|---|---|
| **Port** | Interface qui isole le métier d'une famille de fournisseurs (entrant, abonnement, sortant). |
| **Adaptateur** | Implémentation d'un port pour un fournisseur donné (seul endroit qui parle son SDK/API). |
| **Orchestrateur** | Service qui résout le fournisseur, trace le ledger et séquence les transactions courtes. |
| **Ledger (`PaymentTransaction`)** | Livre de comptes interne : une ligne par tentative de paiement, avec `transactionRef` (notre référence), `providerTxId` (référence fournisseur), `sourceType`/`sourceId` (l'objet métier payé). |
| **sourceType / sourceId** | Le « pour quoi » du paiement (ex. `BOOKING_BALANCE` / id de réservation) — clé de réconciliation neutre. |
| **Outbox** | Table relais : les événements sont écrits en base dans la même transaction que le ledger, puis publiés sur Kafka (livraison at-least-once). ⚠️ le relais ne publie que le payload → `eventType` doit être DANS le payload. |
| **Consumer `PAYMENT_COMPLETED`** | Le réconciliateur unique : route par `sourceType` vers le service qui passe l'entité en PAID. |
| **Capacité (`PaymentCapability`)** | Fonctionnalité déclarée par un adaptateur (PAY, PREAUTH, EMBEDDED_CHECKOUT, SHIPPING_ADDRESS…) ; le resolver écarte les fournisseurs incapables. |
| **`presentationMode`** | Comment le front doit afficher le checkout (REDIRECT / IFRAME / CLIENT_SECRET / HOSTED_FIELDS) — jamais déduit du fournisseur. |
| **Capability-gated** | Flux dont la contrainte fournisseur est exprimée par une capacité (réversible par simple déclaration), par opposition à un épinglage en dur (interdit). |
| **Idempotency key** | Clé stable par lot/entité qui neutralise les doubles créations (double-clic, retry réseau). |
| **CAS (compare-and-set)** | Transition de statut par UPDATE conditionnel — anti double-crédit en cas de re-livraison. |
| **D1 / D3** | Décisions de l'ADR : D1 = port abonnement dédié ; D3 = caution Stripe-only (empreinte manuelle au Maroc au lancement). |
