# ZATCA Fatoora Phase 2 — Spécification d'implémentation technique (POC-ready)

> **Cible** : déverrouiller l'e-invoicing KSA pour Clenzy via un provider `ZatcaFatooraProvider`
> branché sur l'abstraction `EInvoicingProvider` (cf. [41-strategie-multipays.md §4](../41-strategie-multipays.md), [42-objectifs-techniques.md](../42-objectifs-techniques.md)).
> **Statut** : spec d'amorçage de POC sandbox — c'est le **risque technique n°1** du programme multi-pays.
> **Date** : 2026-06-14. **Auteur** : agent-architecte. **Confiance** : voir §14 par fait.
> **Périmètre TVA** : KSA, taux standard **15 %** (depuis 2020). Vagues 2026 : **Wave 23 — 31/03/2026** (CA TVA > 750 000 SAR) ; **Wave 24 — 30/06/2026** (CA TVA > 375 000 SAR).

---

## 1. Périmètre & modèle réglementaire (daté/sourcé)

### 1.1 Ce que ZATCA Phase 2 (« Integration ») impose

| Exigence | Détail | Confiance |
|---|---|---|
| **Format facture** | UBL 2.1 (XML), aligné EN 16931. Standard Tax Invoice peut aussi être PDF/A-3 + XML embarqué. Simplified = XML. | Élevée |
| **Deux régimes** | **Clearance B2B/B2G** (temps réel, *avant* remise au client) ; **Reporting B2C** (facture remise immédiatement, reportée **< 24 h**). | Élevée |
| **Signature** | Cryptographic stamp **XAdES** (profil BES — certains éditeurs documentent EPES sur le B2C), **ECDSA courbe secp256k1**, hachage **SHA-256**, canonicalisation **C14N**. | Élevée (secp256k1 + XAdES-BES confirmés multi-sources) |
| **Chaîne d'intégrité** | **PIH** (Previous Invoice Hash) = SHA-256 **base64** du XML signé de la facture précédente ; **ICV** (Invoice Counter Value) = entier séquentiel démarrant à 1. | Élevée |
| **QR code** | TLV (Tag-Length-Value) base64, **9 tags** en Phase 2 (5 en Phase 1 + 4 tags crypto), obligatoire sur **simplified ET standard**. | Élevée |
| **Certificats** | CSID via CSR + OTP portail Fatoora : **Compliance CSID (CCSID)** → tests de conformité → **Production CSID (PCSID)**. | Élevée |
| **VAT** | TVA standard **15 %** ; n° VAT vendeur = **15 chiffres**. | Élevée |
| **EGS** | Chaque « EGS unit » (E-invoice Generation Solution) = un device/solution onboardé séparément, avec sa propre paire de clés, son PCSID et **sa propre chaîne PIH/ICV**. | Élevée |

### 1.2 Régimes — quelle facture suit quel flux

- **Standard Tax Invoice (B2B/B2G)** → **Clearance** : le XML signé est `POST` à ZATCA **avant** transmission au client. ZATCA valide, appose le cryptographic stamp (tag 9 = signature ZATCA de la clé publique) et retourne la facture *cleared*. Tant que `clearanceStatus != CLEARED`, **la facture n'est pas valide et ne doit pas être transmise**.
- **Simplified Tax Invoice (B2C)** → **Reporting** : la facture (QR + stamp interne) est remise au guest immédiatement, puis `POST` à ZATCA **dans les 24 h** (`reportingStatus`). Le flux Clenzy B2C type = **facture guest de séjour** (la grande majorité des cas PMS).

> **Implication produit Clenzy.** Une location courte durée à un particulier = **B2C → reporting**. Une facture de commission/mandat à un propriétaire-entreprise assujetti, ou une facture B2B (agence, société) = **B2B → clearance**. Le routage clearance/reporting se déduit du **type de facture + statut TVA de l'acheteur** (cf. `InvoiceType` existant : `GUEST` vs `COMMISSION`/B2B).

### 1.3 Hors périmètre POC (mais cadré)

- Multi-EGS (parc de devices) : le modèle de données le prévoit (§3), le POC onboarde **1 EGS unit**.
- Credit/Debit notes ZATCA (types 381/383) : structure prévue, **tests de conformité obligatoires** mais hors chemin critique POC initial (à ajouter avant prod — la batterie de conformité ZATCA les exige).
- Factur-X FR / DGI MA : autres implémentations du **même** `EInvoicingProvider` (cf. §2), non traitées ici.

---

## 2. Architecture (`EInvoicingProvider` + `ZatcaProvider` + registry)

### 2.1 L'abstraction (calquée sur `TaxCalculatorRegistry` / `PaymentProviderRegistry`)

Le code a déjà `TaxCalculator` (calcul) et `CountryComplianceStrategy` (mentions/numérotation) mais **aucune abstraction d'émission/transmission** vers l'autorité. On la crée sur le pattern existant (registry Spring auto-peuplé par injection de `List<T>`).

```java
package com.clenzy.einvoicing;

public interface EInvoicingProvider {
    String getCountryCode();                         // "SA", "FR", "MA"
    EInvoicingMode getMode();                        // NONE | FACTURX_PDP | DGI_CLEARANCE | ZATCA
    EInvoiceArtifact render(Invoice invoice);        // UBL 2.1 (+ PDF/A-3 si standard)
    EInvoiceResult clear(Invoice invoice);           // B2B/B2G : clearance synchrone bloquante
    EInvoiceResult report(Invoice invoice);          // B2C : reporting (< 24h, async)
    boolean isClearanceRequired(Invoice invoice);    // route clearance vs reporting
}
```

```java
@Component
public class EInvoicingProviderRegistry {
    private final Map<String, EInvoicingProvider> byCountry;
    public EInvoicingProviderRegistry(List<EInvoicingProvider> all) {
        this.byCountry = all.stream()
            .collect(Collectors.toMap(EInvoicingProvider::getCountryCode, identity()));
    }
    public EInvoicingProvider get(String countryCode) { /* orElseThrow UnsupportedCountryException */ }
    public boolean isSupported(String countryCode) { ... }
}
```

