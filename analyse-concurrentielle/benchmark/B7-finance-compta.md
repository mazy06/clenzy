# B7 — Benchmark : Finance & Compta

> **Domaine 8** (pondération cadrage : 11 % — « Reversements + conformité NF = bunker Clenzy »).
> **Panel :** Clenzy vs Hostaway, Guesty, Smoobu, Lodgify, Hospitable, Avantio, Smily.
> **Grille 0–3** (cf. cadrage §5). Concurrents : datés + sourcés + niveau de confiance. Veille web : 2025-2026.
> **Date :** 2026-06-13. **Référentiels métier cités :** Guesty Trust Accounting, Avantio, Escapia/VRTrust, Clearing (passerelle compta STR).

---

## Section 1 — Périmètre & taxonomie du domaine

La « Finance & Compta » d'un PMS STR couvre la chaîne argent de bout en bout : encaisser le voyageur, séquestrer/répartir les fonds, reverser au propriétaire, facturer en conformité, déclarer les taxes, et alimenter la comptabilité. Sous-fonctionnalités retenues (comparables — 22 lignes dans `data/08-finance-compta.csv`) :

1. **Facturation conforme / inviolable** — numérotation séquentielle sans trou, immuabilité post-émission, mentions légales (anti-fraude TVA FR / NF).
2. **Trust accounting** — grand livre en partie double, séparation des fonds propriétaire vs gestionnaire (référentiel : Guesty Trust Accounting, VRTrust).
3. **Séquestre / escrow** — blocage des fonds jusqu'à un déclencheur (check-in), libération automatique.
4. **Reversements propriétaires (owner payouts)** — calcul + virement automatisé du net dû au propriétaire.
5. **Relevés propriétaires (owner statements)** — document récapitulatif revenus/dépenses/net par période.
6. **Calcul de commission de gestion** — commission par mandat/contrat, par canal, base brute ou nette d'OTA.
7. **Facture de commission conforme** — facturation NF de la commission du gestionnaire.
8. **Portail propriétaire** — accès self-service aux statements/payouts/dashboard.
9. **Paiements par carte** — encaissement voyageur (Stripe & co).
10. **Multi-rails de paiement** — au-delà de Stripe (gateways régionaux).
11. **Multi-devise** — encaissement/reporting en plusieurs devises.
12. **Dépôt de garantie / caution** — pré-autorisation (auth-hold) ou collecte + restitution.
13. **Taxe de séjour automatique** — calcul intégré (taux, exonérations).
14. **Fiscalité multi-pays** — moteur de taxes par juridiction (TVA/VAT).
15. **Suivi des dépenses** — saisie des charges/extras imputées au propriétaire.
16-18. **Intégrations compta** — QuickBooks, Xero, Pennylane.
19. **Export FEC** — fichier des écritures comptables (norme DGFiP FR).
20. **E-invoicing Factur-X / PDP** — réforme française e-facturation (sept. 2026/2027).
21. **Rapprochement bancaire** — réconciliation des relevés bancaires.

---

## Section 2 — Inventaire interne Clenzy (vérité code)

*(détail complet : `inventaire/08-finance-compta.md`)*

