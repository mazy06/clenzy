# Objectifs techniques — Cap multi-pays & parité Hostaway/Guesty

> **Amendement stratégique (2026-06-14).** Cette note **modifie la Décision n°1** de [20-strategie.md](20-strategie.md) : Clenzy n'est plus positionné « niche France-only » mais **plateforme multi-pays conçue pour France + Maroc + Arabie Saoudite**. La conformité reste un fossé, mais **multi-juridiction** (FR + MA + KSA) au lieu de FR seule.
>
> Source des objectifs : 11 agents-architectes (code lu + veille datée). Détail à la feature près : [data/40-feature-evolution.csv](data/40-feature-evolution.csv) (**189 features**). Architecture multi-pays détaillée : [41-strategie-multipays.md](41-strategie-multipays.md).

---

## 0. Constat fondateur

Le multi-pays **n'est pas un projet from-scratch** : c'est un **déverrouillage + complétion**. Le code contient déjà, mais **OFF/incomplet** :
- `fiscal.multi-country.enabled=false`, `ExchangeRate` (EUR/MAD/SAR) + `CurrencyConverterService`, `FiscalProfile`, `France/Morocco/SaudiTaxCalculator` + registry, `CountryComplianceStrategy` + registry, `PaymentProvider` registry (Stripe/PayTabs/CMI/Payzone), **et même** `ar.json` (231 KB), `stylis-plugin-rtl` + `rtlCache` côté web.
- De même côté IA : `multiagent/` complet (8 spécialistes) derrière un flag ; `AiPricingService`/`AiMessagingService` câblés mais flags OFF ; RAG pgvector opérationnel.

**Manquent vraiment** : entité `Country` centrale, `EInvoicingProvider` (ZATCA/Factur-X/DGI), `GuestRegistrationProvider` (Shomoos/DGSN), RTL mobile, caution, et le **branchement bout-en-bout** des abstractions au PriceEngine/facturation/paiement.

> Conséquence : beaucoup d'objectifs à **fort impact / faible effort** sont des activations. Le risque majeur est concentré sur **ZATCA (KSA)**.

---

## 1. Objectifs techniques transverses — Socle multi-pays (Section 0)

| Objectif | Approche technique | Effort | Dépendances |
|----------|--------------------|:------:|-------------|
| **Socle pays** (entité `Country` + branchement registries) | Table de config centralisant les capacités pays ; registries existants résolvent le bean via `country.*` ; distinguer `org.country` (facturation) vs `property.countryCode` (opérations) ; fail-fast au boot | M | Liquibase (régulariser des migrations héritées Flyway) |
| **i18n / RTL complet** (web + mobile + PDF) | Logical CSS properties, icônes directionnelles, planning Gantt + graphiques RTL, lint CI de complétude i18n, `I18nManager` RN, polices + reshaping arabe iText | L | Polices arabes |
| **Abstraction `EInvoicingProvider`** + registry | Interface `render/clear/report` indexée par `Country.einvoicing_provider`, calquée sur `TaxCalculatorRegistry` ; appels hors-transaction, idempotents | L | Socle pays |
| **Routage paiement/payout par pays-devise** | `PaymentProviderRouter` (country+currency → registry) remplaçant les appels Stripe en dur ; mada/STC Pay (KSA), CMI/Payzone (MA) ; `toMinorUnits` par devise | M | Socle pays |
| **`GuestRegistrationProvider` par pays** | Interface + registry ; `KsaShomoosProvider`, `MoroccoDgsnProvider`, `FranceGuestRegistrationProvider` ; appels en `afterCommit` | M (L Shomoos) | Socle pays, KMS (PII) |
| **FX + fuseaux + week-end/Hijri** | 3 rôles de devise (affichage/règlement/compta), taux ECB/BAM/SAMA ; PriceEngine lit `country.weekend_days` (ven/sam KSA) ; `HijrahChronology` pour le yield Eid/Ramadan/Hajj | M | Socle pays, PriceEngine |

---

## 2. Objectifs techniques par domaine

### 1. Channel Management
- **CM natif top-tier + Channex en fallback** (abstraction `ChannelConnector` unique) — **XL**. *Décision : pas de bascule binaire — promouvoir en direct Airbnb (finir host-profile)/Booking (viser Premier)/Vrbo, garder Channex pour la longue traîne + MENA.*
- **Sync restrictions + rate plans channel-specific** (`pushRestrictions` par adapter depuis `RestrictionEngine`) — **L**.
- **OTAs MENA réels** (Gathern KSA en tête ; API gated → fallback Rentals United/Channex/iCal) — **XL**.
- **Résilience généralisée** (retries idempotents, DLT Kafka, reconciliation, fin des `catch(Exception)` avaleurs) — **M**.

### 2. Booking engine & site direct
- **Emails transactionnels** (confirmation `afterCommit` + rappels en timezone propriété, via Brevo/Postal) — **M / P0**.
- **i18n + RTL embarqués dans `booking-sdk`** (bundles fr/en/ar, `dir=rtl` auto, CSS logique) — **M / P0**.
- **SEO serveur indexable** (`SeoMetaService`, sitemap, JSON-LD, hreflang) — **L / P1**.
- **Builder de pages no-code** (`SiteTemplate`/`PageLayout` JSONB + rendu serveur) — **XL / P1**.