> **Résolution par pays** : via `Country.einvoicing_provider` (table `country` à créer, cf. §3 et 41-strategie-multipays §3.1). Fail-fast au boot (pattern `EnvironmentValidator`) : si une `Property`/`Organization` active pointe vers un pays `enabled=ZATCA` sans provider résolu ni PCSID disponible → refus de démarrage.

### 2.2 Découpage interne de `ZatcaFatooraProvider`

`ZatcaFatooraProvider` est un **orchestrateur mince** qui délègue à des collaborateurs SRP (chaque classe = une raison de changer) :

| Classe | Responsabilité | Réutilise |
|---|---|---|
| `ZatcaFatooraProvider` | Implémente `EInvoicingProvider` ; orchestre render → sign → chain → transmit | — |
| `ZatcaUblMapper` | `Invoice` → DOM UBL 2.1 (subset ZATCA) | `FiscalEngine` (TVA), `Invoice` |
| `ZatcaInvoiceChainService` | Attribution **atomique** ICV + PIH (verrou pessimiste + contrainte unique) | **pattern `InvoiceNumberingService`** |
| `ZatcaXadesSigner` | Hash SHA-256 (C14N), signature ECDSA secp256k1, embed XAdES-BES, certHash | — |
| `ZatcaQrTlvEncoder` | Génère le TLV base64 (9 tags) | — |
| `ZatcaApiClient` | Appels HTTP compliance/production/clearance/reporting (hors transaction) | `RestClient`/`WebClient` |
| `ZatcaCertificateManager` | CSR, échange CCSID→PCSID, **lecture clés/certs depuis KMS** | KMS/secret store |
| `ZatcaPdfRenderer` | PDF/A-3 + XML embarqué + QR (RTL arabe) | **`InvoicePdfService` (iText)** |
| `ZatcaReportingRelay` | Job async B2C : reporting < 24h, retries bornés, **DLT Kafka** | **Outbox (`OutboxPublisher`/`OutboxRelay`)** |
| `ZatcaReconciliationService` | États d'échec explicites + notification admin | `NotificationService` |

> **Règle CLAUDE.md (controller mince + service)** : aucun appel ZATCA ni transaction depuis un controller. Le déclenchement vient du service de facturation (`InvoiceGeneratorService`) après émission, ou d'un consumer Kafka, via `EInvoicingProviderRegistry`.

### 2.3 Flux logique (vue d'ensemble)

```
Invoice émise (ISSUED) ──► EInvoicingProviderRegistry.get(country)
        │
        ├─ render()  : ZatcaUblMapper → UBL 2.1
        ├─ chain     : ZatcaInvoiceChainService.assign(egsUnit) → (ICV, PIH)  [TX courte, verrou]
        ├─ sign()    : ZatcaXadesSigner (clé/cert depuis KMS) → XML signé + invoiceHash
        ├─ qr        : ZatcaQrTlvEncoder → TLV base64
        │
        ├─ isClearanceRequired() ?
        │     OUI (B2B) ─► clear()  : POST /clearance/single  [HORS TX, idempotent]
        │                   └─ CLEARED → persist (nouvelle TX) | sinon CLEARANCE_FAILED + notif
        │     NON (B2C) ─► remise immédiate au guest (QR+stamp)
        │                   └─ OutboxEvent ZATCA_REPORTING → relay async → POST /reporting/single < 24h
        │                       └─ REPORTED → persist | retries bornés → DLT Kafka + RECON
        └─ render PDF/A-3 (standard) ou PDF + QR (simplified)
```

---

## 3. Modèle de données (entités + migrations Liquibase `NNNN__`)

> Convention CLAUDE.md : Liquibase uniquement (**jamais Flyway `V{n}__`**), changesets `server/src/main/resources/db/changelog/changes/NNNN__*.sql` + entrée dans `db.changelog-master.yaml` (`id: "NNNN-..."`, `author: clenzy-team`). **Dernier changeset existant = `0236`** → la suite ZATCA démarre à **`0237`**.

### 3.1 `country` (prérequis transverse — peut préexister via le socle multi-pays)

Si non créée par le socle multi-pays, la créer ici (cf. 41-strategie §3.1). Champs pertinents ZATCA : `einvoicing_provider VARCHAR(30)` (`NONE|FACTURX_PDP|DGI_CLEARANCE|ZATCA`), `vat_standard_rate NUMERIC(5,2)` (15.00 pour SA), `weekend_days`, `timezone` (`Asia/Riyadh`, pas de DST).

### 3.2 `zatca_egs_unit` — l'unité de génération (porte la chaîne PIH/ICV)

```sql
-- 0238__create_zatca_egs_unit.sql
CREATE TABLE zatca_egs_unit (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    egs_serial_number   VARCHAR(100) NOT NULL,   -- "1-Clenzy|2-<model>|3-<uuid>"
    common_name         VARCHAR(200) NOT NULL,
    vat_number          VARCHAR(15)  NOT NULL,
    environment         VARCHAR(20)  NOT NULL,   -- SANDBOX | SIMULATION | PRODUCTION
    onboarding_status   VARCHAR(30)  NOT NULL DEFAULT 'NOT_STARTED',
    -- références KMS (JAMAIS la clé/cert en clair en base) :
    private_key_kms_ref VARCHAR(255),            -- alias/handle KMS
    ccsid_kms_ref       VARCHAR(255),            -- Compliance CSID (binarySecurityToken+secret) chiffrés
    pcsid_kms_ref       VARCHAR(255),            -- Production CSID
    pcsid_expires_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_egs_org_serial UNIQUE (organization_id, egs_serial_number)
);
CREATE INDEX idx_egs_org ON zatca_egs_unit (organization_id);
```

