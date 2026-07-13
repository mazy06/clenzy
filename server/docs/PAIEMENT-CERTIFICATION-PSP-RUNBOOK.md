# Runbook de certification des PSP régionaux (Vague 6)

> Document **interne / dev-facing** : la procédure pour certifier un adaptateur PSP
> régional (PayZone, CMI, PayTabs) contre son **sandbox réel** avant activation en
> production. Complète la doc métier [PAIEMENT-SYSTEME-MULTI-FOURNISSEURS.md](PAIEMENT-SYSTEME-MULTI-FOURNISSEURS.md)
> (architecture) et l'[ADR](ADR-paiement-multi-provider.md) (Vague 6). Dernière mise à jour : 2026-07-13.

---

## 0. Pourquoi ce runbook / ce qui bloque la certification

Le code des trois adaptateurs (`PayzonePaymentProvider`, `CmiPaymentProvider`,
`PayTabsPaymentProvider`) est **structurellement complet et audité** (voir §4). Ce qui
manque pour « adaptateurs régionaux prouvés » (sortie attendue de la Vague 6 de l'ADR)
est un **onboarding marchand réel** chez chaque PSP :

- des **identifiants sandbox** (API key / store key / server key selon le PSP) ;
- la **confirmation des specs exactes** (noms de champs, format de montant, entêtes de
  signature) — plusieurs sont notés « à confirmer à l'onboarding » dans le code ;
- un **environnement qui tourne** (backend + tunnel HTTPS public pour recevoir les
  webhooks / IPN / callbacks CMI).

Ces trois éléments dépendent d'un délai externe (l'ADR le note explicitement) et ne
peuvent pas être obtenus en autonomie. Ce runbook rend la certification **exécutable
d'un bloc** dès qu'ils sont disponibles.

## 1. Pré-requis

| # | Élément | Détail |
|---|---|---|
| 1 | Compte marchand sandbox | Un par PSP (PayZone, CMI, PayTabs). CMI exige un NDA + délai ; PayZone/PayTabs plus rapides. |
| 2 | Identifiants | PayZone : `api_key` (+ `webhook_secret`). CMI : `client_id` + `store_key`. PayTabs : `profile_id` + `server_key`. |
| 3 | Config en base | Renseigner ces clés (chiffrées) dans `PaymentMethodConfig` de l'org de test via l'écran Réglages → Paiements (`sandbox = true`, `enabled = true`). |
| 4 | Tunnel HTTPS public | Pour recevoir les notifications : `ngrok`/`cloudflared` vers le backend local, ou un environnement de staging. Renseigner l'URL de webhook dans la config (`webhookUrl` / `callbackUrl`). |
| 5 | Org de test | Une organisation dédiée, devise `MAD` (PayZone/CMI) ou `SAR` (PayTabs), pour que le resolver route vers le bon PSP. |

## 2. Endpoints de notification (déjà en place)

Le router `PaymentWebhookRouter` (`/api/webhooks/payments/{psp}`) est prêt et vérifie la
signature **avant** tout changement d'état. À whitelister en prod dans `SecurityConfigProd`
(endpoints publics authentifiés par signature) au moment de l'activation :

| PSP | Endpoint | Format | Signature |
|---|---|---|---|
| PayZone | `POST /api/webhooks/payments/payzone` | JSON | HMAC-SHA256, entête `X-Payzone-Signature` |
| CMI | `POST /api/webhooks/payments/cmi` | form-urlencoded | HASH SHA-512 ver3 **dans le body** (`HASH`) |
| PayTabs | `POST /api/webhooks/payments/paytabs` | JSON | HMAC-SHA256, entête `signature` |

## 3. Scénarios de certification (à exécuter en sandbox)

Chaque scénario doit passer **pour chaque PSP** avant activation. Cocher au fur et à mesure.

