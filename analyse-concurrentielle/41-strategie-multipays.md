# Phase 4 — Architecture technique multi-pays (FR / MA / KSA)

> Document d'architecture transverse. Override du cap « France-only ».
> Cible : rendre Clenzy **nativement multi-pays**, pensé pour France + Maroc + Arabie Saoudite.
> Date : 2026-06-14. Auteur : architecte technique multi-pays.

**État réel du code (audit du 2026-06-14 — à connaître avant tout chiffrage).** Les fondations ne sont pas « à créer de zéro » : une partie substantielle existe déjà, mais **désactivée et incomplète**. Inventaire vérifié :

| Brique | État réel dans le code | Verdict |
|---|---|---|
| Flag `fiscal.multi-country.enabled` | `false` dans `application.yml:242` | Présent, OFF |
| `model/ExchangeRate.java` | Entité complète (base/target/rate/rateDate/source) | Présent |
| `service/ExchangeRateProviderService.java` | Job `@Scheduled` + `@PostConstruct`, source `open.er-api.com`, cibles MAD/SAR | **Présent et fonctionnel** (source ≠ banques centrales) |
| `model/FiscalProfile.java` | Entité 1:1 Organization (countryCode, currency, vatNumber, régime…) | Présent |
| `fiscal/TaxCalculator.java` + registry | Interface Strategy + `FranceTaxCalculator`/`MoroccoTaxCalculator`/`SaudiTaxCalculator` | **Présent** (abstraction faite) |
| `compliance/CountryComplianceStrategy.java` + registry | Interface + dossier `country/` | **Présent** (NF/DGI/ZATCA Phase 1 documentés) |
| `payment/PaymentProvider.java` + registry | Interface Strategy + `getSupportedCountries()`/`getSupportedCurrencies()` | **Présent** |
| Providers paiement | `StripePaymentProvider`, `PayTabsPaymentProvider`, `CmiPaymentProvider`, `PayzonePaymentProvider` + clients + `CmiHashService` | **Présents** |
| Payout | `PayoutExecutorRegistry` + `executor/`, `wise/`, `openbanking/` | Présent |
| i18n web | `ar.json` (231 KB, à parité), `fr.json`, `en.json` | **Présent** |
| RTL web | `stylis-plugin-rtl` + `rtlCache`/`ltrCache` dans `main.tsx`, `document.documentElement.dir`, `theme.direction`, `utils/textDirection.ts` (police Tajawal AR, sur-dimensionnement) | **Présent et partiellement câblé** |
| `EInvoicingProvider` | **N'existe pas** (aucune classe zatca/fatoora/facturx) | **À créer** |
| `GuestRegistrationProvider` (Shomoos/fiche police) | **N'existe pas** | **À créer** |
| Modèle `Country` / config pays | **N'existe pas** (countryCode dispersé sur Property + FiscalProfile) | **À créer (centralisation)** |
| i18n + RTL mobile (RN/Expo) | `fr.json`/`en.json` seulement, **pas d'`ar.json`, pas de `I18nManager`** | **À faire** |
| Migrations fiscales | `V79/V81/V82/V83/V85/V86…` au **format Flyway `V{n}__`** | **DETTE : à reprendre en Liquibase** (cf. CLAUDE.md) |

> **Conséquence stratégique.** Le multi-pays n'est pas un « grand projet from scratch » mais un **déverrouillage + complétion**. Le plus gros risque résiduel n'est pas l'architecture (déjà bonne, pattern Strategy + Registry homogène) mais : (1) l'**intégration ZATCA Phase 2** (clearance temps réel, crypto, certificats), (2) le **branchement de bout en bout** des abstractions existantes au moteur de pricing/facturation/réservation, (3) la **régularisation des migrations Flyway → Liquibase** avant d'activer le flag en prod.

---

## 1. Vision & principes

**Vision.** Clenzy doit être un PMS où le **pays est une donnée de premier ordre** : chaque propriété appartient à un pays, et c'est ce pays qui résout, de façon déclarative, *toute* la chaîne réglementaire et culturelle — fiscalité, e-invoicing, déclaration voyageurs, devise, fuseau, week-end de pricing, langue/RTL, format de date, signature légale. Aucun `if (country == "FR")` dispersé dans la logique métier : tout passe par des **Strategy résolues par pays** (le code en a déjà la bonne ossature).

**Principes directeurs.**