### 3. Calendrier & multi-tenant
- **Édition groupée massive multi-propriété** (lock `pg_advisory` **par bien**, 1 transaction/item via bean séparé, tolérance aux échecs partiels) — **L / P0**.
- **Ownership systématique** (`requireSameOrganization` après chaque `findById` + tests ArchUnit/IDOR) — **S / P0**.
- **Owner portal calendrier interactif** (scopé `ManagementContract`) — **L / P1**.
- **Multi-unit / unit groups** (`UnitGroup` + allocation auto + contrainte unique anti-double-booking) — **XL / P2**.

### 4. Tarification / Yield
- **Productiser l'IA pricing** `OFF→SHADOW→RECOMMEND→AUTO` (enum par org, table `price_recommendation`, appel LLM hors transaction) — **L**.
- **Pipeline de recommandation CAS-safe** (prix résolu/suggéré/appliqué séparés, UPDATE conditionnel) — **M**.
- **`PriceSimulationService` fiscal-aware** (PriceEngine→FiscalEngine, `PriceBreakdownDto` HT/TVA/TTC par pays, affichage TTC MA/KSA) — **M**.
- **Connecteur Beyond** (+ factory Wheelhouse/DPGO) sur le pattern `ExternalPricingService` — **M**. + week-end locale-aware & saisonnalité **Hijri**.

### 5. Opérations & 11. Mobile
- **Entité `Issue` + machine à états** (REPORTED→…→CLOSED, conversion depuis photo ISSUE) — **L**.
- **Checklists configurables par unité** (+ photos de référence, snapshot immutable) — **L**.
- **Marketplace prestataires + backup auto** (`ServiceProvider`, UPDATE conditionnel anti-double-acceptation) — **L**.
- **Câblage biométrie mobile** (`expo-local-authentication`, repli PIN) — **S**.
- **RTL + arabe mobile** (`I18nManager.forceRTL`, styles start/end) — **L**. + util fuseau propriété.

### 6. Communication voyageurs
- **Activer le copilote IA** (flag `messaging-ai`, UX inbox, historique au prompt) — **S**.
- **Canal SMS natif multi-provider** (`SmsChannel` + `SmsProviderResolver` par pays : Brevo/Vonage FR, Unifonic/4Jawaly KSA) — **M**.
- **Autopilot IA à confiance bornée** (intentions sûres, seuil, horaires, escalade) — **L**.
- **KB messagerie via RAG pgvector** existant — **M**. + auto-traduction inbound + RTL.

### 7. Guest Experience & Livret
- **Caution / dépôt** (`SecurityDeposit` + pré-autorisation Stripe `capture_method=manual`, transitions via `PaymentStatusTransitionService`) — **M**.
- **KYC réel au check-in** (`SumsubKycStrategy` HMAC + WebSDK + webhook) — **M**.
- **`GuestRegistrationProvider`** (Shomoos KSA / DGSN Maroc / fiche police FR) — **L**.
- **Livret auto-traduit + RTL réel** (contenu canonique → variantes via `TranslationService`) — **M**. + Viator live.

### 8. Finance & Comptabilité
- **`EInvoicingProvider` + registry** (par `Country`) — **L**.
- **`ZatcaProvider` Fatoora Phase 2** (UBL 2.1, XAdES ECDSA, chaîne PIH/ICV atomique, QR TLV, CSID en KMS, clearance B2B / reporting B2C) — **XL** (éclaté en 4 features P0).
- **`FrancePdpProvider` Factur-X** (PDF/A-3 + XML CII, pont PDP) — **XL**.
- **Caution `SecurityDeposit`** (auth-hold) — **L**.
- **Sync comptable réelle QB/Xero/Sage** (`AccountingSyncProvider` calqué sur Pennylane) — **L**.
- **Compta multi-devise consolidée** (taux figé sur `LedgerEntry`, écarts de change) — **M**.

### 9. Reporting & Analytics
- **Delta N/N-1 backend opposable** (`PeriodComparisonDto`, calcul serveur) — **S**.
- **ReportBuilder léger + ShareLink** (`ReportView` JSONB, whitelist anti-injection, token public borné) — **L**.
- **Consolidation multi-devise analytics** (`convertToBase` sur tous les agrégats) — **M**.
- **Mappers de déclaration fiscale par pays** (CA3 FR / DGI MA / **VAT return ZATCA KSA**) — **M→L**. + forecast CA + market data (Key Data/AirDNA).

