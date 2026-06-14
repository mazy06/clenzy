# Inventaire interne — Domaine 8 : Finance & Compta

> **Méthode :** vérité terrain depuis le code (`server/src/main/java/com/clenzy/`). Statut + preuve fichier(:ligne).
> **Date :** 2026-06-13 • **Grille :** 0 absent / 1 basique / 2 standard marché / 3 avancé-différenciant.
> **Note de cadrage :** domaine « bunker » de Clenzy (score provisoire 3). Cet inventaire confirme **et révèle plus que prévu** : au-delà de la facturation NF et des rails de paiement/payout, Clenzy possède une **infrastructure de comptabilité de mandat (trust accounting)** réelle et câblée — `Wallet` + `LedgerEntry` (grand livre en partie double) + `EscrowHold` + `SplitPaymentService` — que le cadrage ne mentionnait pas.

---

## 1. Facturation conforme (NF / anti-fraude FR)

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| Entité `Invoice` | Facture formelle multi-pays, **immuable après émission** (`ISSUED`/`PAID`) ; corrections uniquement via `CREDIT_NOTE` | `model/Invoice.java:17-21,178-180` |
| Numérotation séquentielle **sans trou** | `InvoiceNumberingService.generateNextNumber()` : verrou pessimiste `SELECT … FOR UPDATE` sur compteur org+année, attribution **dans la transaction** d'émission (rollback = numéro restitué), upsert `ON CONFLICT DO NOTHING` anti-course. Format `FA{année}-{5 chiffres}` | `service/InvoiceNumberingService.java:14-104` |
| Contrainte DB d'unicité | Migration `0226` (citée cadrage) : contrainte d'intégrité sur la séquence | `db/changelog/changes/0226__*` |
| Mentions légales + champs vendeur/acheteur | `legalMentions`, `sellerName/Address/TaxId`, `buyerName/Address/TaxId`, HT/TVA/TTC `precision 12, scale 2` | `model/Invoice.java:74-128,62-72` |
| Stockage XML + QR | Champs `xml_content` + `qr_code_data` persistés sur la facture | `model/Invoice.java:124-128` |
| Types de facture | `InvoiceType` : `GUEST`, **`COMMISSION`** (facture de commission de gestion NF), etc. | `model/InvoiceType.java` |
| PDF + relances | `InvoicePdfService`, `InvoiceOverdueScheduler` (relances échéance), champs `paidAt/overdueNotifiedAt` | `service/InvoicePdfService.java`, `scheduler/InvoiceOverdueScheduler.java` |

**Score sous-domaine : 3.** Numérotation séquentielle inviolable + immuabilité post-émission + mentions légales + types NF = conformité **loi anti-fraude TVA FR** de niveau supérieur, **rare chez les PMS internationaux** (qui produisent des « receipts » sans inviolabilité séquentielle légale).

> **Réserve majeure (e-invoicing 2026/2027) :** le champ `xml_content` stocke un XML **maison** (peuplé via `TemplateParserService`), **pas un format Factur-X / CII / UBL normé** ni de connexion PDP (Plateforme de Dématérialisation Partenaire). Or la réforme FR impose la **réception** d'e-factures Factur-X dès **sept. 2026** (grandes/ETI) et l'**émission** pour PME/micro dès **sept. 2027**. Clenzy n'a **ni générateur Factur-X conforme ni pont PDP** aujourd'hui → chantier réglementaire à fort enjeu. Aucun fichier `FacturX/ChorusPro/Peppol/PDP` trouvé.

---