1. **Country-as-first-class.** Une entité `Country` (table de config) centralise toutes les capacités d'un pays. `Property.countryCode` → `Country` → providers résolus. On supprime la dispersion actuelle (`Property.country` + `FiscalProfile.countryCode` non synchronisés).
2. **Strategy + Registry partout (déjà le pattern maison).** `TaxCalculatorRegistry`, `ComplianceStrategyRegistry`, `PaymentProviderRegistry` existent. On **réplique exactement** ce pattern pour `EInvoicingProviderRegistry`, `GuestRegistrationProviderRegistry`, `LegalTemplateProviderRegistry`. Un pays non supporté → `UnsupportedCountryException` explicite (déjà présent), jamais un comportement par défaut silencieux.
3. **Activation par flag + par pays.** `fiscal.multi-country.enabled` reste le master switch ; en complément, chaque `Country.enabled` permet d'ouvrir un pays à la fois (FR d'abord, MA, puis KSA). Garde-fou : fail-fast au boot si une propriété pointe vers un pays activé sans provider e-invoicing/registration résolu.
4. **Le serveur recalcule, le client n'impose rien.** TVA/VAT, taxe de séjour, conversion de devise, montant facturé : **toujours recalculés serveur** depuis l'entité métier (règle absolue audit 2026-06 #1). La devise/locale d'affichage est cosmétique ; la devise de **règlement** et la devise de **comptabilité** sont des décisions serveur.
5. **Conformité = bloquant, pas best-effort.** En KSA, une facture non *cleared* par ZATCA n'est pas une facture. Au Maroc, idem (clearance DGI). Le flux doit traiter l'échec de clearance comme un **état de réconciliation explicite + notification admin** (règle audit #7 : jamais de `catch(Exception)` avaleur), pas comme un log silencieux.
6. **Effets externes hors transaction.** Tout appel ZATCA/DGI/Shomoos/PayTabs est un **appel HTTP externe** → jamais dans une transaction DB (règle audit #2). Préparer en transaction courte → appeler (idempotency key) → persister le résultat post-commit via `afterCommit`.
7. **i18n/RTL est une capacité produit, pas une traduction.** RTL arabe touche le layout, les icônes directionnelles, les graphiques, les PDF, le mobile. C'est un chantier transverse, pas un `ar.json`.

---

## 2. i18n & RTL

### 2.1 i18n (FR / EN / AR)

**Existant.** `client/src/i18n/` avec `config.ts` + `fr/en/ar.json`. L'arabe est déjà à ~parité (231 KB). Le mobile n'a que `fr/en`.

**Cible.**
- **Web** : maintenir la parité des 3 locales ; ajouter un **lint CI de complétude i18n** (clé manquante AR/EN = échec build) pour éviter la dérive constatée sur ce type de projet.
- **Mobile (RN/Expo)** : ajouter `ar.json` + brancher la détection de langue. Aligner le namespace sur le web pour réutiliser les traductions.
- **Booking engine (SDK)** : le widget annonce déjà fr/en/ar + RTL (primer) — vérifier la parité réelle des chaînes du tunnel de réservation/paiement (les chaînes paiement régional mada/STC Pay/CMI manquent).
- **Pluriels arabes** : l'arabe a **6 formes plurielles** (zero/one/two/few/many/other). i18next gère via ICU/`Intl.PluralRules` — auditer les chaînes avec compteurs (nuits, voyageurs, montants) qui sont aujourd'hui binaires (one/other).
- **Livret guest** : `welcome-guide/WelcomeBookView.tsx` utilise déjà `textDirection` — étendre à toutes les sections + activités.

### 2.2 RTL arabe

**Existant (bonne base).** `main.tsx` instancie `rtlCache` (emotion + `prefixer` + `stylis-plugin-rtl`) et `ltrCache`, swap selon `isRtl`, pose `document.documentElement.dir`, et `theme.direction = 'rtl'`. `utils/textDirection.ts` détecte l'arabe par plage Unicode et applique police Tajawal + sur-dimensionnement (+15-20%). C'est l'architecture RTL recommandée pour MUI v5 — **déjà en place**.

**À compléter / vérifier (le diable est dans les détails RTL).**
- **Logical properties.** Auditer les `marginLeft/Right`, `paddingLeft/Right`, `left/right`, `textAlign: 'left'` codés en dur → migrer vers `marginInlineStart/End`, `insetInlineStart`, `textAlign: 'start'`. `stylis-plugin-rtl` flippe le CSS généré par emotion, mais **pas** les valeurs inline `sx` numériques non logiques ni les SVG/icônes.
- **Icônes directionnelles.** Chevrons, flèches « précédent/suivant », sidebar collapse, breadcrumb `›`, progress steppers : doivent se miroir en RTL. Créer un helper `useDirectionalIcon` (swap ChevronLeft/Right selon `dir`).
- **Calendrier multi-propriétés.** Le planning Gantt horizontal (cœur du PMS) doit s'inverser en RTL (axe temps droite→gauche) — point dur, à tester explicitement.
- **Graphiques** (KPI dashboard, reporting). Recharts/MUI X Charts ne sont pas RTL-aware par défaut : axes, légendes, tooltips à inverser.
- **PDF/documents.** iText (utilisé pour le certificat de signature) nécessite un `BaseFont` arabe + `PdfWriter.RUN_DIRECTION_RTL` + reshaping arabe (ligatures contextuelles). Les templates email arabes : tester le rendu RTL des clients mail (Outlook casse souvent le RTL).
- **Mobile RTL.** RN exige `I18nManager.forceRTL(true)` + **redémarrage de l'app** pour basculer le layout. À architecturer dès le départ (le flip RN est global, pas par écran).
- **Polices arabes.** Embarquer **Tajawal** (déjà référencée) ou **IBM Plex Sans Arabic** (couvre latin+arabe, cohérence visuelle avec l'identité Clenzy). Self-host (pas de Google Fonts en prod, RGPD). Subset pour le poids.

### 2.3 Formats date / nombre / devise

- Utiliser **`Intl.DateTimeFormat` / `Intl.NumberFormat`** côté client, paramétrés par locale **et** par pays/devise de l'entité (pas par la langue UI). Ex : un host français regardant une propriété saoudienne voit le prix en SAR.
- **Chiffres arabes** : choix produit — chiffres arabes occidentaux (0-9, dits « arabic numerals ») recommandés pour la lisibilité business, vs chiffres arabo-indiens (٠-٩). Garder occidentaux + `font-variant-numeric: tabular-nums` (règle design Clenzy).
- **Calendrier Hijri** affichable en complément (cf. §8) via `Intl.DateTimeFormat('ar-SA-u-ca-islamic')`.

---

## 3. Modèle pays/locale

### 3.1 Entité `Country` (à créer — centralisation)

Aujourd'hui le pays est éclaté : `Property.country` (libellé libre) + `Property.countryCode` (alpha-2) + `FiscalProfile.countryCode`. **À centraliser** dans une table de config `country` :

```
country (
  code            CHAR(2) PK,        -- FR, MA, SA (ISO 3166-1 alpha-2)
  name_i18n       JSONB,             -- {fr,en,ar}
  default_currency CHAR(3),          -- EUR, MAD, SAR
  default_locale  VARCHAR(5),        -- fr-FR, fr-MA / ar-MA, ar-SA
  timezone        VARCHAR(40),       -- Europe/Paris, Africa/Casablanca, Asia/Riyadh
  weekend_days    VARCHAR(15),       -- SAT,SUN | FRI,SAT
  tax_calculator  VARCHAR(30),       -- bean key (FR/MA/SA)
  compliance_strategy VARCHAR(30),
  einvoicing_provider VARCHAR(30),   -- NONE | FACTURX_PDP | DGI_SIMPL | ZATCA_FATOORA
  guest_registration_provider VARCHAR(30), -- NONE | FR_DECLARATION | MA_STDN | KSA_SHOMOOS
  signature_regime VARCHAR(20),      -- EIDAS | MA_LAW_5320 | KSA_ECA
  vat_standard_rate NUMERIC(5,2),    -- 20.00 | 20.00 | 15.00
  enabled         BOOLEAN DEFAULT false
)
```

Cette table est la **source de capacités** : les registries résolvent le bean à partir de `country.tax_calculator` etc. Bénéfice : activer un pays = une ligne, sans déploiement.

### 3.2 Rattachement Organization / Property → pays

- **Organization** : pays « siège » (entité légale qui facture). Lié à `FiscalProfile` (déjà 1:1).
- **Property** : pays de **localisation** (où se trouve le bien) — c'est lui qui pilote la déclaration voyageurs, la taxe de séjour, le fuseau, le week-end de pricing. **Une org FR peut gérer un bien au Maroc** → il faut distinguer `org.country` (facturation) et `property.countryCode` (opérations locales). C'est le point d'architecture le plus important : **deux dimensions pays**, pas une.
- Migration : remplir `property.country_code` (déjà existant) comme FK logique vers `country.code` ; déprécier `property.country` (libellé libre).

### 3.3 Résolution de la locale (ordre de priorité)

1. Préférence utilisateur explicite (`user_preferences.language` — déjà en place).
2. Locale du contexte métier (booking engine guest : langue du guest ; livret : langue du séjour).
3. `Accept-Language` / i18next LanguageDetector.
4. Défaut org → défaut pays.

> **RTL ≠ langue.** `dir = 'rtl'` est dérivé de la **langue de rendu** (`ar`), pas du pays. Un host marocain peut préférer l'UI en français (LTR) tout en éditant des biens au Maroc.

### 3.4 Activation du flag

- `fiscal.multi-country.enabled=true` = master switch (active la résolution par pays au lieu du hardcode FR).
- Rollout progressif via `country.enabled` : FR (déjà conforme) → MA → KSA.
- **Fail-fast au boot** (pattern `EnvironmentValidator` maison) : si une propriété active référence un pays `enabled` dont le provider e-invoicing/registration n'est pas résolu, refuser le démarrage (évite la dérive prod-only).

---

## 4. Fiscalité & e-invoicing (FR / MA / KSA, focus ZATCA)

### 4.0 Abstraction `EInvoicingProvider` (à créer)

Le code a `TaxCalculator` (calcul de taxe) et `CountryComplianceStrategy` (mentions légales / numérotation) mais **pas** d'abstraction d'**émission/transmission** de facture électronique vers l'autorité. À créer, sur le même pattern :

```java
public interface EInvoicingProvider {
    String getCountryCode();
    EInvoicingMode getMode();              // NONE, FACTURX_PDP, DGI_CLEARANCE, ZATCA_CLEARANCE, ZATCA_REPORTING
    EInvoiceResult clear(Invoice invoice); // B2B/B2G : clearance synchrone (KSA standard, MA)
    EInvoiceResult report(Invoice invoice);// B2C : reporting <24h (KSA simplified)
    byte[] renderCompliantArtifact(Invoice invoice); // Factur-X PDF/A-3, UBL XML, PDF/A-3+XML
}
```
+ `EInvoicingProviderRegistry` (résout par `country.einvoicing_provider`).

Implémentations : `FrancePdpProvider`, `MoroccoDgiProvider`, `ZatcaFatooraProvider`.

### 4.1 France — NF + FEC + Factur-X / PDP

**Existant.** Clenzy génère déjà des documents NF (numérotation séquentielle, immutabilité, mentions légales via `FranceComplianceStrategy`). C'est l'avance la plus importante (cf. stratégie Axe 2).

**Cible.**
- **Factur-X** : facture hybride **PDF/A-3 + XML CII embarqué** (norme EN 16931). Générer le XML structuré et l'embarquer dans le PDF actuel.
- **PDP (Plateforme de Dématérialisation Partenaire)** : à partir du **1er septembre 2026**, toutes les entreprises assujetties TVA doivent pouvoir **recevoir** des factures électroniques via une plateforme agréée ; les GE/ETI doivent aussi **émettre**. **1er septembre 2027** : émission obligatoire pour TPE/PME/micro. Le Portail Public de Facturation (PPF) ne joue plus le rôle de plateforme de transit gratuit dans la version actuelle de la réforme — la majorité des entreprises passeront par une **PDP privée agréée**. [Confiance : élevée — calendrier confirmé multi-sources 2026 ; **paramètre mouvant** : périmètre exact PPF/PDP a déjà été révisé une fois.]
- **Architecture** : `FrancePdpProvider` parle à une PDP via API (Clenzy ne deviendra pas PDP — c'est un agrément lourd ; intégrer une PDP partenaire). Sanctions : **50 € / facture non conforme, plafond 15 000 €/an**.
- **FEC** : export du Fichier des Écritures Comptables (déjà attendu) — vérifier la complétude vs schéma DGFiP.

### 4.2 Maroc — TVA 20% + clearance DGI (Simpl-TVA)

**Faits réglementaires.** La DGI marocaine a **confirmé l'e-invoicing obligatoire en 2026** (base légale : Loi de finances 2018, art. 145-9). Modèle : **clearance / pré-validation** (CTC — Continuous Transaction Control), format **UBL 2.1**, **portail centralisé** (plateforme **Simpl-TVA**). Une facture doit être **pré-validée par la DGI avant d'être légalement valide**. Rollout **progressif par taille** : grandes entreprises / assujettis TVA au-dessus de seuils DGI **dès début 2026**, puis élargissement. Archivage **10 ans**, intègre/inaltérable. TVA standard **20%**. [Confiance : moyenne-élevée — modèle (UBL, clearance, portail centralisé) confirmé multi-sources ; **détails techniques de l'API Simpl-TVA et seuils précis encore en cours de publication** par la DGI.]

**Architecture `MoroccoDgiProvider`.**
- Mode `DGI_CLEARANCE` : sérialiser l'`Invoice` en **UBL 2.1**, soumettre à Simpl-TVA, attendre la validation (clearance) avant de marquer la facture émise.
- ICE (Identifiant Commun de l'Entreprise) obligatoire sur la facture (`MoroccoComplianceStrategy` doit l'exiger — champ à ajouter à `FiscalProfile`).
- Archivage 10 ans inaltérable (réutiliser l'immutabilité NF déjà en place).
- Taxe : `MoroccoTaxCalculator` (TVA 20% + **taxe de promotion touristique / taxe de séjour** communale) — vérifier que la logique existe ou est un stub.

### 4.3 KSA — ZATCA / Fatoora Phase 2 (le plus gros chantier)

**Faits réglementaires (datés + sourcés).**
- ZATCA Phase 2 = **intégration temps réel** avec la plateforme **Fatoora**. Déploiement **par vagues** ; en 2026 : **Wave 23 (deadline 31/03/2026)** = assujettis > **750 000 SAR** de CA TVA ; **Wave 24 (deadline 30/06/2026)** = seuil abaissé à **375 000 SAR** (entrée massive des PME). [Confiance : élevée — vagues confirmées multi-sources 2026.]
- **VAT standard 15%**.
- **Deux régimes** :
  - **B2B / B2G = Clearance (temps réel).** L'`Invoice` (XML) est soumise à Fatoora **avant** envoi au client ; ZATCA valide + applique un **cryptographic stamp** + renvoie la facture *cleared* ; l'émetteur la transmet ensuite au destinataire.
  - **B2C = Reporting (<24h).** La facture simplifiée (avec QR code + cryptographic stamp) est remise au client **immédiatement**, puis **reportée à Fatoora en XML sous 24h**.
- **Format** : **UBL 2.1** (XML) ; les Standard Tax Invoices peuvent être **XML ou PDF/A-3 (avec XML embarqué)** ; les Simplified (B2C) en **XML** pour le reporting.
- **Cryptographic stamp** : signature cryptographique (XAdES) garantissant authenticité + intégrité.
- **PIH (Previous Invoice Hash)** : chaque facture embarque le **hash SHA-256 base64 de la facture précédente** → chaîne de confiance inviolable (rupture = alerte fraude).
- **CSID (Cryptographic Stamp Identifier)** : certificat = « carte d'identité » du système émetteur. Deux types : **Compliance CSID** (onboarding/test) et **Production CSID** (live, après réussite des tests de conformité).
- **QR code TLV** : encodage **Tag-Length-Value** base64 (vendeur, n° TVA, timestamp, total TTC, montant TVA, hash, signature, clé publique).
[Confiance : élevée pour le modèle Phase 2 ; les specs exactes (UBL subset, XAdES profile, ordre des tags TLV) sont dans la doc technique ZATCA « E-Invoicing Detailed Guideline v2 » à suivre à la lettre.]

**Architecture `ZatcaFatooraProvider` (chantier majeur).**

1. **Onboarding / certificats (préalable).**
   - Générer une **CSR** (Certificate Signing Request) avec les attributs EGS (Egs unit) requis.
   - Appeler l'API ZATCA **Compliance CSID** → obtenir le certificat de compliance + secret.
   - Passer la **batterie de tests de conformité** (jeux d'invoices standard/simplified, debit/credit notes).
   - Demander le **Production CSID** → certificat de prod. Stocker les certificats/secrets de façon chiffrée (KMS / Vault — pas en clair en base ; soupape de chiffrement déjà au backlog infra).

2. **Génération facture.**
   - Sérialiser l'`Invoice` en **UBL 2.1** conforme au subset ZATCA (champs obligatoires, codes UNCL).
   - Calculer le **PIH** (hash de la facture précédente de la chaîne — nécessite un **séquencement ordonné par EGS unit**, attention concurrence : règle audit #8, pas de check-then-act ; verrou/sequence DB atomique sur la chaîne).
   - **Hash + signature XAdES** avec le Production CSID (cryptographic stamp).
   - Générer le **QR TLV** base64.

3. **Transmission.**
   - **B2B** : `POST` clearance API → recevoir la facture *cleared* (stamp ZATCA) + `clearanceStatus` → seulement alors la facture est valide et transmissible. **Hors transaction DB** ; idempotency ; échec = état `CLEARANCE_FAILED` + notif admin (jamais de retry silencieux qui casserait la chaîne PIH).
   - **B2C** : remettre la facture au guest immédiatement (QR + stamp), puis **`POST` reporting API < 24h** (job asynchrone, retries bornés, DLT Kafka — réutiliser l'Outbox existant).

4. **PDF.** Le PDF/A-3 doit embarquer le XML signé + afficher le QR TLV ; rendu **RTL arabe** (iText + reshaping, cf. §2.2).

> **Pourquoi c'est le plus gros risque :** crypto (XAdES, CSID, PIH chain), onboarding certificat à étapes, deux régimes (clearance synchrone bloquant vs reporting 24h), format UBL strict, concurrence sur la chaîne de hash, et **zéro tolérance** (facture non *cleared* = invalide). C'est un sous-projet à part entière, à dérisquer par un POC sandbox ZATCA avant tout engagement client KSA.

---

## 5. Paiements & payouts

### 5.1 Encaissement — résolution du provider par pays/devise

**Existant (excellente base).** `PaymentProvider` (Strategy) expose `getSupportedCountries()` + `getSupportedCurrencies()` ; `PaymentProviderRegistry` ; providers `Stripe`, `PayTabs`, `CMI`, `Payzone` + clients + `CmiHashService`. `PaymentProviderType` enum {STRIPE, PAYTABS, CMI, PAYZONE}.

**Cible — table de routage par pays :**

| Pays | Provider(s) cible | Méthodes locales clés | Devise |
|---|---|---|---|
| FR / EU | **Stripe** (Connect + Checkout) | CB, Apple/Google Pay, SEPA | EUR |
| Maroc | **CMI** (historique, dominant), **Payzone** | cartes locales MA, schémas domestiques | MAD |
| KSA | **PayTabs** / **HyperPay** / **Tap** / **Moyasar** (tous **SAMA-licensed**) | **mada** (réseau débit national, >70% des acheteurs SA), **STC Pay** (wallet), Apple Pay, Visa/MC, BNPL (Tabby/Tamara) | SAR |

[Confiance : élevée — providers SAMA-licensed et mada/STC Pay confirmés 2026.]

**Architecture de résolution.**
- `PaymentProviderRouter` : input = `country` + `currency` (+ méthode souhaitée) → sélectionne le provider via le registry (`getSupportedCountries().contains(country)`). Aujourd'hui Stripe est probablement câblé en dur dans les services métier (`StripeCheckoutSessionFactory`, etc.) → **introduire le router** pour que la création de paiement passe par le registry, pas par `StripeService` directement. C'est le principal travail de branchement côté paiement.
- **mada** est un réseau de **débit** : taux d'acceptation et flux 3DS spécifiques → tester le BIN routing (PayTabs/HyperPay le gèrent, mais le tunnel booking doit afficher mada explicitement).
- **CMI** : flux **redirect + hash** (déjà `CmiRedirectController` + `CmiHashService`) — pas d'API moderne type Stripe, attention au flux retour/webhook.

### 5.2 Payouts (reversements multi-propriétaires / conciergerie)

**Existant.** `PayoutExecutorRegistry` + `executor/`, `wise/`, `openbanking/`.
**Cible par pays :**
- FR/EU : **Stripe Connect** (déjà) ou virement SEPA.
- KSA : virement local SAR (SARIE) — Stripe Connect n'opère pas en KSA pour les payouts ; prévoir **Wise** (déjà câblé) ou un partenaire local.
- Maroc : virement local MAD ; le **contrôle des changes marocain (Office des Changes)** restreint les flux sortants en devises → un payout transfrontalier MAD→EUR n'est pas trivial. Privilégier des payouts **domestiques** (org marocaine paie des propriétaires marocains en MAD).
- Le `PayoutExecutorRegistry` résout déjà par stratégie : ajouter la dimension pays/devise au routing.

### 5.3 Règles transverses paiement (audit 2026-06)

- Montant **recalculé serveur** (jamais le montant client) — règle #1.
- Appel provider **hors transaction** + idempotency keys — règle #2 (Stripe le fait via `StripeGateway`/`StripeAmounts.toMinorUnits` ; vérifier que PayTabs/CMI suivent : `StripeAmounts` est Stripe-spécifique, il faut un **équivalent par devise** car SAR/MAD/EUR n'ont pas tous 2 décimales mineures identiques — SAR=2, MAD=2, mais **certaines devises = 0 ou 3** : généraliser `toMinorUnits` par devise).
- Transition de statut via CAS (`PaymentStatusTransitionService`) — règle #(transition).

---

## 6. Conformité & déclaration voyageurs

### 6.0 Abstraction `GuestRegistrationProvider` (à créer)

```java
public interface GuestRegistrationProvider {
    String getCountryCode();
    GuestRegistrationResult register(Reservation res, List<GuestIdentity> guests);
    GuestRegistrationStatus checkStatus(String externalRef);
    boolean requiresIdDocument();      // KSA/MA : pièce d'identité obligatoire
    Set<RequiredField> requiredFields();
}
```
+ `GuestRegistrationProviderRegistry` (résout par `country.guest_registration_provider`).

> Le module `compliance/` existant (mentionné dans la stratégie comme « stub Chekin ») couvre les mentions documentaires, pas la **transmission aux autorités**. C'est cette transmission qui est à construire.

### 6.1 France — fiche / déclaration

- **Fiche individuelle de police** pour les **touristes étrangers** (obligation hébergeur). Pas de transmission API centralisée nationale obligatoire pour les meublés (vs hôtels) — la fiche est **conservée et tenue à disposition** (police/gendarmerie 6 mois). [Confiance : élevée.]
- À venir : **registre national des meublés** (loi Le Meur, ~20/05/2026) — déclaration en mairie / téléservice (cf. stratégie Axe 2).
- `FranceGuestRegistrationProvider` : génère + archive la fiche, gère le registre quand l'API sera publiée.

### 6.2 KSA — Shomoos (obligatoire)

- **Shomoos** : système de sécurité **centralisé** (Royal Decree 2014), rattaché au **National Information Center / Ministry of Interior**. **Obligatoire** : tout établissement d'hébergement **partage automatiquement les données invités** avec les autorités. [Confiance : élevée — Shomoos confirmé, intégrations PMS existantes (ex. Hotelogix).]
- **Absher** : plateforme MoI grand public (services citoyens/visiteurs) — pas le canal d'enregistrement hôtelier mais l'écosystème d'identité ; pertinent pour la vérification d'identité du guest. [Confiance : moyenne sur le rôle exact dans le flux meublé.]
- `KsaShomoosProvider` : à la confirmation de réservation (check-in), transmettre identité + pièce + détails séjour à Shomoos. **Donnée d'identité sensible** → chiffrement + minimisation + base légale.

### 6.3 Maroc — fiche de police / DGSN (STDN)

- Tout exploitant d'hébergement touristique doit **télé-déclarer** arrivées / nuitées / départs **quotidiennement avant 8h** sur le portail **`stdn.ma`** (Système de télé-déclaration des nuitées, DGSN). Bulletin individuel (nom, prénom, CSP, séjour) transmis police + Gendarmerie Royale. Archivage de la fiche **1 an**. [Confiance : élevée.]
- `MoroccoStdnProvider` : agrège les nuitées par propriété et émet la déclaration quotidienne (job `@Scheduled` avant 8h, fuseau **Africa/Casablanca**).

---

## 7. Devises & FX

**Existant.** `ExchangeRate` (base/target/rate/rateDate/source, défaut `ECB`) + `ExchangeRateProviderService` (job `@Scheduled` + `@PostConstruct`, source `open.er-api.com`, cibles MAD/SAR). **Fonctionnel mais source unique non-banque-centrale.**

**Cible.**
- **Trois rôles de devise à ne pas confondre** :
  1. **Devise d'affichage** (cosmétique, locale guest/host) — conversion à titre indicatif via `ExchangeRate`.
  2. **Devise de règlement** (celle débitée au guest) — déterminée par le provider/pays, **pas** convertie côté Clenzy.
  3. **Devise comptable** (celle de la facture / du FEC / de la TVA) — devise du `FiscalProfile` de l'org émettrice ; **figée à la date de facture** (taux historique `rateDate`).
- **Source des taux** : pour la **comptabilité**, privilégier des taux officiels : **ECB** (EUR, déjà défaut), **Bank Al-Maghrib (BAM)** pour MAD, **SAMA** pour SAR. La source actuelle (open.er-api) convient pour l'affichage mais **pas** pour une conversion fiscale opposable → ajouter des providers BAM/SAMA ou documenter le taux retenu. Le champ `source` existe déjà pour tracer.
- **Arrondis par devise** : `RoundingMode` explicite + nombre de décimales mineures par devise (EUR/MAD/SAR = 2 ; généraliser `StripeAmounts.toMinorUnits` qui est aujourd'hui Stripe-only). **BigDecimal `compareTo` jamais `equals`** (règle audit #10).
- Stocker le **taux utilisé** sur chaque facture/transaction convertie (auditabilité).

---

## 8. Fuseaux, week-end, calendrier Hijri

### 8.1 Fuseaux

- **Europe/Paris** (FR), **Africa/Casablanca** (MA), **Asia/Riyadh** (KSA, pas de DST).
- Règle absolue (audit #9) : **toujours `property.getTimezone()`**, jamais la zone JVM — y compris parsing iCal (suffixe Z, TZID), check-in/out, calcul de nuits, jobs de déclaration (STDN avant 8h heure marocaine). `Property` doit porter/dériver son timezone depuis `country.timezone` (avec override propriété possible — le Maroc a une zone unique, KSA aussi, la France métropolitaine aussi).

### 8.2 Week-end & pricing WEEKEND

- **KSA = week-end vendredi/samedi** (officiel depuis 2013, stable) ; **MA & FR = samedi/dimanche**. [Confiance : élevée.]
- Le **PriceEngine** applique des tarifs « week-end » : aujourd'hui probablement câblé en dur sur sam/dim. → Lire les **`weekend_days` du pays** (table `country`) pour déterminer quels jours sont « week-end » au niveau pricing/yield. Sinon : sous-tarification systématique du jeudi-soir KSA et sur-tarification du dimanche.

### 8.3 Calendrier Hijri (yield Ramadan / Aïd)

- Le calendrier islamique **dérive de ~10-11 jours/an** vs grégorien ; Ramadan, **Aïd al-Fitr** (≈ 25 Ramadan → 5 Shawwal) et **Aïd al-Adha** (5 → 15 Dhu al-Hijjah) **bougent chaque année**.
- Impact tourisme KSA **confirmé** : pics de demande Eid (Jeddah, AlUla, Abha en tête), bookings domestiques +55%, surge religieux (Umrah) pendant Ramadan. → Ces périodes sont des **événements de yield majeurs**. [Confiance : élevée.]
- **Architecture** : un `HijriCalendarService` (via `java.time.chrono.HijrahChronology` ou `Intl ar-SA islamic`) génère, par année grégorienne, les fenêtres Ramadan/Eid pour alimenter le **PriceEngine** (saison promotionnelle / yield rule « Eid » par pays). Les dates Hijri étant à confirmation lunaire (variabilité ±1 jour), prévoir un **ajustement manuel admin** par an plutôt qu'un calcul figé.
- Pertinent aussi MA (Ramadan/Aïd influencent la demande) mais avec un profil différent (souvent **baisse** de la demande loisir pendant Ramadan, hausse Aïd) → la règle de yield est **par pays**, pas globale.

---

## 9. Légal & signature

**Existant.** Signature électronique interne (SES) via `/sign/{token}`, provider `CLENZY_CUSTOM`, certificat iText apposé au PDF (mandat). Providers Yousign/DocuSeal codés non branchés (cf. mémoire projet).

**Cible — abstraction par juridiction.**
- **Templates de mandat & CGV par pays** : `LegalTemplateProvider` résolu par `country` (mandat de gestion FR vs MA vs KSA, CGV, mentions obligatoires, langue — AR pour MA/KSA). Réutiliser le moteur de templates documentaires existant.
- **Signature conforme par régime** :
  - **FR/EU** : **eIDAS** — la SES interne suffit pour un mandat ; pour une valeur probante renforcée, AES/QES via QTSP (Yousign déjà codé). [Confiance : élevée.]
  - **KSA** : **Electronic Transactions Law** (signature électronique reconnue ; certificats via autorités locales). La SES interne peut ne pas suffire pour certains actes — à valider juridiquement par marché. [Confiance : moyenne — cadre existe, applicabilité au mandat de gestion à confirmer.]
  - **Maroc** : **loi 53-05** sur l'échange électronique de données juridiques (signature électronique). [Confiance : moyenne.]
- Le `country.signature_regime` ({EIDAS, MA_LAW_5320, KSA_ECA}) sélectionne le provider/niveau requis ; pas de logique légale en dur.
- **RTL des PDF légaux** arabes (cf. §2.2) — point dur partagé avec l'e-invoicing.

---

## 10. Plan de mise en oeuvre (phases techniques)

> Principe : **déverrouiller et compléter** l'existant, pays par pays, en activant `country.enabled` graduellement. FR est déjà conforme → c'est la base de non-régression.

**Phase 0 — Socle pays (prérequis transverse). Effort M.**
- Créer la table/entité `Country` (centralisation) + migration **Liquibase** (et régulariser les migrations Flyway `V79–V101` héritées).
- Brancher les registries existants sur `country.*` (résolution dynamique du bean).
- Distinguer `org.country` (facturation) vs `property.countryCode` (opérations).
- Activer `fiscal.multi-country.enabled=true` en gardant tous les pays `enabled=false` sauf FR. Fail-fast au boot.
- *Sortie* : FR fonctionne via la résolution par pays, zéro régression.

**Phase 1 — i18n/RTL complet (transverse, parallélisable). Effort M→L.**
- Audit logical-properties + icônes directionnelles + calendrier RTL + graphiques RTL (web).
- Lint CI de complétude i18n (fr/en/ar).
- Mobile : `ar.json` + `I18nManager` RTL.
- PDF arabe (iText + reshaping) — prérequis pour facture/mandat KSA/MA.
- *Sortie* : UI/PDF arabes propres, base pour MA et KSA.

**Phase 2 — Maroc (le moins risqué des deux nouveaux marchés). Effort L.**
- `MoroccoTaxCalculator` complet (TVA 20% + taxe touristique), ICE sur `FiscalProfile`.
- `MoroccoDgiProvider` (UBL 2.1 + clearance Simpl-TVA) — **à caler sur la publication finale de l'API DGI**.
- `MoroccoStdnProvider` (télé-déclaration `stdn.ma` quotidienne avant 8h).
- Routage paiement CMI/Payzone (déjà codé) via le router ; payouts domestiques MAD.
- FX BAM ; week-end sam/dim (identique FR) ; yield Ramadan/Aïd MA.
- *Sortie* : `country.enabled=true` pour MA.

**Phase 3 — KSA (chantier majeur, à dérisquer par POC). Effort L (XL sur ZATCA).**
- **POC ZATCA sandbox d'abord** : onboarding CSID compliance, génération UBL 2.1, XAdES, PIH chain, QR TLV, clearance + reporting. Dérisque avant engagement client.
- `ZatcaFatooraProvider` complet (clearance B2B + reporting B2C <24h, certificats KMS).
- `SaudiTaxCalculator` (VAT 15% + municipality fees).
- `KsaShomoosProvider` (transmission identités au check-in).
- Routage paiement PayTabs/HyperPay/Tap (mada + STC Pay) ; payouts SAR via Wise/local.
- FX SAMA ; **week-end ven/sam** dans le PriceEngine ; yield Hijri (Eid/Umrah).
- Signature : valider le régime KSA (ECA) juridiquement.
- *Sortie* : `country.enabled=true` pour KSA.

**Phase 4 — Légal & polish transverse. Effort M.**
- `LegalTemplateProvider` par pays (mandat/CGV AR) ; `signature_regime` par pays.
- Brancher Yousign/DocuSeal si valeur probante renforcée requise.
- Durcissement conformité (états de réconciliation clearance, monitoring, alerting).

---

## 11. Sources datées

> Recherche web du 2026-06-14. Confiance indiquée par item ; les paramètres réglementaires « mouvants » sont signalés en section.

**ZATCA / Fatoora (KSA) — confiance élevée**
- ClearTax — *ZATCA Wave 24 (deadline 30/06/2026, seuil 375 000 SAR)* : https://www.cleartax.com/sa/zatca-wave24-einvoicing-in-saudi-arabia
- EY — *Saudi Arabia 23rd wave Phase 2 (deadline 31/03/2026, seuil 750 000 SAR)* : https://www.ey.com/en_gl/technical/tax-alerts/saudi-arabia-announces-23rd-wave-of-phase-2-e-invoicing-integration
- ZATCA (officiel) — *E-Invoicing Implementation Resolution* : https://zatca.gov.sa/en/E-Invoicing/Introduction/LawsAndRegulations/Documents/E-Invoicing%20Implementation%20Resolution_EN.pdf
- ZATCA (officiel) — *E-Invoicing Detailed Guideline v2 (mai 2023)* : https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-Invoicing_Detailed__Guideline.pdf
- Qeemah — *Digital Signature & CSID guide (Compliance vs Production CSID)* : https://qeemahcloud.com/en/blog/zatca-digital-signature-csid-certificate-guide/
- The Invoicing Hub — *Clearance B2B vs Reporting B2C, stamp cryptographique* : https://www.theinvoicinghub.com/zatca-e-invoicing-mandate-in-saudi-arabia-the-complete-guide/
- Fatoora Developer Community — *PIH (SHA-256 base64 facture précédente)* : https://zatca1.discourse.group/t/clarification-on-previous-invoice-hash-pih-calculation/4872
- DEV Community — *UBL XML + XAdES signing + hash chains (impl. de référence)* : https://dev.to/webkoding/implementing-zatca-phase-2-e-invoicing-in-woocommerce-ubl-xml-xades-signing-and-hash-chains-1682

**E-invoicing Maroc (DGI) — confiance moyenne-élevée (API détaillée à venir)**
- EDICOM — *Maroc e-invoicing 2026, UBL + modèle CTC* : https://edicomgroup.com/blog/morocco-electronic-invoicing
- VATCalc — *Morocco e-invoicing pre-clearance 2026* : https://www.vatcalc.com/morocco/morocco-e-invoicing-2026/
- VATupdate — *Morocco mandatory e-invoicing 2026* : https://www.vatupdate.com/2025/11/04/morocco-to-implement-mandatory-e-invoicing-in-2026/
- OrchidaTax — *Simpl-TVA API, conformité Maroc* : https://orchidatax.com/country-compliance/morocco-regulations/

**E-invoicing France (Factur-X / PDP) — confiance élevée (périmètre PPF/PDP mouvant)**
- Bpifrance — *Réforme facturation électronique 2026* : https://conseil.bpifrance.fr/publications/facturation-electronique-obligatoire-un-tournant-digital-pour-les-entreprises-francaises
- Pennylane — *Calendrier 09/2026 (réception) / 09/2027 (émission TPE-PME)* : https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/reforme-facturation-electronique
- Les Experts-Comptables — *Guide PDP* : https://les-experts-comptables.fr/ressources/facturation-electronique-guide-pdp

**Déclaration voyageurs — confiance élevée**
- Hotel News Resource — *Shomoos (Royal Decree 2014, National Information Center, MoI)* : https://www.hotelnewsresource.com/article133315.html
- Médias24 — *Maroc, télé-déclaration des nuitées (portail STDN)* : https://medias24.com/2017/03/29/hotellerie-comment-proceder-a-la-tele-declaration-des-nuitees/
- Service-Public.fr — *Fiche individuelle de police touristes étrangers (FR)* : https://www.service-public.gouv.fr/particuliers/vosdroits/F33458

**Paiements KSA — confiance élevée**
- GulfSaasReview — *Gateways SAMA-compliant (HyperPay, PayTabs, Tap, Moyasar), mada* : https://gulfsaasreview.com/guide/best-payment-gateways-saudi-arabia-2026
- Symloop — *mada + STC Pay e-commerce KSA 2026* : https://www.symloop.com/blog/ecommerce-solutions-saudi-arabia-mada-2026/

**Week-end & calendrier Hijri — confiance élevée**
- KSACalc — *Week-end KSA ven/sam, semaine dim-jeu* : https://ksacalc.com/learn/saudi-working-days-explained/
- Saudipedia — *Jours fériés officiels (Eid al-Fitr / Eid al-Adha, fenêtres Hijri)* : https://saudipedia.com/en/official-holidays-in-saudi-arabia
- Saudishopper — *Demande Eid al-Fitr 2026 (Jeddah/AlUla/Abha)* : https://saudishopper.com.sa/en/eid-al-fitr-travel-demand-saudi-arabia-2026/
- Travel And Tour World — *Demande Ramadan/Umrah 2026 KSA* : https://www.travelandtourworld.com/news/article/saudi-domestic-and-international-travel-demand-now-rises-during-ramadan-2026-driven-by-umrah-and-family-travel/