### 10. Intégrations & 12. Sécurité
- **Marketplace self-service + portail partenaire** (`IntegrationPartner` entité + workflow review) — **L**.
- **Connecteurs Zapier + Make** (sur webhooks REST Hooks + API keys existants) — **M**.
- **API publique versionnée + OpenAPI/Swagger** (springdoc, scopes, rate limit) — **L**.
- **2FA TOTP** (required action Keycloak + policy org) — **M**.
- **Signature par juridiction** (`signature_regime` pays : QES/AES eIDAS FR ; SES scellé PAdES horodaté MA/KSA ; brancher Yousign/DocuSeal déjà codés) — **L**.
- **Trajectoire SOC 2 Type I→II** (capitaliser AuditAspect + CI/CD) — **L**.

### 13. IA & automatisation
- **Activer le multi-agent en bêta** (flag par org, métriques Micrometer, kill-switch) — **M**.
- **`AnomalyDetectionService`** (fraude paiement / bruit Minut / no-show / écart ledger : règles + z-score + LLM) — **L**.
- **Autopilot messagerie** (confiance bornée + escalade) — **L**.
- **Durcir l'IA agentique** (`requireSameOrganization` dans les tools, rate-limit, audit) — **L**.
- **Assistant arabophone + RTL** & **vision métier avant/après ménage** — **M**.

---

## 3. Plan de mise en œuvre phasé (multi-pays)

| Phase | Horizon | Contenu technique | But |
|-------|---------|-------------------|-----|
| **Phase 0 — Socle & quick wins** | 0–3 mois | Entité `Country` + branchement registries + flag multi-country ON (pays OFF sauf FR) + régularisation Liquibase. **Activations** : flags IA (messagerie/analytics), biométrie mobile, delta N/N-1, 2FA, Zapier, ownership calendrier, email confirmation booking. | Non-régression FR + ROI immédiat |
| **Phase 1 — Transverses** | 3–9 mois | i18n/RTL complet (web+mobile+PDF), `EInvoicingProvider` + **Factur-X FR**, consolidation FX, `PaymentProviderRouter`, **caution Stripe**, IA pricing (shadow→reco), SMS, autopilot, `Issue`/checklists, SEO+builder booking, ReportBuilder. | Parité Hostaway/Guesty sur le socle |
| **Phase 2 — Maroc** | 6–12 mois | Activation CMI/Payzone via router, `MoroccoDgiProvider` (selon publication API DGI), **fiche police DGSN**, TVA MA (10%/20%), UI/livret arabe pour MA. | Lancement MA (risque modéré : rails déjà codés) |
| **Phase 3 — Arabie Saoudite** | 9–18 mois | **POC sandbox ZATCA d'abord**, puis `ZatcaProvider` Phase 2 (clearance/reporting), **Shomoos/Absher**, mada/PayTabs, week-end ven/sam, yield **Hijri**, assistant arabe. | Lancement KSA (chantier majeur) |
| **Phase 4 — Différenciation continue** | 12+ mois | Multi-agent GA, `AnomalyDetectionService`, marketplace ouvert, SOC 2 Type II, market data, CM natif top-tier, builder no-code. | Dépasser la parité |

---

## 4. Risques techniques majeurs

1. **ZATCA Phase 2 (KSA) — risque #1.** Crypto (XAdES/CSID), **chaîne PIH/ICV atomique** (concurrence → verrou pessimiste + contrainte unique, jamais de check-then-act), clearance synchrone **bloquante** (facture non *cleared* = invalide), certificats en **KMS** (jamais en BDD). → Sous-projet à part, **dérisquer par POC sandbox** avant tout engagement client KSA.
2. **RTL arabe — risque diffus.** Base présente mais détails : `sx` inline non auto-flippés, planning Gantt (axe temps inversé), graphiques, **PDF iText (reshaping/ligatures)**, **mobile RN** (`I18nManager` global + redémarrage app à architecturer d'emblée).
3. **Fiscalité Maroc — risque de planning.** Modèle confirmé (UBL 2.1, clearance, Simpl-TVA, obligatoire 2026-2027) mais **API technique DGI et seuils précis non finalisés** → `MoroccoDgiProvider` dépend d'une spec mouvante.
4. **Résidence des données.** RGPD/UE (FR), **loi 09-08** (MA), **PDPL** (KSA) → hébergement modèle/données par région via `ChatLLMRouter` multi-provider (Bedrock) ; à instruire avant lancement.
5. **Plafond Channex** (statut partenaire OTA premium inaccessible en revendeur) → arbitrage CM natif top-tier traité au domaine 1.

---

## 5. Utilisation du CSV

[data/40-feature-evolution.csv](data/40-feature-evolution.csv) — 189 features, colonnes : `Section, Fonctionnalite, Clenzy_actuel, Hostaway, Guesty, Cible, Evolution_fonctionnelle, Evolution_technique, Multipays_FR_MA_KSA, Composants_Clenzy, Effort, Priorite`.
- **Filtrer `Priorite=P0`** (23 features) pour le sprint d'amorçage.
- **Filtrer `Multipays_FR_MA_KSA` contient `KSA`** pour le périmètre Arabie Saoudite (ZATCA, Shomoos, mada, ven/sam, Hijri).
- **Filtrer `Cible=Differenciation`** (64) pour les paris au-delà de la parité.