## 2. Comptabilité de mandat / Trust accounting (découverte au-delà du cadrage)

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| `Wallet` (porte-monnaie virtuel) | Types `PLATFORM / OWNER / CONCIERGE / ESCROW`, org-scopé `@Filter`, par propriétaire (`owner_id`) | `model/Wallet.java`, `model/WalletType.java` |
| **`LedgerEntry` (grand livre en partie double)** | `DEBIT/CREDIT`, `amount`, **`balance_after`** (solde courant), **`counterpart_entry_id`** (contrepartie), `referenceType` (`PAYMENT/ESCROW_HOLD/ESCROW_RELEASE/SPLIT/REFUND/PAYOUT/ADJUSTMENT/UPSELL/COMMISSION`) | `model/LedgerEntry.java`, `model/LedgerEntryType.java`, `model/LedgerReferenceType.java` |
| `EscrowHold` (séquestre) | Fonds bloqués par réservation, statuts `HELD/RELEASED/REFUNDED/EXPIRED`, `releaseAt`, `releaseTrigger` | `model/EscrowHold.java`, `model/EscrowStatus.java` |
| `EscrowService` | `holdFunds` (plateforme → escrow via `recordTransfer`), `releaseFunds` ; **chaque release dans sa propre transaction** | `service/EscrowService.java`, `scheduler/EscrowReleaseScheduler.java` |
| **Libération auto à l'arrivée** | `EscrowReleaseScheduler` (cron horaire) libère les escrows dont le check-in est passé → déclenche `CHECK_IN` | `scheduler/EscrowReleaseScheduler.java:46-70` |
| `SplitPaymentService` | Répartit les fonds libérés : priorité **`ManagementContract.commissionRate` → `SplitConfiguration` → défauts** (owner 80 / platform 5 / concierge 15), arrondis `HALF_UP`, **reste au concierge** (anti-arrondi), transferts inscrits au grand livre | `service/SplitPaymentService.java:44-90` |
| **Câblage réel** (pas dormant) | `splitPayment` invoqué depuis `StripePaymentConfirmationService`, `PaymentEventConsumer` (Kafka), `CommissionInvoiceService` | call-sites confirmés |
| `LedgerService` / `WalletService` | `recordTransfer`, `getOrCreate*Wallet` (platform/owner/concierge/escrow) | `service/LedgerService.java`, `service/WalletService.java` |
| `PaymentLedgerReversalService` | Reversal/contre-passation propre (cohérence post-refund/annulation) | `service/PaymentLedgerReversalService.java` |

**Score sous-domaine : 3.** **Grand livre en partie double + séquestre + split contractuel** = socle de **trust accounting** que la plupart des PMS sous-traitent (Clearing) ou réservent à une offre « Accounting » premium (Guesty). Câblé au cycle de paiement réel (Stripe + Kafka). C'est l'atout le plus sous-estimé du cadrage.

> **Réserve :** le ledger sert le **flux de fonds interne** (paiement → escrow → split → wallet → payout), pas un **plan comptable général exportable** par compte (la passerelle compta « officielle » reste Pennylane + FEC, cf. §6). Pas de rapprochement bancaire (bank reconciliation) automatisé identifié.

---

## 3. Reversements propriétaires (OwnerPayout) & contrats de mandat

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| `OwnerPayout` | Cycle `PENDING → APPROVED → PAID`, multi-propriétaires | `model/OwnerPayout.java` (cadrage §35) |
| `ManagementContract` | Mandats propriété↔propriétaire, types `FULL_MANAGEMENT/BOOKING_ONLY/MAINTENANCE_ONLY/CUSTOM`, **4 `PaymentModel`** `DIRECT/OWNER_COLLECTS/CONCIERGE_COLLECTS/OTA_COHOST_SPLIT`, `CommissionBase GROSS/NET_OF_OTA_FEE` | `model/ManagementContract.java` |
| `CommissionInvoiceService` | Facture de **commission de gestion** NF (`InvoiceType.COMMISSION`) | `service/CommissionInvoiceService.java` |
| `OwnerStatementService` | **Relevé propriétaire** envoyé (`sendStatement(ownerId, orgId, …)`) | `service/OwnerStatementService.java:65` |
| Planification des payouts | `PayoutScheduleConfig` + `PayoutGenerationScheduler` + `PayoutReminderScheduler` | `scheduler/Payout*Scheduler.java`, `model/PayoutScheduleConfig.java` |
| Portail propriétaire | `OwnerPortalService` / `OwnerPortalController`, `OwnerDashboardDto`, `WalletController` | `controller/OwnerPortalController.java` |
| Commission par canal / activité | `ChannelCommission`, `ActivityCommission` (commissions sur activités/upsells) | `model/ChannelCommission.java`, `model/ActivityCommission.java` |

**Score sous-domaine : 3.** Reversements automatisés + relevés propriétaires + commission contractualisée par mandat (4 modèles de paiement) + portail = couverture **multi-owner / B2B2C** de niveau Guesty/Avantio. Différenciant sur le `PaymentModel` `OTA_COHOST_SPLIT` (répartition co-host OTA).

> **Réserve :** le relevé propriétaire est **envoyé** (résumé + payouts) mais le code ne prouve pas un **PDF de relevé richement formaté multi-période** comparable à « Owner Statements 2.0 » (Lodgify) ou aux relevés annuels/mensuels Guesty (1099 US, par mois). À confirmer côté front.

---

## 4. Encaissement (4 rails de paiement)

