# Runbook — Vague 2 : migration des flux « payer un total » vers l'orchestration

> Compagnon de [ADR-paiement-multi-provider.md](ADR-paiement-multi-provider.md). À exécuter en **session dédiée money-path** (E2E Stripe test-mode requis). Prérequis : Vague 1 en place (`PaymentCapability`, `PaymentPersistence`, orchestrateur non-transactionnel — commit `55eee043`).

## 1. Objectif & périmètre

Router les flux de **paiement d'un total en checkout hébergé** à travers `PaymentOrchestrationService.initiatePayment` (au lieu d'appeler Stripe en direct), pour qu'ils deviennent **multi-provider** (Stripe / PayZone / CMI selon org+devise).

**À migrer** (vrais flux « payer un total ») :
| Flux | Fichier | Entité réconciliée |
|---|---|---|
| Paiement différé host (interventions impayées) | `DeferredPaymentService` | `Intervention` (PROCESSING→PAID) |
| Paiement de réservation | `ReservationPaymentService` | `Reservation` |
| Checkout booking engine (séjour) | `booking/controller/BookingCheckoutController` | `Reservation` / booking |
| Solde booking engine | `booking/service/BookingBalanceService` | `Reservation` |

**EXCLUS (Stripe-only, décision D3 de l'ADR) :** `BookingEngineDepositService`, `SecurityDepositPaymentService` — caution = hold off-session à capture manuelle (`capture_method=MANUAL`) sur carte enregistrée → capacités **PREAUTH + CUSTOMER** que seul Stripe déclare. Ne PAS migrer ; laisser en direct Stripe (capability-gated).

**Ordre recommandé** (risque croissant) : `DeferredPaymentService` (host-facing) → `ReservationPaymentService` → `BookingCheckoutController` → `BookingBalanceService`.

## 2. Le mécanisme clé : réconciliation via le ledger, pas via `stripeSessionId`

Aujourd'hui, chaque flux stocke le `stripeSessionId` sur l'entité (ex. `Intervention.stripeSessionId`) et le webhook Stripe retrouve l'entité par ce champ. **C'est ce couplage à Stripe qu'il faut retirer.**

**L'orchestration porte déjà la solution :** `PaymentTransaction` stocke `sourceType` + `sourceId`, et l'outbox publie `PAYMENT_COMPLETED` (Kafka `TOPIC_PAYMENT_EVENTS`) avec ces champs. Donc :

- **Create-side** : le flux appelle `initiatePayment(request)` avec `sourceType` (ex. `"DEFERRED_INTERVENTIONS"`) + `sourceId` (ex. hostId) + les IDs métier en metadata. Le ledger `PaymentTransaction` devient la source de vérité.
- **Completion** : un **consumer de `PAYMENT_COMPLETED`** (provider-agnostique) réconcilie l'entité via `(sourceType, sourceId)` → passe les interventions PROCESSING→PAID. Plus de dépendance à `stripeSessionId` ni au webhook Stripe spécifique.
- **Multi-provider** : `PaymentWebhookRouter` (déjà existant) reçoit les webhooks Stripe **ET** PayZone/CMI, appelle `completeTransaction(transactionRef)` → l'outbox publie `PAYMENT_COMPLETED` → le même consumer réconcilie. **Un seul chemin de réconciliation pour tous les providers.**

> C'est l'étape structurante de la Vague 2 : introduire (ou compléter) le **consumer `PAYMENT_COMPLETED` → réconciliation par `sourceType`/`sourceId`**. Une fois en place, chaque flux se migre en changeant seulement le create-side.

## 3. Recette par flux (répétable)

1. **Caractérisation (avant)** : lister les tests existants du flux + le handler webhook actuel + comment la complétion mute l'entité. Écrire un test qui capture le comportement de bout en bout (create → completion → entité PAID) s'il n'existe pas.
2. **Create-side** : remplacer `Session.create` / `stripeGateway.createSession(...)` par la construction d'un `PaymentOrchestrationRequest` (montant recalculé serveur, `sourceType`/`sourceId`, metadata IDs, success/cancel URLs, `idempotencyKey` = la clé de lot existante) → `paymentOrchestrationService.initiatePayment(...)` → renvoyer `result.paymentResult().redirectUrl()`.
3. **Marquage PROCESSING** : conserver le marquage de l'entité en `PROCESSING` (transaction courte dédiée, déjà en place via `TransactionTemplate`), mais stocker le **`transactionRef`** du ledger (pas le `stripeSessionId`).
4. **Completion** : brancher/étendre le consumer `PAYMENT_COMPLETED` pour ce `sourceType` → réconcilier l'entité (PROCESSING→PAID). Retirer la réconciliation par `stripeSessionId` du webhook Stripe direct.
5. **Vérification** : `mvn package` (caractérisation verte) → **E2E Stripe test-mode** (créer session → carte test `4242…` → webhook → entité PAID) → **idéalement E2E PayZone sandbox** pour prouver le multi-provider.
6. **Nettoyage** : supprimer le code Stripe direct devenu mort (grep exhaustif des références avant suppression). Retirer le champ `stripeSessionId` de l'entité **seulement** quand tous ses flux sont migrés (migration Liquibase dédiée si colonne à dropper).

## 4. Prérequis E2E (à préparer avant la session dédiée)

- **Env dev up** (Docker) + **clés Stripe test-mode** configurées.
- **Org de test** avec `PaymentMethodConfig` : Stripe enabled ; idéalement une 2ᵉ org avec PayZone sandbox enabled (pour prouver le switch MAD).
- **Webhook endpoint** accessible (tunnel type Stripe CLI `stripe listen` → `/api/webhooks/payments/stripe`).
- Jeu de données : un host avec interventions impayées (flux Deferred), une réservation à payer.
- **Cartes test** : `4242 4242 4242 4242` (succès), `4000 0000 0000 0002` (refus).

## 5. Garde-fous money-safety (rappel ADR — non négociables)

- Le **serveur recalcule** toujours le montant depuis l'entité (jamais le montant client).
- **Aucun appel externe dans une transaction DB** (déjà garanti par l'orchestration Vague 1).
- Transitions d'état de paiement en **CAS / UPDATE conditionnel** (anti double-crédit sur re-livraison webhook) — le consumer de réconciliation doit être **idempotent**.
- Pas de `catch(Exception)` avaleur : un échec de réconciliation → statut explicite + notification admin.
- Idempotency key sur `initiatePayment` = la clé de lot stable existante.

## 6. Definition of Done (par flux)

- [ ] Create-side passe par `initiatePayment` ; plus d'appel Stripe direct dans le flux.
- [ ] Complétion réconciliée via `PAYMENT_COMPLETED` (`sourceType`/`sourceId`), idempotente.
- [ ] Fonctionne pour Stripe **et** au moins un PSP régional (webhook provider-agnostique).
- [ ] Caractérisation verte + `mvn package` complet vert.
- [ ] E2E Stripe test-mode passant (create → carte test → entité PAID).
- [ ] Code Stripe direct mort supprimé (preuve par grep).

---

*Une fois les 4 flux migrés, seuls les adaptateurs (`payment/provider/*`) et les flux caution (Stripe-only) référencent Stripe directement — objectif « plus aucun Stripe direct hors adaptateurs » de l'ADR atteint pour l'entrant.*