> **Sécurité (CLAUDE.md #7 / soupape chiffrement backlog infra)** : clé privée, CCSID, PCSID, secret → **KMS / secret store**. La table ne stocke **que des références** (`*_kms_ref`). Le changeset `0233__encrypt_secret_columns.sql` existant montre que le projet a déjà une stratégie de chiffrement de colonnes secrètes — mais pour une clé privée de signature légale, **KMS externe** est préféré à un BYTEA chiffré.

### 3.3 `zatca_invoice_chain` — compteur ICV atomique par EGS (le cœur anti-fraude)

```sql
-- 0239__create_zatca_invoice_chain.sql
CREATE TABLE zatca_invoice_chain (
    id            BIGSERIAL PRIMARY KEY,
    egs_unit_id   BIGINT NOT NULL REFERENCES zatca_egs_unit(id),
    last_icv      BIGINT NOT NULL DEFAULT 0,   -- Invoice Counter Value courant
    last_pih      TEXT   NOT NULL,             -- PIH = SHA-256 base64 du XML signé précédent
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_chain_egs UNIQUE (egs_unit_id)   -- une seule chaîne par EGS
);
-- PIH initial (1ère facture) = SHA-256 base64 de la chaîne de référence ZATCA :
-- 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2YzNDkyMQ=='
```

### 3.4 `zatca_invoice_submission` — la facture ZATCA (1:1 ou 1:n avec `invoices`)

```sql
-- 0240__create_zatca_invoice_submission.sql
CREATE TABLE zatca_invoice_submission (
    id                BIGSERIAL PRIMARY KEY,
    organization_id   BIGINT NOT NULL,
    invoice_id        BIGINT NOT NULL REFERENCES invoices(id),
    egs_unit_id       BIGINT NOT NULL REFERENCES zatca_egs_unit(id),
    invoice_uuid      UUID   NOT NULL,          -- UUID v4, idempotency key ZATCA
    icv               BIGINT NOT NULL,          -- valeur attribuée atomiquement
    pih               TEXT   NOT NULL,          -- PIH consommé pour CETTE facture
    invoice_hash      TEXT   NOT NULL,          -- SHA-256 base64 du XML signé de CETTE facture
    invoice_subtype   VARCHAR(10) NOT NULL,     -- STANDARD | SIMPLIFIED
    transmission_mode VARCHAR(10) NOT NULL,     -- CLEARANCE | REPORTING
    signed_xml_kms_ref VARCHAR(255),            -- ou stockage objet (S3) — XML volumineux
    qr_tlv_base64     TEXT,
    clearance_status  VARCHAR(20),              -- NULL | CLEARED | NOT_CLEARED
    reporting_status  VARCHAR(20),              -- NULL | REPORTED | NOT_REPORTED
    zatca_warnings    JSONB,                    -- warnings ZATCA (non bloquants)
    zatca_errors      JSONB,                    -- erreurs (bloquantes)
    submission_state  VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- voir §10
    attempts          INT NOT NULL DEFAULT 0,
    submitted_at      TIMESTAMPTZ,              -- UTC (timestamp d'émission = §3.6)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_zatca_org_icv UNIQUE (organization_id, egs_unit_id, icv),  -- anti check-then-act
    CONSTRAINT uq_zatca_invoice_uuid UNIQUE (invoice_uuid)                    -- idempotency
);
CREATE INDEX idx_zatca_sub_state ON zatca_invoice_submission (submission_state);
CREATE INDEX idx_zatca_sub_invoice ON zatca_invoice_submission (invoice_id);
```

> **Contrainte clé** : `UNIQUE (organization_id, egs_unit_id, icv)` est le **garde-fou DB** contre les sauts/doublons d'ICV même en cas de race (cf. §6). `UNIQUE (invoice_uuid)` rend la soumission **idempotente** côté ZATCA.

### 3.5 Champs ZATCA sur `invoices` (réutilisation des colonnes existantes)

`Invoice` possède **déjà** `qr_code_data` (TEXT) et `xml_content` (TEXT). On les réutilise. Ajouts minimaux :

```sql
-- 0241__add_zatca_fields_to_invoices.sql
ALTER TABLE invoices ADD COLUMN einvoice_status VARCHAR(30); -- mirroir lisible côté UI
ALTER TABLE invoices ADD COLUMN einvoice_submission_id BIGINT REFERENCES zatca_invoice_submission(id);
```

> **`FiscalProfile`** : ajouter (si absent) `tax_id_number` 15 chiffres VAT KSA — le champ `vat_number VARCHAR(30)` existe déjà, valider le format 15 chiffres dans `SaudiComplianceStrategy`.

### 3.6 Horodatage UTC vs timezone propriété

- **Timestamp QR (tag 3) & soumission ZATCA** : **ISO 8601 UTC** (exigence ZATCA). Stocker en `TIMESTAMPTZ`.
- **Date de facture / nuits / périodes du séjour** : calculées en **`property.getTimezone()`** (KSA = `Asia/Riyadh`, pas de DST) — règle audit #9. Ne **jamais** dériver le timestamp ZATCA de la zone JVM.
- Pont : `Invoice.invoiceDate` (LocalDate, déjà en zone propriété) → `submitted_at` UTC à l'instant de la signature.

---

## 4. Mapping `Invoice` → UBL 2.1 (standard B2B clearance / simplifiée B2C reporting)

### 4.1 Champs UBL communs (subset ZATCA)

| Élément UBL | Source Clenzy | Note |
|---|---|---|
| `cbc:ProfileID` | `reporting:1.0` | constant |
| `cbc:ID` | `Invoice.invoiceNumber` | n° séquentiel (via `InvoiceNumberingService`) |
| `cbc:UUID` | `zatca_invoice_submission.invoice_uuid` | UUID v4 |
| `cbc:IssueDate` / `cbc:IssueTime` | dérivés du timestamp UTC | ISO 8601 |
| `cbc:InvoiceTypeCode` + `@name` | mappé depuis `InvoiceType` + B2B/B2C | code 388 (tax invoice) ; `@name` = bitmask 7 chiffres (standard `0100000` / simplified `0200000`) |
| `cbc:DocumentCurrencyCode` | `Invoice.currency` = `SAR` | |
| `cac:AdditionalDocumentReference` (ICV) | `submission.icv` | name=`ICV` |
| `cac:AdditionalDocumentReference` (PIH) | `submission.pih` | name=`PIH`, embedded base64 |
| `cac:AccountingSupplierParty` | `FiscalProfile` org | nom légal, **VAT 15 chiffres**, adresse, schemeID |
| `cac:AccountingCustomerParty` | acheteur (`Invoice.buyer*`) | **obligatoire B2B**, optionnel B2C |
| `cac:TaxTotal` | `FiscalEngine` (TVA 15 %) | montant TVA + sous-totaux par taux |
| `cac:LegalMonetaryTotal` | `Invoice.totalHt/totalTax/totalTtc` | `BigDecimal compareTo`, `RoundingMode.HALF_UP` |
| `cac:InvoiceLine` | `Invoice.getLines()` | qty, prix HT, `cac:TaxCategory` (S, 15.00) |
| `ext:UBLExtensions` | XAdES signature (§5) | injecté après hash |

### 4.2 Différences Standard (B2B) vs Simplified (B2C)

| Aspect | Standard (B2B → clearance) | Simplified (B2C → reporting) |
|---|---|---|
| `InvoiceTypeCode @name` | `0100000` | `0200000` |
| Acheteur | **obligatoire** (nom + VAT/ID) | facultatif |
| QR tags 6-9 (crypto) | présents | présents (Phase 2) |
| Transmission | `POST /clearance/single` **avant** remise | remise immédiate, `POST /reporting/single` < 24h |
| Stamp final | apposé **par ZATCA** (tag 9) | stamp **interne** EGS (validé au reporting) |
| PDF | PDF/A-3 + XML embarqué obligatoire | PDF/A-3 ou impression + QR |

### 4.3 Mapping `InvoiceType` Clenzy → régime ZATCA

```
GUEST (séjour particulier)        → SIMPLIFIED / REPORTING        (cas majoritaire PMS)
GUEST (acheteur = société VAT)    → STANDARD   / CLEARANCE
COMMISSION (facture mandat B2B)   → STANDARD   / CLEARANCE
CREDIT_NOTE                       → type 381, même régime que la facture corrigée
```

> Routage encapsulé dans `ZatcaFatooraProvider.isClearanceRequired(invoice)` : vrai si acheteur assujetti VAT (présence d'un `buyerTaxId` valide) **ou** `InvoiceType.COMMISSION`.

---

## 5. Signature XAdES & gestion des certificats (CSID, KMS)

### 5.1 Algorithmes (à respecter à la lettre)

- **Paire de clés** : ECDSA **courbe secp256k1**.
- **Hash** : SHA-256 sur le XML **canonicalisé (C14N)**.
- **Signature** : ECDSA(SHA-256) du `SignedInfo`.
- **Profil** : **XAdES-BES** (B2B/clearance) — la doc B2C référence parfois EPES ; suivre la **E-Invoicing Detailed Guideline v2** ZATCA + jeux de test sandbox comme source de vérité.
- **`invoiceHash`** envoyé à l'API = SHA-256 **base64** du XML signé ; alimente aussi le **PIH** de la facture suivante (§6) et le **tag 6** du QR.

### 5.2 Contenu de la signature embarquée (`ext:UBLExtensions`)

- `ds:SignedInfo` (Reference vers l'invoice + Reference vers `xades:SignedProperties`).
- `ds:SignatureValue` (ECDSA).
- `ds:KeyInfo/ds:X509Data/ds:X509Certificate` = certificat (PCSID en prod, CCSID en sandbox).
- `xades:SignedProperties` : `SigningTime` (**UTC**), `SigningCertificate/CertDigest` (SHA-256 du cert), `IssuerSerial`.

### 5.3 Gestion des certificats (KMS — jamais en BDD)

| Élément | Stockage | Accès |
|---|---|---|
| Clé privée ECDSA secp256k1 | **KMS / secret store** | `ZatcaCertificateManager` (handle `private_key_kms_ref`) |
| CCSID (binarySecurityToken + secret) | KMS | onboarding/tests |
| PCSID (binarySecurityToken + secret) | KMS | signature prod |

- **Génération CSR** : `ZatcaCertificateManager.generateCsr(egsUnit)` produit la CSR avec VAT, EGS serial, et l'**extension template ZATCA** ; la clé privée est créée et **scellée en KMS immédiatement** (ne transite jamais en clair par la BDD ni les logs — masquer via `PiiMasker`/pattern existant).
- **Rotation/expiration** : `pcsid_expires_at` surveillé ; job d'alerte avant expiration. Renouvellement = nouvelle CSR + nouveau PCSID, **sans casser la chaîne PIH/ICV** (la chaîne suit l'EGS unit, pas le cert).
- **Idéalement** : signature déléguée au KMS (la clé ne sort jamais) si le KMS supporte ECDSA secp256k1 ; sinon déchiffrement éphémère en mémoire (zeroize après usage).

---

## 6. Chaîne PIH/ICV atomique (anti check-then-act)

> **Règle absolue (CLAUDE.md audit #8 + §règle PIH/ICV)** : verrou pessimiste + contrainte unique `(org_id, egs_unit_id, icv)`. **Jamais de check-then-act.** Réutilise **exactement** le pattern `InvoiceNumberingService` (verrou `SELECT ... FOR UPDATE`, propagation `REQUIRED`, rollback = ICV restitué).

### 6.1 Le service (copie conforme du pattern numérotation)

```java
@Service
public class ZatcaInvoiceChainService {

    private final ZatcaInvoiceChainRepository chainRepo;  // findAndLock(egsUnitId) @Lock(PESSIMISTIC_WRITE)
    private final EntityManager em;

    /**
     * Attribue ATOMIQUEMENT le couple (ICV, PIH) à une facture.
     * MUST être appelé DANS la transaction qui persiste la zatca_invoice_submission
     * (propagation REQUIRED) : rollback applicatif ⇒ ICV non consommé, chaîne intacte.
     *
     * Sérialise les émissions d'un même EGS jusqu'au commit (conséquence assumée,
     * identique à la numérotation de facture). La chaîne PIH impose de toute façon
     * un ordre total : pas de parallélisme possible sur un même EGS.
     */
    @Transactional
    public ChainSlot assignNext(Long egsUnitId) {
        ZatcaInvoiceChain chain = chainRepo.findAndLock(egsUnitId)
            .orElseGet(() -> initAndLock(egsUnitId));   // INSERT ON CONFLICT DO NOTHING puis lock
        long icv = chain.getLastIcv() + 1;
        String pih = chain.getLastPih();                // PIH = hash de la facture précédente
        return new ChainSlot(icv, pih);                 // last_pih MAJ après signature (cf. 6.2)
    }

    @Transactional
    public void commitHash(Long egsUnitId, long icv, String signedInvoiceHash) {
        ZatcaInvoiceChain chain = chainRepo.findAndLock(egsUnitId).orElseThrow();
        // garde-fou : on n'avance la chaîne que pour l'ICV qu'on vient d'émettre
        if (chain.getLastIcv() + 1 != icv) {
            throw new ZatcaChainIntegrityException(egsUnitId, chain.getLastIcv(), icv);
        }
        chain.setLastIcv(icv);
        chain.setLastPih(signedInvoiceHash);            // devient le PIH de la suivante
        chainRepo.save(chain);
    }
}
```

### 6.2 Ordonnancement (subtilité critique)

Le **PIH d'une facture = hash de la facture *signée* précédente**. La séquence transactionnelle est donc :

1. **TX courte** : `assignNext(egs)` → verrou + `(icv, pih=lastPih)` ; insérer `zatca_invoice_submission` à l'état `SIGNING` (contrainte unique `(org, egs, icv)` valide ici la non-collision). Commit.
2. **Hors TX** : `render` (UBL avec icv+pih) → `sign` (XAdES) → `invoiceHash`.
3. **TX courte** : `commitHash(egs, icv, invoiceHash)` (re-verrou, avance `last_pih`) + persister `invoice_hash`/`signed_xml_kms_ref`. Commit.
4. **Hors TX** : transmission ZATCA (§9).

> **Pourquoi pas tout en une TX ?** La signature peut être déléguée KMS (I/O) et la transmission est un appel HTTP externe — **interdits en TX DB** (audit #2). Le découpage garde le verrou DB court, mais la **sérialisation par EGS** reste totale (la chaîne PIH l'impose intrinsèquement).
> **Échec entre 1 et 3** : la submission reste `SIGNING` ; un reaper la rejoue (UUID idempotent) ou la marque `RECON` si la signature est définitivement impossible. **Jamais** de saut d'ICV silencieux.

---

## 7. QR code TLV

### 7.1 Les 9 tags (Phase 2)

| Tag | Champ | Source | Phase |
|---|---|---|---|
| 1 | Seller name | `FiscalProfile.legalEntityName` | 1+ |
| 2 | VAT registration number (15 ch.) | `FiscalProfile.vatNumber` | 1+ |
| 3 | Invoice timestamp (ISO 8601 **UTC**) | `submission.submitted_at` | 1+ |
| 4 | Invoice total (TTC) | `Invoice.totalTtc` | 1+ |
| 5 | VAT total | `Invoice.totalTax` | 1+ |
| 6 | Hash du XML facture (SHA-256 base64) | `submission.invoice_hash` | **2** |
| 7 | ECDSA signature (cryptographic stamp) | `ZatcaXadesSigner` | **2** |
| 8 | Clé publique du stamp | cert PCSID | **2** |
| 9 | Signature ZATCA de la clé publique | retour clearance (B2B) | **2** |

### 7.2 Encodage

```
Pour chaque tag : bytes = [tagByte][lengthByte][valueBytes(UTF-8)]
Concaténer tag1..tagN, puis Base64(concat) → texte du QR.
```

- **B2C (simplified)** : tags 1-8 (le tag 9 — signature ZATCA — n'existe qu'après clearance, donc absent en reporting ; le stamp interne suffit pour la vérif consommateur).
- **B2B (standard)** : tags 1-9 après retour clearance.
- `ZatcaQrTlvEncoder.encode(...)` retourne le base64 → stocké dans `Invoice.qrCodeData` (colonne existante) et rendu dans le PDF (§ iText).
- QR rendu : version 5/6, niveau de correction M.

---

## 8. Onboarding (compliance CSID → production CSID)

> 3 environnements ZATCA **distincts** (ne pas mélanger, un CSID est lié à son env) :
> **Sandbox** (logique/structure, CSID factice), **Simulation/UAT** (`fatoora.zatca.gov.sa` → bouton « Fatoora Simulation Portal »), **Production**.
> Base API : **`https://gw-fatoora.zatca.gov.sa`** (l'ancien `gw-apic-gov.gazt.gov.sa` est décommissionné depuis 14/09/2025).

### 8.1 Étapes (par EGS unit)

1. **CSR** : `ZatcaCertificateManager.generateCsr(egs)` — clé ECDSA secp256k1 + CSR (VAT, EGS serial, template ZATCA). Clé privée → KMS.
2. **OTP** : générer un OTP **par device/solution** dans le portail Fatoora (header `OTP` requis pour la requête compliance).
3. **Compliance CSID** : `POST /e-invoicing/developer-portal/compliance` body `{ "csr": "<base64CSR>" }`, headers `Accept-Version: V2`, `OTP: <otp>` → reçoit le **CCSID** (`binarySecurityToken` + `secret`) → KMS.
4. **Tests de conformité** : `POST /compliance/invoices` avec les jeux d'invoices imposés (Standard + Simplified + Credit/Debit notes) signés avec le CCSID. **Tous doivent passer.**
5. **Production CSID** : `POST /e-invoicing/developer-portal/production/csids` body `{ "compliance_request_id": "<id>" }`, auth Basic `base64(CCSID.token : CCSID.secret)` → reçoit le **PCSID** → KMS.
6. **Renouvellement / révocation** : `PATCH`/relance sur `/production/csids` (suivre la doc) ; surveiller `pcsid_expires_at`.

### 8.2 États d'onboarding (`zatca_egs_unit.onboarding_status`)

```
NOT_STARTED → CSR_GENERATED → CCSID_OBTAINED → COMPLIANCE_PASSED → PCSID_OBTAINED → ACTIVE
                                                          │
                                                          └─ COMPLIANCE_FAILED (bloquant, notif admin)
```

---

## 9. Flux clearance (B2B) & reporting (B2C) — hors transaction, idempotent, DLT

> **Règles CLAUDE.md** : appel HTTP externe **hors transaction DB** (audit #2), **idempotent** (UUID facture, audit), **retries + DLT Kafka** (réutiliser l'Outbox `OutboxEvent`/`OutboxPublisher`/`OutboxRelay` existant), **jamais de `catch(Exception)` avaleur** (audit #7).

### 9.1 Clearance B2B (synchrone, bloquante)

```java
// hors TX — orchestré par ZatcaFatooraProvider.clear(invoice)
EInvoiceResult clear(Invoice invoice) {
    var sub = loadSubmission(invoice);                 // SIGNING/SIGNED, déjà en base
    var resp = zatcaApiClient.clearance(sub);          // POST /invoices/clearance/single
    //   headers: Accept-Version V2, Authorization Basic(PCSID), Accept-Language en
    //   body: { invoiceHash, uuid, invoice: <base64 signedXml> }
    return switch (resp.clearanceStatus()) {
        case "CLEARED" -> persistCleared(sub, resp);   // nouvelle TX : stamp tag9, qr maj, state=CLEARED
        default        -> markReconciliation(sub, resp); // state=CLEARANCE_FAILED + notifyAdmin (PAS de retry auto)
    };
}
```

- **CLEARED** : la facture *cleared* (avec stamp ZATCA tag 9) est la seule valide → transmissible au client. Persistée en **nouvelle TX** après l'appel.
- **NOT_CLEARED / erreurs** : état `CLEARANCE_FAILED` + **notification admin** (`ZatcaReconciliationService`). **Pas de retry silencieux** — un retry naïf re-consommerait la chaîne et casserait PIH. La reprise est une **décision opérée** (corriger la donnée → ré-émettre = nouvel ICV).
- **Warnings** (non bloquants) : stockés (`zatca_warnings`), facture acceptée mais signalée.

### 9.2 Reporting B2C (asynchrone, < 24h)

```
Émission B2C ─► remise immédiate au guest (PDF + QR + stamp interne)
            └─► OutboxEvent(type=ZATCA_REPORTING, aggregateId=submissionId)   [même TX que l'émission]
                    │  (Outbox existant → Kafka)
                    ▼
            ZatcaReportingRelay (consumer)
                    ├─ POST /invoices/reporting/single  (idempotent via uuid)
                    ├─ REPORTED  → state=REPORTED (nouvelle TX)
                    └─ échec     → retries bornés (backoff) → épuisés → DLT Kafka + state=RECON + notifyAdmin
```

- Le **timer 24h** est large : retries bornés avec backoff (ex. 1m, 5m, 30m, 2h…) ; alerte si non `REPORTED` à T+20h.
- **Idempotence** : `invoice_uuid` unique → un re-`POST` du même UUID est neutre côté ZATCA.
- **DLT** : après épuisement, l'événement part en Dead Letter Topic + statut `RECON` + notif admin (jamais perdu silencieusement).

### 9.3 `ZatcaApiClient` (contrat HTTP)

| Opération | Méthode/Path (base `gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal`) | Auth | Headers |
|---|---|---|---|
| Compliance CSID | `POST /compliance` | — | `Accept-Version: V2`, `OTP` |
| Compliance invoice | `POST /compliance/invoices` | Basic(CCSID) | `Accept-Version: V2` |
| Production CSID | `POST /production/csids` | Basic(CCSID) | `Accept-Version: V2` |
| **Clearance B2B** | `POST /invoices/clearance/single` | Basic(PCSID) | `Accept-Version: V2`, `Accept-Language: en`, `Clearance-Status: 1` |
| **Reporting B2C** | `POST /invoices/reporting/single` | Basic(PCSID) | `Accept-Version: V2`, `Accept-Language: en` |

> Timeouts agressifs + circuit breaker (Resilience4j) ; toute exception réseau → état explicite, jamais avalée.

---

## 10. Gestion d'erreurs & réconciliation

### 10.1 Machine à états `zatca_invoice_submission.submission_state`

```
PENDING ─► SIGNING ─► SIGNED ─► TRANSMITTING ─► CLEARED        (B2B succès)
                                            └─► REPORTED       (B2C succès)
   │                                        └─► RECON          (échec après retries / non-cleared)
   └─► FAILED_PERMANENT (signature/cert impossible → notif admin)
```

### 10.2 Principes (CLAUDE.md)

- **Jamais `catch(Exception)` avaleur** : tout échec → statut de réconciliation explicite (`RECON`/`CLEARANCE_FAILED`) **+ notification admin** (`NotificationService`, pattern `notifyLedgerReconciliationRequired`-like).
- **Pas de retry qui casse la chaîne** : un retry technique idempotent (même UUID, même XML signé) est OK ; **re-générer** une facture (nouvel ICV/PIH) est une décision métier, pas un retry auto.
- **Réconciliation** : écran admin listant les `RECON`/`CLEARANCE_FAILED` avec le détail `zatca_errors` (JSONB) ; action « ré-émettre » = nouvelle submission (nouvel ICV), l'ancienne marquée annulée (credit note si déjà cleared).
- **Cohérence chaîne** : un job de vérification périodique recalcule `SHA-256(signedXml(icv-1)) == pih(icv)` pour détecter toute rupture (alerte fraude).
- **Masquage** : tokens CSID, clés, OTP → `PiiMasker`/`FeedUrlMasker` dans tous les logs (audit T-BP-01/02).

---

## 11. Plan de POC sandbox (étapes, jalons, definition of done)

> But du POC : **dérisquer** la crypto + l'onboarding + les deux régimes **avant tout engagement client KSA**. Tout en **environnement Sandbox** (CSID factice) puis **Simulation/UAT**.

| Jalon | Contenu | Definition of Done |
|---|---|---|
| **J0 — Cadrage & lecture spec** | Récupérer la **E-Invoicing Detailed Guideline v2** + jeux de test officiels ; valider courbe/profil exacts | Doc ZATCA archivée ; checklist champs UBL obligatoires figée ; décision XAdES-BES/EPES tranchée par les jeux de test |
| **J1 — Crypto isolée** | `ZatcaXadesSigner` + `ZatcaQrTlvEncoder` en lib pure (sans DB ni HTTP) | Un XML d'exemple ZATCA est signé, hashé (SHA-256/C14N), QR TLV généré ; **passe le validateur XML/QR ZATCA** (SDK ou décodeur en ligne) |
| **J2 — Chaîne atomique** | `zatca_invoice_chain` + `ZatcaInvoiceChainService` (Liquibase 0239) | Test de concurrence (50 threads, 1 EGS) → ICV strictement séquentiel, **0 doublon** (contrainte unique tient), PIH(n) == hash(signedXml(n-1)) |
| **J3 — Onboarding Sandbox** | CSR + OTP + CCSID + tests de conformité (Standard+Simplified+notes) | **Tous les jeux de conformité ZATCA passent** ; CCSID en KMS ; `onboarding_status=COMPLIANCE_PASSED` |
| **J4 — Mapping UBL réel** | `ZatcaUblMapper` depuis une vraie `Invoice` Clenzy (séjour B2C + commission B2B) | UBL généré depuis une facture Clenzy réelle validé sans erreur par l'API compliance |
| **J5 — Clearance B2B** | `clear()` hors TX, idempotent, états | Une facture standard Clenzy → `CLEARED` en Sandbox ; stamp tag 9 récupéré ; rejouer même UUID = no-op |
| **J6 — Reporting B2C** | `report()` via Outbox + relay + DLT | Une facture simplifiée → `REPORTED` < 24h ; échec simulé → DLT + `RECON` + notif admin |
| **J7 — PDF/A-3 RTL** | `ZatcaPdfRenderer` (iText) : PDF/A-3 + XML embarqué + QR + arabe RTL | PDF/A-3 valide (vérif PDF/A) avec XML signé embarqué et QR scannable |
| **J8 — Simulation/UAT** | Bascule Sandbox → Simulation (nouveau CSID) + Production CSID simulé | Cycle complet onboarding→clearance→reporting en Simulation ; **runbook d'onboarding client** rédigé |

**DoD global du POC** : depuis une `Invoice` Clenzy réelle, produire (a) une **standard cleared** et (b) une **simplified reported** en environnement **Simulation**, avec chaîne PIH/ICV vérifiée, certificats en KMS, échecs gérés en réconciliation — **sans aucune intervention manuelle hors onboarding**.

---

## 12. Stratégie de test

- **Unitaires (cœur métier — obligatoire)** :
  - `ZatcaXadesSigner` : vecteurs de test connus (XML→hash SHA-256 base64 attendu, signature vérifiable avec la clé publique).
  - `ZatcaQrTlvEncoder` : un input fixe → TLV base64 attendu (round-trip décodage).
  - `ZatcaUblMapper` : `Invoice` fixture → XML attendu (comparaison champ à champ, pas string brute).
  - `BigDecimal` : `compareTo` jamais `equals`, arrondis `RoundingMode.HALF_UP` (audit #10).
- **Concurrence (Testcontainers Postgres)** : `ZatcaInvoiceChainService` — N threads, 1 EGS → ICV séquentiel sans trou ni doublon ; la contrainte `(org, egs, icv)` rejette toute collision (reproduit le bug check-then-act AVANT de prouver le fix).
- **Intégration API** : `ZatcaApiClient` contre un **WireMock** stubbant clearance/reporting (CLEARED, NOT_CLEARED, warnings, 5xx) + tests réels contre le **Sandbox ZATCA**.
- **Idempotence** : double `POST` même UUID → un seul effet ; rejeu Outbox → pas de double soumission.
- **Échec & réconciliation** : clearance NOT_CLEARED → état `CLEARANCE_FAILED` + notif (vérifier qu'**aucune** exception n'est avalée) ; reporting épuisé → DLT.
- **Timezone** : timestamp QR/soumission en UTC, dates séjour en `Asia/Riyadh` (test de non-régression du décalage de jour, audit #9).
- **Conformité ZATCA** : la **batterie officielle de jeux de test** (Standard, Simplified, Credit, Debit) en CI avant tout déploiement.
- **Architecture (ArchUnit, règles gelées existantes)** : aucun repository dans un controller ; aucun appel HTTP ZATCA dans une `@Transactional`.

---

## 13. Risques & mitigations

| # | Risque | Impact | Mitigation |
|---|---|---|---|
| 1 | **Crypto non conforme** (mauvais profil XAdES, C14N, courbe, ordre de canonicalisation) → factures rejetées en masse | Bloquant (facture non cleared = invalide) | Jalon J1 isolé validé par le **validateur officiel ZATCA** avant toute intégration ; suivre la Guideline v2 à la lettre ; vecteurs de test connus |
| 2 | **Rupture / saut de la chaîne PIH/ICV** (concurrence, retry naïf) → alerte fraude ZATCA | Bloquant + risque légal | Verrou pessimiste + contrainte unique `(org,egs,icv)` (pattern `InvoiceNumberingService`) ; **interdiction de retry qui ré-émet** ; job de vérification de cohérence de chaîne |
| 3 | **Fuite de clé privée / CSID** (stockage BDD, logs) | Critique (sécurité) | Clés/CSID en **KMS** uniquement (références en base) ; signature déléguée KMS si possible ; masquage logs (`PiiMasker`) ; jamais en BDD (CLAUDE.md #7) |
| 4 | **Spec ZATCA mouvante** (endpoints, profils, vagues, décommissionnement d'URL — ex. gw-apic décommissionné 09/2025) | Moyen (retard) | Tout passe par `ZatcaApiClient` + config externalisée (URLs/env) ; veille Fatoora Developer Community ; abstraction `EInvoicingProvider` isole le reste du code |
| 5 | **Clearance bloquante en chemin critique** (latence/indispo ZATCA bloque l'émission B2B) | Élevé (UX + business) | Timeout/circuit breaker ; file d'attente `TRANSMITTING` + reprise ; SLA documenté ; pour le B2C (majoritaire PMS) le reporting **différé** ne bloque pas la remise au guest |
| 6 | RTL arabe PDF (iText reshaping/ligatures) | Moyen | Jalon J7 dédié ; polices arabes + reshaping ; réutiliser le socle RTL transverse (41-strategie §2) |
| 7 | Résidence des données (PDPL KSA) | Moyen | Hébergement/region à instruire (cf. 42-objectifs risque #4) avant prod |

---

## 14. Sources (URL | date | confiance)

| Sujet | URL | Date consultée | Confiance |
|---|---|---|---|
| Vue d'ensemble Phase 2, vagues 2026, formats | https://mercans.com/glossary/zatca-e-invoicing-fatoora/ | 2026-06-14 | Élevée |
| UBL/XAdES/hash chains (implémentation détaillée, TLV, ICV/PIH, étapes onboarding) | https://dev.to/webkoding/implementing-zatca-phase-2-e-invoicing-in-woocommerce-ubl-xml-xades-signing-and-hash-chains-1682 | 2026-06-14 | Moyenne-élevée (blog technique, recoupé) |
| Guide Phase 2 2026, clearance vs reporting, formats | https://qeemahcloud.com/en/blog/complete-zatca-phase-2-einvoicing-requirements-guide/ | 2026-06-14 | Élevée |
| News/deadlines 2026 Wave 23/24 | https://out2sol.global/blog/zatca-e-invoicing-phase-2-integration-explained | 2026-06-14 | Élevée |
| QR TLV — **9 tags officiels** (tags 6-9 crypto Phase 2) | recoupé multi-sources (recherche web) + PDF officiel ZATCA `QRCodeCreation.pdf` | 2026-06-14 | Élevée |
| PDF officiel ZATCA — QR code | https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/QRCodeCreation.pdf | 2026-06-14 | Élevée (source primaire) |
| Onboarding EGS — CSR/OTP/CCSID/PCSID, **secp256k1** | https://medium.com/@complyance/egs-onboarding-zatca-phase-2-e-invoicing-6e44ea4b2d2c | 2026-06-14 | Élevée |
| **Endpoints API exacts** (compliance/production/clearance/reporting), headers `Accept-Version V2`, body `{invoiceHash,uuid,invoice}`, secp256k1, C14N, XAdES-BES | https://www.jibrid.com/blog/zatca-phase2-api-integration-guide | 2026-06-14 | Élevée |
| Digital signature & CSID (XAdES, SHA-256, ICV/PIH) | https://qeemahcloud.com/en/blog/zatca-digital-signature-csid-certificate-guide/ | 2026-06-14 | Moyenne |
| 3 environnements (Sandbox/Simulation/Production), décommissionnement gw-apic 14/09/2025, base `gw-fatoora.zatca.gov.sa` | recherche web recoupée (Qoyod, Fatoora Developer Community, Qeemah) | 2026-06-14 | Élevée |
| Fatoora Developer Community (réf. continue, spec mouvante) | https://zatca1.discourse.group/ | 2026-06-14 | Élevée (communauté officielle) |
| Calcul PIH (clarification base64 SHA-256 32 bytes) | https://zatca1.discourse.group/t/clarification-on-previous-invoice-hash-pih-calculation/4872 | 2026-06-14 | Moyenne-élevée |
| Contexte Clenzy (architecture, déverrouillage, risque #1) | ../41-strategie-multipays.md §4.3 ; ../42-objectifs-techniques.md | 2026-06-14 | N/A (interne) |

> **Avertissement de confiance** : les **endpoints, ordre exact de canonicalisation, profil XAdES précis (BES vs EPES par sous-type), et `InvoiceTypeCode` bitmask** doivent être **confirmés sur la doc primaire ZATCA « E-Invoicing Detailed Guideline v2 » + les jeux de test sandbox** avant figement (jalon J0). Les blogs techniques convergent mais ne remplacent pas la source normative.

---

### Annexe — Réutilisations de code Clenzy (ne pas réinventer)

| Besoin ZATCA | Composant Clenzy existant | Fichier |
|---|---|---|
| Chaîne ICV/PIH atomique | **Pattern** verrou pessimiste + `INSERT ON CONFLICT` + propagation REQUIRED | `service/InvoiceNumberingService.java`, `repository/InvoiceNumberSequenceRepository.java` (`findAndLock` `@Lock(PESSIMISTIC_WRITE)`) |
| Registry par pays | Pattern `List<T>` → `Map<key,T>` | `fiscal/TaxCalculatorRegistry.java`, `payment/PaymentProviderRegistry.java` |
| Calcul TVA 15 % / municipality fee | déjà implémenté | `fiscal/country/SaudiTaxCalculator.java`, façade `fiscal/FiscalEngine.java` |
| Mentions/numérotation KSA | à compléter (TODO Phase 2 déjà balisés) | `compliance/country/SaudiComplianceStrategy.java` |
| Colonnes facture (QR, XML) | **existent déjà** | `model/Invoice.java` (`qr_code_data`, `xml_content`) |
| Reporting async + DLT | Outbox pattern | `model/OutboxEvent.java`, `service/OutboxPublisher.java`, `service/OutboxRelay.java` |
| PDF (iText) | générateur PDF existant | `service/InvoicePdfService.java` |
| Profil fiscal org (VAT 15 ch.) | existant | `model/FiscalProfile.java` (`vatNumber`) |
| Stockage secrets chiffrés | précédent dans le projet | changeset `0233__encrypt_secret_columns.sql` (mais **clé de signature → KMS externe préféré**) |