| Rail | Constat code | Preuve |
|------|--------------|--------|
| **Stripe** | `StripeGateway` (RequestOptions par appel, idempotency keys), `StripePaymentProvider` | `payment/StripeGateway.java`, `payment/provider/StripePaymentProvider.java` |
| **PayTabs** (KSA) | `PayTabsClient` + `PayTabsPaymentProvider` | `payment/provider/PayTabs*.java` |
| **CMI** (Maroc) | `CmiPaymentProvider` + `CmiHashService` | `payment/provider/Cmi*.java` |
| **Payzone** (Maroc) | `PayzoneClient` + `PayzonePaymentProvider` | `payment/provider/Payzone*.java` |
| Orchestration | `PaymentOrchestrationService` (idempotent), `PaymentProviderRegistry`, `StripeAmounts.toMinorUnits` (HALF_UP) | cadrage + `payment/` |
| **PayPal** | **Retiré** | cadrage |

**Score sous-domaine : 3.** 4 rails dont 3 dédiés MENA (PayTabs/CMI/Payzone). **Au-delà du marché** PMS qui se limite quasi exclusivement à Stripe (parfois Braintree/Authorize.net). Réserve : MENA = ambition non activée en prod (FR aujourd'hui), donc la valeur des rails MA/KSA est latente.

---

## 5. Décaissement (4 rails de payout)

| Rail | Couverture | Preuve |
|------|------------|--------|
| **Stripe Connect** | EU/UK/US (compte connecté Express) | `payment/payout/executor/StripeConnectPayoutExecutor.java` |
| **Wise** | 80+ pays (virement international API) | `payment/payout/executor/WisePayoutExecutor.java`, `payout/wise/WiseClient.java` |
| **Open Banking PIS** | GoCardless, SEPA, consentement 90j, SCA mensuelle | `payment/payout/executor/OpenBankingPayoutExecutor.java`, `payout/openbanking/GoCardlessPisClient.java` |
| **SEPA Credit Transfer** | Génération XML **pain.001** (upload manuel portail bancaire) | `payment/payout/executor/SepaTransferPayoutExecutor.java`, `service/AccountingExportService.java:74` (`generateSepaXml`) |
| Manuel | `ManualPayoutExecutor` (hors Clenzy) | `payment/payout/executor/ManualPayoutExecutor.java` |
| Registry + webhooks | `PayoutExecutorRegistry`, `PayoutWebhookService`, `PayoutNotifier` | `payment/payout/` |

**Score sous-domaine : 3.** **4 rails de payout** = flexibilité de reversement **bien au-dessus du panel** (qui s'appuie quasi exclusivement sur Stripe Connect). Open Banking PIS + Wise + pain.001 SEPA = rare nativement.

---

## 6. Fiscalité multi-pays & taxe de séjour

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| `FiscalEngine` | Moteur fiscal central + `TaxCalculatorRegistry` (Strategy par pays) | `fiscal/FiscalEngine.java`, `fiscal/TaxCalculatorRegistry.java` |
| Calculateurs pays | `FranceTaxCalculator`, `MoroccoTaxCalculator`, `SaudiTaxCalculator` (TVA/VAT) | `fiscal/country/*.java` |
| `FiscalProfile` / `FiscalRegime` | Profil fiscal org + régimes | `model/FiscalProfile.java`, `model/FiscalRegime.java` |
| **Taxe de séjour** | `TouristTaxConfig` (taux % ou montant, **exonération enfants** `childrenExemptUnder`), `TouristTaxService.calculate`, **câblée à la génération de facture et à la réservation** | `service/TouristTaxService.java:44-83`, `service/InvoiceGeneratorService.java`, `model/Reservation.java` |
| Multi-pays | `fiscal.multi-country.enabled=false` → **FR en prod** ; MA/KSA = code présent mais flag OFF | cadrage §41, `config/FiscalProperties.java` |

**Score sous-domaine : 3 (FR) / latent (MA-KSA).** Taxe de séjour **native, paramétrable et intégrée au pipeline de facturation** (vs. champ statique chez Smoobu/Lodgify ou délégation à Trippz/Stellar). Moteur fiscal multi-pays par Strategy = architecture supérieure, mais valeur MENA non activée.

---

## 7. Exports comptables

| Export | Constat code | Preuve |
|--------|--------------|--------|
| **FEC** (Fichier des Écritures Comptables, norme DGFiP) | `AccountingExportService.exportFec(orgId, from, to)`, séparateur tab, format date FEC, statuts fiscalement émis | `service/AccountingExportService.java:25-115` |
| CSV | Exports CSV comptables | `controller/AccountingExportController.java`, `service/AccountingExportService.java` |
| SEPA pain.001 | `generateSepaXml(payoutIds, orgId)` | `service/AccountingExportService.java:74` |
| Reporting fiscal | `FiscalReportingService`, `FiscalReportingController` | `service/FiscalReportingService.java` |

**Score sous-domaine : 3 (FR).** Le **FEC natif** est un différenciant fort sur le marché FR — quasi aucun PMS international ne le produit. CSV + SEPA XML complètent.

---

## 8. Intégrations comptables (mixte)

| Outil | Statut code | Preuve |
|-------|-------------|--------|
| **Pennylane** | **Sync complète Clenzy → Pennylane** : `PennylaneAccountingSyncService` (factures `ISSUED/SENT/PAID` + dépenses), `PennylaneAccountingClient`, tracking `pennylane_invoice_id`/`pennylane_synced_at` sur `Invoice` | `integration/pennylane/service/PennylaneAccountingSyncService.java`, `model/Invoice.java:149-156` |
| **QuickBooks** | **OAuth uniquement** — `QuickBooksOAuthService` + `QuickBooksConnectionPersistence` ; **aucun service de sync** (pas de push factures/dépenses) | `integration/quickbooks/service/` (2 services OAuth, 0 sync) |
| **Xero** | **OAuth uniquement** — `XeroOAuthService` + persistence ; pas de sync | `integration/xero/service/` |
| **Sage** | **OAuth uniquement** — `SageOAuthService` + persistence ; pas de sync | `integration/sage/service/` |
| **Odoo** | **Absent** (aucun package) | — |

**Score sous-domaine : 2.** Pennylane (acteur FR majeur) = sync de bout en bout, fort pour la cible FR. Mais QuickBooks/Xero/Sage **restent des coquilles OAuth sans flux** → faux sentiment de couverture pour un prospect anglo-saxon. Odoo absent.

---

## 9. Multi-devise & dépôts/cautions

| Élément | Constat code | Preuve |
|---------|--------------|--------|
| Multi-devise | `ExchangeRate`, `CurrencyConverterService`, `ExchangeRateProviderService` (EUR/MAD/SAR) | `model/ExchangeRate.java`, `service/CurrencyConverterService.java` |
| **Dépôt de garantie / caution** | **ABSENT** — aucune entité `SecurityDeposit`/`Caution`/`DamageDeposit`, aucune pré-autorisation Stripe (auth-hold) trouvée (0 occurrence) | recherche exhaustive code : nul |

**Score multi-devise : 2** (conversion présente ; périmètre réel FR/EUR). **Score caution : 0** — gap confirmé (déjà signalé cadrage domaine 7 « caution absente »). C'est un manque **standard de marché** (Hostaway/Guesty/Lodgify ont la pré-autorisation/auth-hold).

---

## 10. Synthèse domaine 8

| Sous-domaine | Score | Commentaire |
|--------------|:-----:|-------------|
| Facturation conforme NF / immuabilité / numérotation | 3 | Inviolable, mentions légales, `CREDIT_NOTE` ; rare hors FR |
| Trust accounting (Wallet + Ledger partie double + Escrow + Split) | 3 | Câblé au flux réel ; sous-estimé par le cadrage |
| Reversements propriétaires + contrats de mandat (4 PaymentModel) | 3 | Multi-owner B2B2C niveau Guesty/Avantio |
| Encaissement (4 rails) | 3 | Stripe + 3 rails MENA ; au-dessus marché (latent) |
| Décaissement (4 rails payout) | 3 | Connect + Wise + Open Banking + SEPA XML ; rare |
| Fiscalité multi-pays + taxe de séjour | 3 (FR) | Native, intégrée pipeline ; MENA latent |
| Exports comptables (FEC + CSV + SEPA) | 3 (FR) | FEC natif = différenciant FR fort |
| Intégrations compta | 2 | Pennylane complet ; QB/Xero/Sage = OAuth sans sync ; Odoo absent |
| Multi-devise | 2 | Présent, périmètre réel FR |
| **Dépôt de garantie / caution** | **0** | **Gap standard de marché** |
| **E-invoicing Factur-X / PDP (réforme FR 2026/27)** | **1** | XML maison stocké, **pas Factur-X normé ni pont PDP** |

> **Score « nous » domaine 8 : 3.** Le bunker tient : conformité NF + FEC + trust accounting câblé + 4 rails paiement/4 rails payout + reversements multi-owner forment un socle financier **supérieur à tout le panel sur la conformité FR et la flexibilité des flux**. **Gaps assumés à combler :** (1) **caution/dépôt de garantie** (auth-hold Stripe) = absent alors qu'il est standard ; (2) **Factur-X + pont PDP** pour la réforme e-invoicing FR sept. 2026/2027 ; (3) **sync réelle QuickBooks/Xero/Sage** (aujourd'hui OAuth vide) pour crédibiliser hors-FR ; (4) **relevé propriétaire PDF multi-période** richement formaté ; (5) Odoo.
</content>
</invoke>