**Forces (preuves code)**
- **Facturation NF inviolable** : `InvoiceNumberingService` (numéro séquentiel attribué **dans** la transaction d'émission, verrou pessimiste + upsert anti-course → **zéro trou**), `Invoice` immuable post-`ISSUED` (correction par `CREDIT_NOTE` seulement), mentions légales + HT/TVA/TTC + champs vendeur/acheteur (`model/Invoice.java`, contrainte DB migration `0226`).
- **Trust accounting CÂBLÉ (découverte au-delà du cadrage)** : `Wallet` (`PLATFORM/OWNER/CONCIERGE/ESCROW`) + `LedgerEntry` (**partie double** : `DEBIT/CREDIT`, `balance_after`, `counterpart_entry_id`) + `EscrowHold` (HELD→RELEASED, libération auto au check-in via `EscrowReleaseScheduler`) + `SplitPaymentService` (répartition `ManagementContract.commissionRate → SplitConfig → défauts`, arrondis `HALF_UP`). Invoqué depuis `StripePaymentConfirmationService` + `PaymentEventConsumer` (Kafka) → **pas dormant**.
- **Reversements multi-owner** : `OwnerPayout` (PENDING→APPROVED→PAID), `ManagementContract` (4 `PaymentModel` dont `OTA_COHOST_SPLIT`, `CommissionBase GROSS/NET_OF_OTA_FEE`), `CommissionInvoiceService` (facture NF), `OwnerStatementService.sendStatement`, `PayoutScheduleConfig` + schedulers de génération/relance, portail propriétaire.
- **4 rails de paiement** : Stripe + PayTabs (KSA) + CMI + Payzone (MA), orchestration idempotente (PayPal retiré).
- **4 rails de payout** : Stripe Connect (EU/UK/US), Wise (80+ pays), Open Banking PIS (GoCardless/SEPA), SEPA Credit Transfer XML pain.001.
- **Fiscalité** : `FiscalEngine` + `France/Morocco/SaudiTaxCalculator`, taxe de séjour native (`TouristTaxConfig`, exonération enfants) **intégrée au pipeline de facturation**.
- **Exports** : **FEC** natif (`AccountingExportService.exportFec`), CSV, SEPA XML.
- **Pennylane** : sync complète Clenzy → Pennylane (factures + dépenses, tracking sur l'`Invoice`).

**Faiblesses (preuves code)**
- **Dépôt de garantie / caution = 0** : aucune entité, aucune pré-autorisation Stripe (auth-hold) → **gap standard de marché**.
- **E-invoicing Factur-X / pont PDP = absent** : `Invoice.xml_content` stocke un XML **maison**, pas un Factur-X/CII/UBL normé ni de connexion PDP → la réforme FR (réception sept. 2026, émission PME sept. 2027) n'est pas couverte.
- **QuickBooks / Xero / Sage = OAuth sans sync** : coquilles de connexion (`*OAuthService` + persistence), **aucun flux** de push factures/dépenses → faux sentiment de couverture hors-FR. **Odoo absent**.
- **Pas de rapprochement bancaire** automatisé ; relevé propriétaire envoyé mais pas de preuve d'un PDF multi-période richement formaté ; multi-devise présent mais périmètre réel FR/EUR.

**Score interne domaine : 3/3** (bunker confirmé : conformité FR + flux de fonds supérieurs au panel ; les gaps sont périphériques mais commercialement visibles).

---

## Section 3 — Analyse concurrent par concurrent (daté & sourcé)

### Guesty — **2,2/3** *(référence trust accounting du panel)*
**Accounting by Guesty** : solution de **trust accounting** complète, **feature premium activée sur contact**. Owner statements automatiques mensuels (ou annuels / plage personnalisée), 3 formats de relevé annuel (détaillé / résumé / résumé par mois), **fiscal year configurable**. Configuration fine de **qui remet quelle taxe** (propriétaire vs PMC) avec dates de reconnaissance séparées. **1099 automatisés** (US) + e-files IRS. Auth-hold / security deposit natif (charge X jours avant check-in, 7j max). Multi-devise (150+ via Stripe). Intégration **Clearing**. **Limite :** premium payant, orientation US (1099), pas de FEC/NF FR. **Confiance : Confirmé** (help.guesty.com, guesty.com/features/accounting, blog Guesty Trust Accounting 2025, getclearing.co).

### Hostaway — **1,8/3** *(le plus complet sur l'écosystème compta externe)*
Owner statements via workflows récurrents (revenus/dépenses/distribution nette + pièces justificatives), **Expenses & Extras** (améliorés en 2025). **QuickBooks Online** (sync factures + mapping listings→classes) et **Xero** en intégrations natives. Auth-hold / **refundable damage deposit** automatisé (Stripe). Multi-devise (Stripe 150+). Payouts propriétaires automatisés. **Limite :** paiements **liés à Stripe uniquement** (pointé par les avis), pas de trust accounting en partie double natif (délégué à QB/Xero/Clearing), pas de FEC/NF FR. **Confiance : Confirmé** (support.hostaway.com, get.hostaway.com/quickbooks-integration, hostaway.com/blog 2025).

### Avantio — **1,7/3** *(agences EU/FR, multi-owner, mais compta limitée à l'échelle)*
Mandats à **commissions personnalisées** (multi-owner, accords différents), suivi des paiements, **calcul automatique du dû propriétaire**, facturation et reporting financiers automatisés temps réel, modèle **0 % commission éditeur** (prix/propriété). **Limite documentée :** pour ~35 biens, des avis et l'équipe Avantio elle-même recommandent de **gérer la compta en externe / Excel** (relevés propriétaires incorrects à volume moyen). **Confiance : Probable** (avantio.com property-management-software & blog owner-transparency 2025 ; limite issue d'un avis daté softwareadvice/hotelub 2025).

### Smily (ex-BookingSync) — **1,6/3** *(origine française, distribution de revenus)*
**Revenue Distribution by Smily** : décompose chaque réservation en commissions / frais / coûts de traitement / taxes → **owner-ready statements** et réconciliation. **Goldorak** (agrégateur de données) produit des documents comptables/financiers automatiquement. **Commission visible** sur toutes les réservations/canaux (y c. commission Booking.com déduite). Éditeur **français** → sensibilité facturation FR (changelog FR « configuration de la facturation Smily »). **Limite :** trust accounting partie double / FEC / Factur-X non documentés en natif ; statements via agrégateur. **Confiance : Probable** (smily.com/software/features/revenue-distribution, changelog(-fr).bookingsync.com 2025, softwareworld 2025).

### Lodgify — **1,5/3** *(orienté site direct + owner statements 2.0)*
**Owner Statements 2.0** (plan Ultimate) : revenus de réservation, frais de plateforme, ménage, **commission de gestion, dépenses, payouts nets**. Nouveau **CSV** complet des financiers (réservations confirmées/annulées depuis 01/2024) pour compta/owner statements/taxe de séjour. **Lodgify Payments** (sans tiers) + Stripe/PayPal/Braintree/Authorize.net, KYC via Stripe. Intégration **Clearing**. **Limite :** pas de trust accounting partie double natif, pas de FEC/NF FR, deposit via gateway. **Confiance : Probable** (lodgify.com/accounting & /owner-statements, blog Owner Statements 2.0 & Lodgify Payments 2025).

### Hospitable — **1,2/3** *(orienté hôtes, compta via QuickBooks)*
**Owner Portal & Statements** (plan **Mogul** uniquement) : dashboards temps réel, **relevés mensuels + payouts** sur le compte bancaire du propriétaire, **Adjustments** automatiques si une réservation change après un statement payé. **QuickBooks** : recommande la **compta de caisse** (cash-based), rattache résa/transactions/statements aux classes QB. **Limite :** pas de trust accounting natif, pas de multi-rails ni FEC/NF, deposit faible ; tout est calé sur QuickBooks. **Confiance : Confirmé** (hospitable.com/features/owner-portal-statements, help.hospitable.com owner statements & QuickBooks 2024-2025).

### Smoobu — **1,0/3** *(entrée de gamme)*
Facturation automatique (données Airbnb pré-remplies, logo, suivi de paiement), **relevés mensuels propriétaires** + calcul du net + invoicing owner. Taxe de séjour paramétrable (% ou montant, requis/optionnel). Compta « avancée » déléguée à **Rental Ninja** / **Stellar Trust** (intégrations). **Limite :** pas de trust accounting, pas de FEC/Factur-X natif, pas de multi-rails, deposit minimal. **Confiance : Probable** (smoobu.com guides invoice & receipts, support.smoobu.com tourist tax, blog Rental Ninja 2025).

---

## Section 4 — Tableau comparatif synthétique

*(détail granulaire 22 fonctionnalités : `data/08-finance-compta.csv`)*

| Fonctionnalité | Clenzy | Hostaway | Guesty | Smoobu | Lodgify | Hospitable | Avantio | Smily |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Facturation conforme/inviolable (NF) | **3** | 1 | 1 | 2 | 1 | 1 | 2 | 2 |
| Numérotation séquentielle + immuabilité | **3** | 1 | 1 | 1 | 1 | 1 | 1 | 2 |
| Trust accounting (partie double) | **3** | 1 | 3 | 1 | 1 | 1 | 1 | 1 |
| Séquestre/escrow + libération auto | **3** | 1 | 3 | 0 | 1 | 0 | 1 | 1 |
| Reversements propriétaires auto | 3 | 2 | 3 | 1 | 2 | 2 | 3 | 2 |
| Relevés propriétaires | 2 | 3 | 3 | 2 | 3 | 2 | 2 | 3 |
| Calcul commission de gestion | 3 | 2 | 3 | 1 | 2 | 2 | 3 | 2 |
| Facture de commission conforme (NF) | **3** | 1 | 2 | 1 | 1 | 1 | 2 | 2 |
| Portail propriétaire + dashboard | 2 | 3 | 3 | 1 | 2 | 3 | 3 | 2 |
| Paiements par carte | 3 | 2 | 3 | 2 | 3 | 2 | 2 | 2 |
| Multi-rails de paiement | **3** | 1 | 2 | 1 | 2 | 1 | 2 | 1 |
| Multi-devise | 2 | 3 | 3 | 1 | 2 | 1 | 2 | 2 |
| **Dépôt de garantie / caution** | **0** | 3 | 3 | 1 | 2 | 1 | 2 | 1 |
| Taxe de séjour auto | 3 | 2 | 2 | 2 | 2 | 1 | 2 | 2 |
| Fiscalité multi-pays | 3 | 2 | 3 | 1 | 1 | 1 | 2 | 1 |
| Suivi des dépenses | 2 | 3 | 3 | 1 | 3 | 2 | 3 | 2 |
| Intégration QuickBooks (sync) | **0** | 3 | 3 | 1 | 1 | 3 | 1 | 1 |
| Intégration Xero (sync) | **0** | 3 | 2 | 1 | 1 | 1 | 1 | 1 |
| Intégration Pennylane (FR) | **3** | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| Export FEC (DGFiP) | **3** | 0 | 0 | 1 | 1 | 0 | 1 | 2 |
| E-invoicing Factur-X / PDP | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| Rapprochement bancaire | **0** | 2 | 3 | 0 | 1 | 1 | 1 | 1 |
| **Moyenne (22 sous-fct.)** | **2,2** | **1,8** | **2,2** | **1,0** | **1,5** | **1,2** | **1,7** | **1,6** |

> **Lecture des scores.** Le **score domaine Clenzy = 3/3** (grille 0–3 au niveau domaine : socle financier avancé/différenciant). La **moyenne granulaire de 2,2** est tirée vers le bas par 3 zéros structurels (caution, QuickBooks/Xero sync, rapprochement bancaire) qui coexistent avec une grappe de 3 sur la conformité FR et les flux de fonds. **Clenzy et Guesty sont au coude-à-coude (2,2)** mais sur des forces **opposées** : Guesty domine l'écosystème compta US (QB/Xero, 1099, caution, bank rec) ; Clenzy domine la conformité FR (NF, FEC, Pennylane) et la flexibilité des rails (4 paiement / 4 payout). Confiance globale : **Confirmé** pour Guesty/Hostaway/Hospitable, **Probable** pour Avantio/Smily/Lodgify/Smoobu.

---

## Section 5 — Forces & faiblesses de Clenzy (positionnement)

**Parités (au niveau du marché)**
- **Reversements propriétaires automatisés** : Clenzy = 3, à parité avec Guesty/Avantio, au-dessus de la moyenne.
- **Calcul de commission de gestion** : 3 (4 `PaymentModel`, base GROSS/NET_OF_OTA) à parité Guesty/Avantio.
- **Paiements par carte** : standard atteint (Stripe), à parité.
- **Taxe de séjour auto** : Clenzy = 3 (native + intégrée pipeline), au-dessus de la moyenne (la plupart = champ paramétrable ou délégation Trippz/Stellar).

**Avantages différenciants**
- **Conformité FR de bunker** : facturation NF inviolable (3) + facture de commission NF (3) + **FEC natif (3)** + **Pennylane sync (3)** — un **quadruplet que personne d'autre n'atteint** dans le panel (concurrents anglo-saxons à 0-1 sur FEC/Pennylane, NF non productisé). C'est le moat FR de Clenzy.
- **Trust accounting câblé (3)** : grand livre partie double + escrow + split contractuel, à parité **Guesty** (le seul autre à 3) — mais **inclus** chez Clenzy là où c'est une **option premium payante activée sur contact** chez Guesty.
- **4 rails de paiement (3) + 4 rails de payout** : flexibilité **bien au-dessus** du panel (mono-Stripe pour Hostaway/Hospitable). Open Banking PIS + Wise + SEPA pain.001 = rare nativement.

**Faiblesses critiques**
- **Dépôt de garantie / caution = 0** : **seul acteur du panel à 0** ; Hostaway/Guesty à 3 (auth-hold Stripe natif). Manque **standard et très visible** commercialement (un prospect le teste tôt).
- **QuickBooks/Xero = 0 en sync réelle** : alors que Hostaway/Guesty/Hospitable sont à 3. Pour un prospect anglo-saxon (ou une conciergerie FR dont le cabinet comptable est sur QB/Xero), c'est rédhibitoire — d'autant que l'OAuth présent crée une **attente non tenue**.
- **E-invoicing Factur-X / PDP = 1** : Clenzy est **le mieux placé du panel par défaut** (XML stocké, FEC, NF) mais **n'a pas** le Factur-X normé ni le pont PDP. C'est paradoxalement le terrain où Clenzy DEVRAIT gagner (réforme FR sept. 2026/2027) et où il doit investir avant ses concurrents — fenêtre de différenciation forte mais fermante.
- **Rapprochement bancaire = 0** : Guesty (3), Hostaway (2) l'ont ; absent chez Clenzy.

---

## Section 6 — Synthèse chiffrée & écarts

| Acteur | Score moyen (22 sous-fct.) | Positionnement |
|---|:---:|---|
| **Guesty** | **2,2** | Trust accounting premium + écosystème compta US (QB/Xero, 1099, bank rec, caution) |
| **Clenzy** | **2,2** | Conformité FR (NF/FEC/Pennylane) + trust accounting inclus + 4 rails paiement/payout |
| Hostaway | **1,8** | QuickBooks/Xero natifs + expenses + caution ; mono-Stripe |
| Avantio | **1,7** | Multi-owner + commissions mandat ; compta faible à l'échelle (Excel externe) |
| Smily | **1,6** | FR, Revenue Distribution + Goldorak ; trust accounting non natif |
| Lodgify | **1,5** | Owner Statements 2.0 + Lodgify Payments + Clearing ; orienté site direct |
| Hospitable | **1,2** | Owner Portal (Mogul) + QuickBooks cash-basis ; orienté hôtes |
| Smoobu | **1,0** | Facturation + statements de base ; compta déléguée (Rental Ninja/Stellar) |

**Top 3 gaps** (écart le plus pénalisant pour le segment conciergerie pro FR)
1. **Dépôt de garantie / caution absent (0 vs 1-3 partout)** — pré-autorisation Stripe (auth-hold) = case standard que tout prospect teste ; seul acteur du panel à 0.
2. **QuickBooks / Xero sans sync réelle (0 vs 3 chez Hostaway/Guesty/Hospitable)** — l'OAuth présent crée une attente non tenue ; bloquant pour les cabinets comptables anglo-saxons et certaines conciergeries FR.
3. **E-invoicing Factur-X / pont PDP non implémenté (1)** — pas un retard vs concurrents (tous à 0-1) mais un **risque réglementaire FR** (sept. 2026 réception, 2027 émission) ET une **fenêtre de différenciation** que Clenzy doit saisir avant les autres.

**Top 3 avantages** (à défendre / mettre en avant)
1. **Conformité FR de bunker (NF inviolable + FEC + Pennylane + facture de commission NF)** — quadruplet inégalé dans le panel ; moat décisif sur la cible conciergerie FR.
2. **Trust accounting inclus (partie double + escrow + split contractuel)** — à parité Guesty mais sans surcoût premium ; sous-sous-traité (Clearing) ou payant ailleurs.
3. **4 rails de paiement + 4 rails de payout (Stripe Connect, Wise, Open Banking PIS, SEPA pain.001)** — flexibilité de flux très au-dessus du panel quasi mono-Stripe.

**Parités confirmées** : reversements propriétaires automatisés, calcul de commission de gestion, paiements carte, taxe de séjour (au-dessus de la moyenne).

---

## Section 7 — Initiatives recommandées (priorisées)

> Format : `Titre | Type | Impact(1-3) | Effort(S/M/L) | Reach(1-3) | Confiance(0.1-1.0)`

1. **Dépôt de garantie / caution via pré-autorisation Stripe (auth-hold)** | Parité | Impact 3 | Effort M | Reach 3 | Confiance 0,9
   *Brancher la pré-autorisation Stripe (hold + capture partielle/totale + release) sur le `StripeGateway` existant, modèle `SecurityDeposit` lié à la réservation, intégré à l'escrow déjà en place. Comble le seul 0 du panel face à un standard universel (Hostaway/Guesty/Lodgify). L'infra escrow/ledger rend l'effort modéré, pas lourd.*

2. **Sync réelle QuickBooks + Xero (push factures/dépenses)** | Parité | Impact 2 | Effort M | Reach 2 | Confiance 0,85
   *Sur le modèle de `PennylaneAccountingSyncService` : ajouter `QuickBooksAccountingSyncService` + `XeroAccountingSyncService` (push des `Invoice` ISSUED/PAID + dépenses, mapping comptes). L'OAuth est déjà câblé → l'attente est créée, il manque le flux. Débloque les prospects anglo-saxons et crédibilise le « QuickBooks/Xero » du pitch.*

3. **Générateur Factur-X normé + pont PDP (réforme e-invoicing FR)** | Différenciation/Conformité | Impact 3 | Effort L | Reach 2 | Confiance 0,8
   *Remplacer le `xml_content` maison par un Factur-X (PDF/A-3 + CII XML) conforme et brancher une PDP (réception sept. 2026, émission PME sept. 2027). Clenzy part en tête (FEC/NF/XML stocké) ; en faire un produit AVANT les concurrents transforme une obligation en argument de vente FR. Effort élevé (normes + agrément PDP).*

4. **Relevé propriétaire PDF multi-période enrichi + adjustments** | Différenciation | Impact 2 | Effort M | Reach 3 | Confiance 0,8
   *Au-delà du `sendStatement` actuel : PDF mensuel/annuel/plage personnalisée (revenus, dépenses, commissions, payouts nets, pièces jointes) + **Adjustments** automatiques en cas d'altération/refund après un statement payé (modèle Hospitable). Adresse le sous-domaine où Clenzy (2) est sous Lodgify/Guesty/Smily (3) malgré un back-end ledger supérieur.*

5. **Rapprochement bancaire (bank reconciliation) sur le ledger** | Différenciation | Impact 2 | Effort L | Reach 1 | Confiance 0,6
   *Importer les relevés bancaires (Open Banking déjà connecté côté PIS) et rapprocher avec les `LedgerEntry`/payouts. Comble le 0 face à Guesty (3)/Hostaway (2). Reach faible (utilisateurs avancés) mais consolide le positionnement « comptabilité sérieuse ».*

---

### Sources (veille datée)
- Guesty — Trust accounting & owner statements : guesty.com/features/accounting, blog « What's new in Guesty Trust Accounting » & « Introducing Accounting by Guesty », help.guesty.com (owner statements, security deposit vs authorization hold) (2025) ; getclearing.co (intégration Guesty-Clearing).
- Hostaway — Owner statements / Expenses / QuickBooks-Xero / damage deposit : support.hostaway.com (Financial Reporting Expenses & Extras, Pre-Authorization, QuickBooks Online Integration Guide), get.hostaway.com/quickbooks-integration, hostaway.com/blog (2025).
- Avantio — Owner transparency / financial automation : avantio.com/property-management-software & /blog/owner-transparency (2025) ; limite compta : softwareadvice.com & hotelub.fr (2025).
- Smily — Revenue Distribution / Goldorak / commission / facturation FR : smily.com/software/features/revenue-distribution, changelog.bookingsync.com & changelog-fr.bookingsync.com (2025), softwareworld.co (2025).
- Lodgify — Owner Statements 2.0 / Lodgify Payments / Clearing / CSV : lodgify.com/accounting & /owner-statements, blog « Owner Statements 2.0 » & « Lodgify Payments », lodgify.com/integrations/clearing (2025).
- Hospitable — Owner Portal & Statements / QuickBooks : hospitable.com/features/owner-portal-statements, help.hospitable.com (Getting Started with Owner Statements, QuickBooks financials) (2024-2025).
- Smoobu — Invoicing / tourist tax / Rental Ninja / Stellar : smoobu.com/guides (invoice, receipts), support.smoobu.com (tourist tax), smoobu.com/integrations (Rental Ninja, Stellar) (2025).
- Réforme e-invoicing FR — Factur-X / NF525 / loi anti-fraude TVA : amenitiz.com/fr/blog/nf525, tendancehotellerie.fr (NF525/NF203 PMS), amarris-ecommerce.fr (loi anti-fraude TVA) — calendrier sept. 2026 (réception, GE/ETI) / sept. 2027 (émission PME-micro).
- Tax / paiements / caution (transverse) : hostfully.com/blog/vacation-rental-payments, trippz.com/tourist-tax/france, stripe.com (multi-devise 150+) (2025-2026).
</content>