| # | Scénario | Attendu | PayZone | CMI | PayTabs |
|---|---|---|---|---|---|
| C1 | Paiement accepté | Redirection → paiement carte test → webhook signé → transaction `COMPLETED` au ledger, entité métier `PAID` | ☐ | ☐ | ☐ |
| C2 | Paiement refusé (carte de refus) | Webhook signé → transaction `FAILED`, entité non payée, message d'erreur exploitable | ☐ | ☐ | ☐ |
| C3 | **Montant exact au centime** | Le montant débité = `PaymentTransaction.amount` (attention aux devises, cf. §4.1) | ☐ | ☐ | ☐ |
| C4 | Devise correcte | Débité en MAD (PayZone/CMI) / SAR (PayTabs), pas de conversion silencieuse | ☐ | ☐ | ☐ |
| C5 | Signature valide acceptée | Webhook avec signature correcte → traité | ☐ | ☐ | ☐ |
| C6 | **Signature invalide rejetée** | Webhook falsifié → `401`, aucune modification de transaction | ☐ | ☐ | ☐ |
| C7 | Référence marchande restituée | `transactionRef` (PayZone `merchant_reference`, CMI `oid`, PayTabs `cart_id`) restitué → lookup OK | ☐ | ☐ | ☐ |
| C8 | Idempotence / re-livraison | Rejouer le webhook de succès → pas de double crédit (transition CAS `COMPLETED`) | ☐ | ☐ | ☐ |
| C9 | Remboursement API | PayZone/PayTabs : refund total + partiel OK. **CMI : refund renvoie un échec explicite (manuel back-office)** — comportement attendu | ☐ | ☐ (échec attendu) | ☐ |
| C10 | Filet de secours (statut) | Notification volontairement non livrée → réconciliation par interrogation de statut (à câbler si le PSP l'expose) | ☐ | ☐ | ☐ |
| C11 | **Payout / mandat SEPA** (si le PSP l'expose) | Mise en place d'un mandat SEPA (UMR + IBAN) → virement récurrent déclenché par API → notification d'issue (exécuté/rejeté/retourné). Cf. exigence E2.5 du dossier PDF. | ☐ | ☐ | ☐ |

> **Exigence payout (E2.5)** — pour faciliter les reversements mensuels aux
> propriétaires, on privilégie un PSP (ou une banque partenaire) capable
> d'enregistrer des **mandats SEPA** (zone euro) et de déclencher des **virements
> récurrents** par API (idempotents, avec notification d'issue). Hors zone SEPA
> (Maroc), un **virement bancaire** adossé à une banque partenaire, avec export de
> règlement rapprochable, tient le même rôle. Côté Baitly ces payouts passent déjà
> par le port `PayoutExecutor` (rails SEPA / OpenBanking / Wise / StripeConnect /
> Manuel) : aucun flux métier à retoucher pour brancher un nouveau rail.

## 4. Points d'attention relevés par l'audit de code (2026-07-13)

### 4.1 Format et échelle du montant (à verrouiller en C3) — PRIORITÉ

Les adaptateurs régionaux passent le **`BigDecimal` en unité majeure** au PSP
(PayZone `amount`, PayTabs `cart_amount`, CMI via `CmiHashService`) — c'est correct :
contrairement à Stripe (unité mineure / centimes), ces PSP attendent un montant décimal
(`"100.00"`). **Mais** :

- L'**échelle** n'est pas normalisée explicitement par devise. Vérifier en sandbox
  qu'un montant `100` (scale 0) et `100.00` (scale 2) sont acceptés à l'identique, et
  qu'aucune troncature n'a lieu. Si le PSP exige exactement N décimales, ajouter un
  `setScale(decimals, HALF_UP)` **dans l'adaptateur concerné** (jamais un
  `multiply(100)` : ce ne sont pas des unités mineures).
- **Devises à 3 décimales / sans sous-unité** : hors périmètre MA/SA au lancement (MAD
  et SAR = 2 décimales), mais à traiter si on ajoute KWD/BHD/TND (3 déc.) ou une devise
  sans sous-unité. Point signalé par l'ADR §4.

### 4.2 Cross-check du montant au webhook (durcissement — defense-in-depth)

Aujourd'hui, sur notification approuvée, le router appelle `completeTransaction(ref)`
**sans comparer** le montant rapporté par le PSP à `PaymentTransaction.amount`. Le
montant est fixé serveur à l'initiation et transporté signé, donc non falsifiable par le
client — le risque est faible. **Recommandation de durcissement** : extraire le montant
confirmé de chaque payload PSP et refuser la complétion (statut de réconciliation +
alerte admin) en cas d'écart. À implémenter au moment de la certification, quand les
noms de champs de montant de chaque payload sont confirmés (cf. §4.4).

### 4.3 CMI : remboursement manuel (assumé)

`CmiPaymentProvider.refundPayment` renvoie un échec explicite (« refund via back-office
CMI »). L'adaptateur **ne déclare pas** la capacité `REFUND` (aligné avec ce
comportement — corrigé le 2026-07-13). Un remboursement d'une transaction CMI doit être
routé vers une procédure manuelle côté opérations. Scénario C9 : l'échec est le
comportement **attendu**, pas un bug.

### 4.4 Specs « à confirmer à l'onboarding » (dans le code)

À valider contre la doc PSP réelle et corriger dans l'adaptateur si besoin :

- **PayZone** : noms de champs du payload de création (`amount`, `merchant_reference`,
  `checkout_url`/`transactionId`) et **entête de signature** (`X-Payzone-Signature`) —
  notés « standard de marché, à confirmer » dans `PayzonePaymentProvider`. Valeurs de
  `status` du webhook (`completed`/`succeeded` vs `failed`/`declined`/`cancelled`).
- **CMI** : ordre exact des champs dans le hash SHA-512 ver3 (`CmiHashService`),
  `ProcReturnCode`/`Response` du callback.
- **PayTabs** : `response_status` (`A`/`D`/`E`), entête `signature`, `cart_amount`.

### 4.5 Ce qui est déjà solide (vérifié par l'audit)

- Signature vérifiée **avant** tout changement d'état, secret **par organisation**
  (déchiffré à la volée), transaction résolue par **notre** référence.
- `orgId` injecté par l'orchestrateur et exigé par chaque adaptateur (`readOrgId` →
  fail-fast si absent).
- Comparaison de signature **à temps constant** (anti timing-attack).
- Pas de `catch(Exception)` avaleur : les échecs remontent en `PaymentResult.failure`
  ou en statut de réconciliation.
- Refund **réel** pour PayZone et PayTabs (`refundPayment(RefundContext, …)` → client).
- Capacité `PAYOUT` correctement **non déclarée** par les trois (payout Stripe-only).

## 5. Critère de sortie de la Vague 6

La Vague 6 est **close pour un PSP donné** quand : tous les scénarios C1–C9 passent en
sandbox (C10 si le PSP expose l'interrogation de statut), les specs §4.4 sont confirmées
et alignées dans l'adaptateur, et le point §4.1 (échelle du montant) est validé. On peut
alors activer ce PSP en production pour l'org pilote (montants réels faibles, supervision
renforcée), puis généraliser.

> État au 2026-07-13 : **code prêt et audité** ; certification sandbox **en attente
> d'onboarding marchand** (PayZone / CMI / PayTabs). Aucun blocage côté plateforme.
