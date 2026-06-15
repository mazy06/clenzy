# Backlog d'amorçage — Périmètre P0 (23 tickets)

> Source : `data/40-feature-evolution.csv` filtré sur `Priorite=P0`. Plan : [42-objectifs-techniques.md](../42-objectifs-techniques.md), architecture : [41-strategie-multipays.md](../41-strategie-multipays.md).
> Cible : parité Hostaway/Guesty + différenciation conformité multi-pays (FR / MA / KSA).
> Toutes les notes techniques reflètent les règles CLAUDE.md (Liquibase, anti-IDOR `requireSameOrganization`, controller mince + DTO records, recalcul serveur des montants + `StripeAmounts.toMinorUnits` + `PaymentStatusTransitionService`, appels HTTP hors transaction + `afterCommit` + idempotency, `@PreAuthorize`, concurrence sans check-then-act, dates en timezone propriété).
> Numéros de changesets Liquibase suggérés : suite à partir de **0237** (dernier existant = `0236__add_accent_to_user_preferences.sql`). Entrée obligatoire dans `server/src/main/resources/db/changelog/db.changelog-master.yaml`.

## Sommaire (ordonné par dépendance)

| ID | Titre | Phase | Effort | Dépend de |
|----|-------|-------|:------:|-----------|
| CLZ-P0-01 | Entité `Country` + branchement des registries | Phase 0 · Socle | M | — (racine) |
| CLZ-P0-02 | Isolation multi-tenant calendrier (`requireSameOrganization` + ArchUnit) | Phase 0 · Calendrier | S | — (racine) |
| CLZ-P0-03 | Activation du flag multi-country + rollout par pays | Phase 0 · Socle | S | 01 |
| CLZ-P0-04 | Abstraction `EInvoicingProvider` + registry | Phase 1 · Finance | L | 01 |
| CLZ-P0-05 | Contrat `ChannelConnector` unique (natif vs Channex) | Phase 1/4 · Channel | XL | 01 |
| CLZ-P0-06 | Sync temps réel dispo/prix bidirectionnelle (Outbox/Kafka) | Phase 1 · Channel | M | 05 |
| CLZ-P0-07 | Sync des restrictions de séjour (`pushRestrictions` par adapter) | Phase 1 · Channel | L | 05, 06 |
| CLZ-P0-08 | OTAs MENA — Gathern (KSA) et marketplaces locaux | Phase 3 · Channel | XL | 01, 05, 06 |
| CLZ-P0-09 | 2FA / TOTP (Keycloak + policy org) | Phase 0 · Sécurité | M | 02 |
| CLZ-P0-10 | Édition groupée massive multi-propriété (bulk calendrier) | Phase 1 · Calendrier | L | 02, 06 |
| CLZ-P0-11 | Emails de confirmation et rappels de réservation (site direct) | Phase 0 · Booking | M | 01 |
| CLZ-P0-12 | i18n + RTL embarqués dans le `booking-sdk` | Phase 1 · Booking | M | — |
| CLZ-P0-13 | Comparaison période N vs N-1 (delta backend canonique) | Phase 1 · Reporting | S | — |
| CLZ-P0-14 | Agrégation multi-devise et consolidation portefeuille | Phase 1 · Reporting | M | 01, 13 |
| CLZ-P0-15 | Report builder léger (vues sauvegardables) | Phase 1 · Reporting | L | 01, 14 |
| CLZ-P0-16 | Moteur IA de tarification livré en prod (shadow→reco→auto) | Phase 1 · Pricing | L | 01, 17 |
| CLZ-P0-17 | Architecture de recommandation de prix (CAS-safe) | Phase 1 · Pricing | M | 01 |
| CLZ-P0-18 | Injection des taxes par pays dans la simulation de prix | Phase 1 · Pricing | M | 01 |
| CLZ-P0-19 | `FrancePdpProvider` — Factur-X / PDP 2026-2027 | Phase 1 · Finance | XL | 04 |
| CLZ-P0-20 | `ZatcaProvider` — UBL 2.1 + signature XAdES | Phase 3 · Finance | XL | 04, 21, 22 |
| CLZ-P0-21 | ZATCA — chaîne PIH atomique (anti check-then-act) | Phase 3 · Finance | L | 01 |
| CLZ-P0-22 | ZATCA — QR TLV + onboarding CSID (KMS) | Phase 3 · Finance | L | 01 |
| CLZ-P0-23 | ZATCA — clearance B2B / reporting B2C (hors transaction) | Phase 3 · Finance | L | 04, 20, 21, 22 |

---

### [CLZ-P0-01] Entité `Country` + branchement des registries
- **Phase / Domaine** : Phase 0 · 0. Socle multi-pays
- **Cible** : Différenciation — **Multi-pays** : FR/MA/KSA (prérequis transverse à tout le reste)
- **Contexte** : Le pays est aujourd'hui éclaté et non synchronisé : `model/Property.java` (`country` libellé libre + `countryCode` alpha-2) et `model/FiscalProfile.java` (`countryCode`), sans table de config centralisant les capacités. Les registries existants (`fiscal/TaxCalculatorRegistry`, `compliance/ComplianceStrategyRegistry`, `payment/PaymentProviderRegistry`) résolvent leur bean sans source de vérité pays. Cf. 41-strategie-multipays §3.1 (schéma `country`) et 42 §1.
- **Critères d'acceptation** :
  - Given une propriété FR, When les services résolvent taxe/compliance/paiement, Then ils passent par `country.tax_calculator` / `country.compliance_strategy` / `country.einvoicing_provider` (plus de hardcode FR).
  - La table `country` contient au minimum : `code` (PK, ISO 3166-1 alpha-2), `name_i18n` (JSONB fr/en/ar), `default_currency`, `default_locale`, `timezone`, `weekend_days`, `tax_calculator`, `compliance_strategy`, `einvoicing_provider`, `guest_registration_provider`, `signature_regime`, `vat_standard_rate`, `enabled`.
  - `org.country` (facturation, via `FiscalProfile`) est distinct de `property.countryCode` (opérations) ; une org FR peut gérer un bien MA.
  - Un pays référencé mais sans bean résolu → `UnsupportedCountryException` explicite, jamais de défaut silencieux.
  - FR fonctionne via la résolution dynamique, zéro régression (tests fiscaux FR verts avant/après).
- **Notes techniques** : créer `model/Country.java` + repository + service de résolution. **Migration Liquibase** `0237__create_country_config.sql` (seed FR/MA/SA, `enabled=true` FR seul) + entrée dans `db.changelog-master.yaml`. Brancher les 3 registries existants sur `country.*`. **Régulariser la dette migrations Flyway** `V79–V101` (héritées fiscales) en changesets Liquibase avant activation prod (cf. 41 ligne 26). `findById(Country)` dans un flux user → pas applicable (table de config globale), mais tout chargement `Property`/`FiscalProfile` dans le branchement reste sous `requireSameOrganization`.
- **Estimation** : M (~5 j-h)
- **Dépendances** : aucune (ticket racine)

---

### [CLZ-P0-02] Isolation multi-tenant des données calendrier (`requireSameOrganization` + ArchUnit)
- **Phase / Domaine** : Phase 0 · 3. Calendrier & multi-tenant
- **Cible** : Parité Hostaway/Guesty — **Multi-pays** : FR/MA/KSA (segmentation par org ; messages d'erreur d'accès traduits fr/en/ar)
- **Contexte** : Base solide (`@Filter` Hibernate par `organization_id`, `tenant/TenantFilter` post-JWT fail-closed 403, platform staff cross-org). `service/CalendarEngine.java` prend `orgId` en paramètre, mais l'ownership reste à durcir sur tous les `findById` des flux owner/calendrier (un `findById` contourne le filtre Hibernate — risque IDOR identifié à l'audit 2026-06 #3). Cf. 42 §3.
- **Critères d'acceptation** :
  - Given un user de l'org A, When il appelle un endpoint calendrier/owner avec un `propertyId`/`reservationId` de l'org B, Then `AccessDeniedException` (bypass autorisé pour platform staff, tracé).
  - Chaque `findById` des flux calendrier/owner est immédiatement suivi de `requireSameOrganization(entity)` (pattern `SmartLockService`).
  - Un test ArchUnit gèle l'absence de repository injecté dans les controllers.
  - Des tests d'IDOR couvrent au moins 1 endpoint calendrier et 1 endpoint owner (accès cross-org → 403/AccessDenied).
- **Notes techniques** : appliquer `requireSameOrganization` (incluant bypass platform staff) après chaque `findById` des packages calendrier/owner ; tests dans `server/src/test/java/com/clenzy/architecture/` (règle ArchUnit gelée) ; couverture IDOR. Aucune migration. `@PreAuthorize("isAuthenticated()")` minimum déjà attendu sur les controllers concernés — vérifier.
- **Estimation** : S (~3 j-h)
- **Dépendances** : aucune (ticket racine)

---

### [CLZ-P0-03] Activation du flag multi-country + rollout par pays
- **Phase / Domaine** : Phase 0 · 0. Socle multi-pays
- **Cible** : Parité — **Multi-pays** : FR/MA/KSA (ouverture graduelle FR → MA → KSA sans régression FR)
- **Contexte** : `fiscal.multi-country.enabled=false` (`application.yml:241-242`), logique FR hardcodée, fondations désactivées. Cf. 41 §3.4 et 42 §3 (Phase 0).
- **Critères d'acceptation** :
  - Master switch `fiscal.multi-country.enabled=true` active la résolution par pays (au lieu du hardcode FR).
  - `country.enabled` ouvre un pays à la fois (FR `true`, MA/KSA `false` au lancement).
  - **Fail-fast au boot** (pattern `config/EnvironmentValidator.java`) : si une propriété active référence un pays `enabled` dont le provider e-invoicing/registration n'est pas résolu, le démarrage est refusé.
  - Démarrage prod OK avec FR seul activé, zéro régression.
- **Notes techniques** : étendre `config/EnvironmentValidator.java` (validation au boot, fail-fast — évite la dérive prod-only type changeset 0164). Pas de migration (config + seed déjà dans CLZ-P0-01). Liste positive de pays, jamais de matching négatif (audit #11).
- **Estimation** : S (~2 j-h)
- **Dépendances** : CLZ-P0-01

---

### [CLZ-P0-04] Abstraction `EInvoicingProvider` + registry
- **Phase / Domaine** : Phase 1 · 8. Finance & Comptabilité
- **Cible** : Différenciation — **Multi-pays** : FR/MA/KSA (socle commun e-invoicing)
- **Contexte** : Aucune abstraction d'émission/transmission de facture électronique. `model/Invoice.java` porte `xml_content`/`qr_code_data` en colonnes inertes ; `fiscal/FiscalEngine.java` calcule la TVA mais ne produit aucun format légal structuré ni transmission. `compliance/CountryComplianceStrategy.java` couvre les mentions, pas l'émission. Cf. 41 §4.0 et 42 §8.
- **Critères d'acceptation** :
  - Interface `EInvoicingProvider { getCountryCode(); getMode(); EInvoiceResult clear(Invoice); EInvoiceResult report(Invoice); byte[] renderCompliantArtifact(Invoice); }` avec `EInvoicingMode { NONE, FACTURX_PDP, DGI_CLEARANCE, ZATCA_CLEARANCE, ZATCA_REPORTING }`.
  - `EInvoicingProviderRegistry` résout par `country.einvoicing_provider` (pattern `TaxCalculatorRegistry`) ; pays non couvert → exception explicite.
  - Une implémentation `NoOpEInvoicingProvider` (mode NONE) pour les pays sans contrainte, sans casser le flux de facturation existant.
  - Persistance d'un suivi de soumission (`einvoice_submission` : invoiceNumber, orgId, mode, statut, externalRef, taux/horodatage).
- **Notes techniques** : créer `einvoicing/EInvoicingProvider.java`, `EInvoicingProviderRegistry`, DTOs (`EInvoiceResult`, records). **Migration** `0238__create_einvoice_submission.sql` + master yaml. **Appels HORS transaction DB, idempotents** (clé = `invoiceNumber+orgId`), résultat persisté en transaction séparée via `afterCommit` (audit #2). Brancher dans `FiscalEngine`/le service de génération de facture sans modifier la numérotation NF existante.
- **Estimation** : L (~8 j-h)
- **Dépendances** : CLZ-P0-01

---

### [CLZ-P0-05] Contrat `ChannelConnector` unique (natif vs Channex transparent)
- **Phase / Domaine** : Phase 1 (cadrage) / Phase 4 (promotion directe) · 1. Channel Management
- **Cible** : Parité — **Multi-pays** : routage direct vs Channex décidable par pays (top OTAs en direct FR ; Channex/CM régional MENA où API directes fermées)
- **Contexte** : Hybride mature — connecteurs directs (`integration/channel/adapter/*` : Airbnb OAuth, Booking, Expedia…) coexistent avec Channex (`integration/channex/*`, sync Kafka bidirectionnelle, watchdog). `integration/channel/ChannelConnector.java` + `ChannelConnectorRegistry.java` sont le contrat unique. Dépendance Channex = coût/bien + marque tierce. Cf. 42 §domaine 1.
- **Critères d'acceptation** :
  - L'utilisateur voit un seul écran « Sync & Diagnostics » : état de santé par OTA **et par bien**, sans savoir si la connexion est directe ou via Channex.
  - Le routage par bien (direct `ChannelMapping` vs `ChannexPropertyMapping`) est décidé par une stratégie enregistrée dans `ChannelConnectorRegistry`, avec **fallback Channex** explicite.
  - Le routage est paramétrable par pays (FR → direct prioritaire ; MENA → Channex/CM régional).
  - Channex reste actif comme stratégie de repli ; aucune régression de sync sur les biens existants.
- **Notes techniques** : conserver `ChannelConnector` comme contrat unique ; ajouter une couche de routage dans `ChannelConnectorRegistry` (résolution direct/Channex par bien + pays via `country`). Controller mince (diagnostics délégués au service), DTO records (jamais d'entité de mapping exposée). Pas de check-then-act sur l'état de connexion. Migration éventuelle si métadonnée de stratégie persistée (`channel_routing_strategy`) → `0239__...` + master yaml.
- **Estimation** : XL (~15 j-h)
- **Dépendances** : CLZ-P0-01

---

### [CLZ-P0-06] Sync temps réel dispo/prix bidirectionnelle (Outbox → Kafka)
- **Phase / Domaine** : Phase 1 · 1. Channel Management
- **Cible** : Parité — **Multi-pays** : pas de spécificité mécanisme, mais écritures calendrier en `property.getTimezone()` (anti-décalage d'un jour FR/MA/KSA)
- **Contexte** : Bidirectionnelle via Channex : push sortant piloté par Kafka (`KafkaConfig.TOPIC_CALENDAR_UPDATES`, groupId `clenzy-channex-sync`) consommant le `CalendarEngine` ; inbound via webhooks signés (`ChannexWebhookController` + `ChannexSignatureValidator`). Latence dépendante du polling pour les OTAs sans webhook. Cf. 42 §domaine 1 (résilience).
- **Critères d'acceptation** :
  - Un changement prix/dispo se propage vers tous les canaux et une réservation entrante se reflète quasi-instantanément ; indicateur de fraîcheur de sync par OTA.
  - Push idempotents (idempotency key par fenêtre date/OTA) ; retries avec backoff + **DLT Kafka** ; pas de `catch(Exception)` avaleur (audit #7).
  - Inbound : webhooks signés vérifiés (`ChannexSignatureValidator`) ; rejet idempotent des doublons.
  - Écritures calendrier dans la **timezone du bien** (`property.getTimezone()`, audit #9) — pas de décalage d'un jour.
- **Notes techniques** : Outbox `CalendarEngine` → Kafka → consumers par channel ; généraliser retries/backoff + DLT sur tous les consumers ; réduire le polling au profit des webhooks. Effets externes hors transaction. Pas de migration majeure (réutilise l'Outbox existant).
- **Estimation** : M (~5 j-h)
- **Dépendances** : CLZ-P0-05

---

### [CLZ-P0-07] Sync des restrictions de séjour (`pushRestrictions` par adapter)
- **Phase / Domaine** : Phase 1 · 1. Channel Management
- **Cible** : Parité — **Multi-pays** : valider que les OTAs MENA exposent les mêmes types de restrictions (marketplaces P2P type Gathern plus pauvres)
- **Contexte** : Modèle riche côté PMS (`model/BookingRestriction.java` : min/max stay, CTA/CTD, gap, advance notice, days_of_week) + `service/RestrictionEngine.java`. Capacité `OUTBOUND_RESTRICTIONS` définie mais poussée partiellement (Booking, Expedia) ; couverture inégale (point faible historique 1/3). Cf. 42 §domaine 1.
- **Critères d'acceptation** :
  - Given des restrictions définies une fois dans le PMS, When la sync s'exécute, Then elles s'appliquent identiquement sur tous les canaux mappés.
  - `pushRestrictions` implémenté dans chaque adapter (mapping vers le modèle rate plan de l'OTA / restrictions Channex) en dérivant de `BookingRestriction` + `RestrictionEngine`.
  - Réconciliation périodique des restrictions distantes ; alerte watchdog en cas de divergence.
- **Notes techniques** : implémenter `ChannelConnector.pushRestrictions` par adapter ; réconciliation via le scheduler existant ; idempotency keys ; DLT sur échec. Controller mince, DTO records. Pas de check-then-act sur l'état distant.
- **Estimation** : L (~8 j-h)
- **Dépendances** : CLZ-P0-05, CLZ-P0-06

---

### [CLZ-P0-08] OTAs MENA — Gathern (KSA) et marketplaces locaux
- **Phase / Domaine** : Phase 3 · 1. Channel Management
- **Cible** : Parité — **Multi-pays** : cœur du cap KSA (Gathern, Stay.sa, Mabeet) ; SAR + ar/RTL
- **Contexte** : Uniquement des enums `ChannelName` (`GATHERN, STAY_SA, MABEET, KEASE, RENTELLY` — confirmés dans `integration/channel/ChannelName.java`) sans adapter ni client API. Aucune connexion MENA réelle aujourd'hui — lacune majeure pour le cap multi-pays. La plupart des API sont gated (pas de sandbox public). Cf. 41 §risques et 42 §domaine 1.
- **Critères d'acceptation** :
  - Given un host KSA, When il connecte son compte Gathern depuis l'onglet Channels, Then dispo/prix/réservations se synchronisent comme pour Airbnb.
  - `GathernChannelAdapter implements ChannelConnector` avec au minimum `OUTBOUND_CALENDAR` + `INBOUND_RESERVATIONS` ; SAR + ar/RTL dans les payloads.
  - **Prérequis contractuel** : accès API Gathern confirmé (sinon fallback documenté Rentals United / Channex / iCal via `ChannelManagerProviderType.RENTALS_UNITED`).
  - Métadonnée pays/devise/langue par canal pour filtrer le catalogue (disponibilité par pays).
- **Notes techniques** : créer `GathernChannelAdapter` + client API (OAuth ou API key selon partenaire) ; OAuth `state` = `UUID` aléatoire en Redis TTL 10 min (audit #3 / sécurité #3) ; secrets en colonnes chiffrées (cf. changeset 0233). Sync via Outbox/Kafka (CLZ-P0-06). Dates en `Asia/Riyadh`. **Risque** : API gated → dérisquer la disponibilité contractuelle avant le dev.
- **Estimation** : XL (~15 j-h, dont vérification d'accès API)
- **Dépendances** : CLZ-P0-01, CLZ-P0-05, CLZ-P0-06

---

### [CLZ-P0-09] Authentification à deux facteurs (2FA / TOTP)
- **Phase / Domaine** : Phase 0 · 12. Admin, sécurité & conformité
- **Cible** : Parité — **Multi-pays** : TOTP agnostique pays ; éviter le SMS seul (couverture/coût MA/KSA)
- **Contexte** : Aucune 2FA exposée (zéro `mfa/otp/totp/webauthn` au backend) ; auth Keycloak/SSO seule, RBAC actif. Cf. 42 §domaine 10/12.
- **Critères d'acceptation** :
  - Given un utilisateur, When il active la 2FA, Then il enrôle une app TOTP (Google Authenticator) et le second facteur est exigé aux logins suivants.
  - Une org peut rendre la 2FA **obligatoire** pour ses membres (`mfa_required`), propagée comme required action conditionnelle.
  - Surface frontend dans Settings/Sécurité (enrôlement + désactivation via Keycloak Account API).
- **Notes techniques** : activer le required action `CONFIGURE_TOTP` dans le realm Keycloak `clenzy` (côté **clenzy-infra**) ; flag org `mfa_required` sur `model/Organization.java` → **migration** `0240__add_mfa_required_to_organization.sql` + master yaml ; ne pas modifier `SecurityConfigProd.java` sans review (fichier sensible). Pas de SMS seul.
- **Estimation** : M (~5 j-h)
- **Dépendances** : CLZ-P0-02 (durcissement sécurité en place)

---

### [CLZ-P0-10] Édition groupée massive multi-propriété (bulk calendrier)
- **Phase / Domaine** : Phase 1 · 3. Calendrier & multi-tenant
- **Cible** : Parité — **Multi-pays** : plages en timezone de chaque propriété ; prix en devise du bien ; restrictions traduites fr/en/ar ; sélection RTL-aware
- **Contexte** : `service/CalendarEngine.java` opère par propriété (lock `pg_advisory_xact_lock(property_id)` + outbox Kafka), mais chaque appel est mono-propriété et le controller n'expose pas de bulk multi-bien. Côté UI, `client/src/modules/planning/hooks/usePlanningSelection.ts` est mono-événement. Cf. 42 §3 (Phase 1).
- **Critères d'acceptation** :
  - Given une sélection multiple de biens et de plages, When l'utilisateur applique blocage/prix/min-stay, Then chaque item est traité indépendamment et un rapport de succès/échec par item est renvoyé.
  - Le lock `pg_advisory_xact_lock` est acquis **par bien** (jamais un lock global) ; **une transaction par item** via bean séparé (éviter l'auto-invocation `@Transactional`, audit #6).
  - Un événement outbox Kafka **par item** ; résultat agrégé tolérant aux échecs partiels.
  - Prévisualisation de l'impact + sélection multiple côté React.
- **Notes techniques** : créer `BulkCalendarController` (mince) déléguant à un service qui boucle par propriété ; **un bean transactionnel par item** (`ObjectProvider<Self>` ou bean dédié) ; plages évaluées en `property.getTimezone()` ; prix via `StripeAmounts.toMinorUnits`-like par devise. Étendre `usePlanningSelection` (multi-select marquee/cases). `requireSameOrganization` sur chaque propriété chargée par ID. Pas de check-then-act (audit #8). Pas de migration.
- **Estimation** : L (~8 j-h)
- **Dépendances** : CLZ-P0-02, CLZ-P0-06

---

### [CLZ-P0-11] Emails de confirmation et rappels de réservation (site direct)
- **Phase / Domaine** : Phase 0 · 2. Booking engine & site direct
- **Cible** : Parité — **Multi-pays** : templates fr/en/ar + RTL ; dates en timezone propriété ; montants en devise réservation
- **Contexte** : `booking/service/PublicBookingService.java` génère un `confirmationCode` et persiste la réservation mais aucun `EmailService` n'est appelé dans le package booking ; pas de template de confirmation guest ni de rappels pré-séjour. Cf. 42 §domaine 2 (M / P0).
- **Critères d'acceptation** :
  - Given une réservation confirmée, When elle est créée, Then un email de confirmation est envoyé (idempotent par `confirmationCode`).
  - Séquence de rappels paramétrable (J-7, J-1) + pré-arrivée avec lien livret ; templates éditables par l'org ; opt-in/opt-out guest.
  - L'envoi se fait **après commit** (`TransactionSynchronization.afterCommit`) — aucun appel externe en transaction (audit #2).
  - Dates affichées en `property.getTimezone()` ; montants en devise de la réservation.
- **Notes techniques** : brancher l'événement de confirmation sur `service/EmailService.java` (Brevo/Postal) via `afterCommit` ; créer `BookingEmailTemplate` (entité) → **migration** `0241__create_booking_email_template.sql` + master yaml ; scheduler de rappels basé sur la date de séjour + `property.getTimezone()`. Échappement HTML obligatoire sur tout input guest (`StringUtils.escapeHtml`, sécurité #4). Templates RTL pour l'arabe.
- **Estimation** : M (~5 j-h)
- **Dépendances** : CLZ-P0-01 (résolution devise/locale pays)

---

### [CLZ-P0-12] i18n et RTL embarqués dans le `booking-sdk`
- **Phase / Domaine** : Phase 1 · 2. Booking engine & site direct
- **Cible** : Parité — **Multi-pays** : cœur de la cible (RTL arabe complet, formats locale-aware, EUR/MAD/SAR)
- **Contexte** : SDK headless (`booking-sdk/src` : `api-client.ts`, `events.ts`, `index.ts`, `types.ts`) qui délègue l'i18n à l'intégrateur ; aucun bundle de traductions ni gestion RTL fournis. Cf. 42 §domaine 2 (M / P0).
- **Critères d'acceptation** :
  - Pack de traductions livré avec le SDK (fr/en/ar) ; props `language` + `currency` ; API publique `setLanguage()` / `setCurrency()`.
  - Application automatique de `dir=rtl` et miroir des layouts en arabe (CSS logique `margin-inline`/`padding-inline`).
  - Formats date/nombre/devise localisés via `Intl` ; fallback gracieux sur clé manquante.
  - Tree-shaking des locales (pas de dépendance lourde).
- **Notes techniques** : module i18n léger dans `booking-sdk/src` ; résolution `dir` depuis la locale ; helpers RTL ; formatters `Intl`. Pas de backend/migration. La devise d'affichage reste cosmétique ; devis/facturation toujours serveur (audit #1).
- **Estimation** : M (~5 j-h)
- **Dépendances** : aucune (parallélisable)

---

### [CLZ-P0-13] Comparaison période N vs N-1 (delta backend canonique)
- **Phase / Domaine** : Phase 1 · 9. Reporting & Analytics
- **Cible** : Parité — **Multi-pays** : delta dans la devise de reporting org (après consolidation, voir CLZ-P0-14) ; N-1 recalculé en timezone propriété
- **Contexte** : `client/src/.../useAnalyticsEngine` calcule déjà `TrendValue` (value/previous/growth) et affiche un `TrendBadge`, mais la voie backend canonique `RevenueAnalyticsDto` (`/api/ai/analytics`, `service/AiAnalyticsService.java`) n'a aucun champ période précédente : le delta est une approximation client non opposable. Cf. 42 §domaine 9 (S / P0).
- **Critères d'acceptation** :
  - Given un KPI (revenu, ADR, RevPAR, occupation, marge), When le dashboard l'affiche, Then valeur courante + N-1 + delta % sont **calculés serveur**.
  - Choix du comparatif : période précédente glissante (`from.minus(span)`) ou même période N-1 (`from.minusYears(1)`).
  - Le calcul de delta est déplacé du front (`useAnalyticsEngine`) vers le service (source unique opposable).
- **Notes techniques** : étendre `RevenueAnalyticsDto` avec un bloc `PeriodComparisonDto` (current/previous/growth par métrique, **record**) ; `AiAnalyticsService.getAnalytics` relance le calcul sur la période comparative en une requête repo. `BigDecimal compareTo` (jamais `equals`) + `RoundingMode` explicite (audit #10). Controller mince. Pas de migration.
- **Estimation** : S (~3 j-h)
- **Dépendances** : aucune (mais cohabite avec CLZ-P0-14 pour la devise)

---

### [CLZ-P0-14] Agrégation multi-devise et consolidation portefeuille (EUR/MAD/SAR)
- **Phase / Domaine** : Phase 1 · 9. Reporting & Analytics
- **Cible** : Différenciation — **Multi-pays** : EUR (FR) / MAD (MA) / SAR (KSA) ; devise de reporting au choix de l'org ; taux figés à la date de transaction
- **Contexte** : Socle présent (`model/ExchangeRate.java`, `service/ExchangeRateProviderService.java` job @Scheduled MAD/SAR, `service/CurrencyConverterService.java` `convertToBase` déjà consommé par `FiscalReportingService`), mais l'analytics revenu/occupation (`AiAnalyticsService`) somme `totalPrice` brut sans conversion ni devise de reporting. Cf. 42 §domaine 9 (M / P0) et 41 §7.
- **Critères d'acceptation** :
  - Given un portefeuille multi-pays, When l'org consolide ses KPI, Then chaque réservation est convertie **à sa date** dans la devise de reporting choisie (pas de somme EUR/MAD/SAR bruts).
  - Paramètre `reportingCurrency` ; arrondis par devise (MAD/SAR souvent entiers) sur le modèle `StripeAmounts.toMinorUnits`.
  - Le taux utilisé est stocké/affiché ; source tracée (champ `ExchangeRate.source`).
- **Notes techniques** : généraliser `CurrencyConverterService.convertToBase` à tous les agrégats (`AiAnalyticsService.calculateTotalRevenue` / `revenueByMonth`) ; ajouter `reportingCurrency` à `RevenueAnalyticsDto`. `BigDecimal compareTo` jamais `equals` ; `RoundingMode` explicite par devise. Taux comptables figés `rateDate` (audit #10). Pas de migration (réutilise `ExchangeRate`).
- **Estimation** : M (~5 j-h)
- **Dépendances** : CLZ-P0-01, CLZ-P0-13

---

### [CLZ-P0-15] Report builder léger (vues sauvegardables + colonnes ad hoc)
- **Phase / Domaine** : Phase 1 · 9. Reporting & Analytics
- **Cible** : Parité — **Multi-pays** : dimension pays comme axe de groupement/filtre ; métriques monétaires consolidées via `ExchangeRate`
- **Contexte** : Aucun report builder : rapports figés (`ReportService` génère 4 PDF prédéfinis), dashboards codés en dur, pas de sélection dimensions/métriques ni de sauvegarde de vue. Cf. 42 §domaine 9 (L / P0).
- **Critères d'acceptation** :
  - Given un utilisateur, When il compose un rapport, Then il choisit dimensions (propriété, canal, période, **pays**), métriques (revenu, ADR, RevPAR, occupation, frais, marge), filtres, granularité, puis enregistre la vue et la réutilise.
  - Colonnes ad hoc réordonnables ; vue org-scopée.
  - Les champs sélectionnables sont **whitelistés** (anti-injection SQL).
  - Ownership : `requireSameOrganization` à chaque chargement de `ReportView` par ID.
- **Notes techniques** : entité `ReportView` (org-scopée : nom, dimensions JSONB, métriques, filtres, granularité, owner) → **migration** `0242__create_report_view.sql` + master yaml ; `ReportQueryService` borne les champs autorisés (whitelist) et traduit la définition en agrégation SQL paramétrée ; `ReportBuilderController` mince ; **DTO records, jamais d'entité JPA exposée** (audit #5). Métriques monétaires consolidées via `CurrencyConverterService` (CLZ-P0-14). Module front `report-builder` à créer.
- **Estimation** : L (~8 j-h)
- **Dépendances** : CLZ-P0-01, CLZ-P0-14

---

### [CLZ-P0-16] Moteur IA de tarification livré en prod (shadow → reco → auto)
- **Phase / Domaine** : Phase 1 · 4. Tarification / Yield
- **Cible** : Parité — **Multi-pays** : prompt LLM + features rule-based reçoivent le pays (week-end régional, Hijri) ; reco en devise locale propriété
- **Contexte** : `service/AiPricingService.java` existe (hybride rule-based + LLM Claude) mais derrière `clenzy.ai.features.pricing-ai=OFF`, jamais exposé en prod ; aucun pipeline de recommandation côté utilisateur. Cf. 42 §domaine 4 (L / P0).
- **Critères d'acceptation** :
  - Mode par org `OFF / SHADOW / RECOMMEND / AUTO` : SHADOW mesure l'écart vs PriceEngine, RECOMMEND affiche une suggestion (prix + justification LLM) sur le calendrier, AUTO applique bornée par min/max + cap de variation quotidien.
  - Le niveau `AI_SUGGESTION` est lu par `PriceEngine` **sans écraser** `RateOverride`.
  - Tableau de bord d'acceptation des recommandations.
  - Job quotidien calculant les recos org par org ; appel LLM **hors transaction** avec cache.
- **Notes techniques** : promouvoir `AiPricingService` en service productisé ; enum `PricingAiMode` par org ; table `price_recommendation` (property_id, date, suggested_price, base_price, source, accepted) → **migration** `0243__create_price_recommendation.sql` + master yaml (cohérente avec CLZ-P0-17) ; job `scheduler` via `TenantScopedExecutor` (contexte tenant hors HTTP) ; appel `AnthropicChatProvider` hors transaction + cache. Reco arrondie à la devise locale.
- **Estimation** : L (~8 j-h)
- **Dépendances** : CLZ-P0-01, CLZ-P0-17

---

### [CLZ-P0-17] Architecture de recommandation de prix (shadow/reco/auto, CAS-safe)
- **Phase / Domaine** : Phase 1 · 4. Tarification / Yield
- **Cible** : Parité — **Multi-pays** : delta de reco respecte les arrondis devise (MAD/SAR entiers, EUR centimes)
- **Contexte** : Aucune couche de recommandation ; `service/PriceEngine.java` résout un prix unique déterministe, pas de notion de prix suggéré vs appliqué ni de feedback d'acceptation. Cf. 42 §domaine 4 (M / P0).
- **Critères d'acceptation** :
  - Objet `PriceRecommendation` distinct du prix résolu, avec statut (`PROPOSED/ACCEPTED/REJECTED/EXPIRED`), source (`RULE/LLM/EXTERNAL`) et raison.
  - UI calendrier affichant prix actuel + delta suggéré ; accepter/rejeter par date ou en masse.
  - Transition de statut via **UPDATE conditionnel / CAS** (jamais check-then-act, audit #8).
  - Acceptation déclenche la sync calendrier via outbox ; ownership `requireSameOrganization` sur chaque acceptation par ID.
- **Notes techniques** : `PriceRecommendationService` orienté CAS ; entité `PriceRecommendation` + DTO **records** (jamais d'entité JPA exposée, audit #5) ; persistance via outbox pour déclencher la sync calendrier. Arrondis via helper `StripeAmounts.toMinorUnits`-like par devise. **Migration** partagée avec CLZ-P0-16 (`0243__create_price_recommendation.sql`) — table commune. Controller mince + `@PreAuthorize`.
- **Estimation** : M (~5 j-h)
- **Dépendances** : CLZ-P0-01

---

### [CLZ-P0-18] Injection des taxes par pays dans la simulation de prix
- **Phase / Domaine** : Phase 1 · 4. Tarification / Yield
- **Cible** : Parité — **Multi-pays** : FR TVA 10% héberg. + taxe séjour communale ; MA TVA 10/20% + taxe séjour ~28 MAD/pers/nuit ; KSA TVA 15% ; affichage TTC obligatoire dans le marché concerné
- **Contexte** : Taxes (TVA + taxe de séjour) calculées par `fiscal/FiscalEngine.java` **hors** pipeline `PriceEngine` ; le prix résolu est HT, pas de prix TTC simulé dans le yield. Cf. 42 §domaine 4 (M / P0).
- **Critères d'acceptation** :
  - Given une simulation/devis, When l'utilisateur la consulte, Then un prix TTC par pays (TVA hébergement + taxe de séjour) est affiché en plus du HT.
  - Le gestionnaire peut raisonner en cible TTC tout en pilotant un HT (ou l'inverse).
  - Montant **recalculé serveur**, aucune confiance au montant client (audit #1).
- **Notes techniques** : `PriceSimulationService` orchestrant `PriceEngine` puis `FiscalEngine` (taux par pays via `country`/`TaxRateResolver`) → renvoie un `PriceBreakdownDto` (HT, TVA, taxe séjour, TTC, **record**). `BigDecimal compareTo` + `RoundingMode` explicites (audit #10). Pas de migration (réutilise `FiscalEngine` + taux pays de CLZ-P0-01).
- **Estimation** : M (~5 j-h)
- **Dépendances** : CLZ-P0-01

---

### [CLZ-P0-19] `FrancePdpProvider` — Factur-X / PDP 2026-2027
- **Phase / Domaine** : Phase 1 · 8. Finance & Comptabilité
- **Cible** : Différenciation — **Multi-pays** : FR
- **Contexte** : Facturation NF FR conforme (`InvoiceNumberingService` séquentiel sans trou, contrainte changeset 0226, immuabilité post-ISSUED via `FranceComplianceStrategy`) mais PDF seul — pas de Factur-X (PDF/A-3 + XML CII embarqué) ni de raccordement PDP. Calendrier : réception 09/2026, émission TPE/PME 09/2027. Cf. 41 §4.1 et 42 §8 (XL / P0).
- **Critères d'acceptation** :
  - `render` enrichit le PDF iText7 en **PDF/A-3 + XML CII** (profil Factur-X EN 16931) embarqué via XMP/AFRelationship.
  - Transmission via client PDP agréée (OAuth2) ; cycle de vie statut (déposée/reçue/encaissée) reçu en webhook.
  - E-reporting B2C/transactions internationales agrégé.
  - Implémente `EInvoicingProvider` (mode `FACTURX_PDP`), résolu par `country.einvoicing_provider`.
- **Notes techniques** : créer `einvoicing/france/FrancePdpProvider.java` ; enrichir `InvoicePdfService` (PDF/A-3) ; client `integration/pdp` (à créer) ; remplir `Invoice.xmlContent` ; `FiscalReportingService` pour l'e-reporting. **Appels PDP hors transaction**, idempotents, persistance post-commit (audit #2). Clenzy ne devient pas PDP (intégration partenaire). Migration éventuelle pour le suivi de cycle de vie (réutiliser `einvoice_submission` de CLZ-P0-04). **Paramètre réglementaire mouvant** (périmètre PPF/PDP) — isoler la dépendance API.
- **Estimation** : XL (~15 j-h)
- **Dépendances** : CLZ-P0-04

---

### [CLZ-P0-20] `ZatcaProvider` — génération UBL 2.1 + signature XAdES
- **Phase / Domaine** : Phase 3 · 8. Finance & Comptabilité
- **Cible** : Différenciation — **Multi-pays** : KSA
- **Contexte** : `SaudiComplianceStrategy` = stub Phase 1 (TODO Phase 2 explicites : XML Fatoora, QR, clearance) ; `SaudiTaxCalculator` applique TVA 15% + municipality fee mais aucun document UBL ni signature. **Risque #1** du programme (cf. 41 §4.3 et 42 §8, XL / P0). Dérisquer par POC sandbox ZATCA avant engagement client KSA.
- **Critères d'acceptation** :
  - `render` mappe `Invoice` vers **UBL 2.1** (Invoice/CreditNote, UUID, ICV, taxes ligne, TVA 15%, bilingue ar/en).
  - Signature **XAdES enveloppée ECDSA secp256k1** avec le Production CSID ; canonicalisation C14N.
  - Calcul du hash SHA-256 de la facture signée pour la chaîne PIH et le QR.
  - Implémente `EInvoicingProvider` (modes `ZATCA_CLEARANCE`/`ZATCA_REPORTING`).
- **Notes techniques** : créer `einvoicing/ksa/ZatcaProvider.java`, `UblInvoiceMapper`, `XadesSigner` ; lib UBL/XML signature ; remplir `Invoice.xmlContent`. **POC sandbox d'abord.** PDF/A-3 RTL arabe (iText + reshaping). Effets hors transaction (clearance/reporting traités en CLZ-P0-23).
- **Estimation** : XL (~15 j-h, hors POC)
- **Dépendances** : CLZ-P0-04, CLZ-P0-21, CLZ-P0-22

---

### [CLZ-P0-21] ZATCA — chaîne PIH atomique (anti check-then-act)
- **Phase / Domaine** : Phase 3 · 8. Finance & Comptabilité
- **Cible** : Différenciation — **Multi-pays** : KSA (prérequis non négociable ZATCA)
- **Contexte** : Aucune chaîne de hash ; `service/InvoiceNumberingService.java` garantit déjà une numérotation séquentielle par verrou pessimiste mais sans PIH/ICV cryptographiques. Cf. 41 §4.3 et 42 §8 (L / P0). Concurrence = audit #8.
- **Critères d'acceptation** :
  - Table `zatca_invoice_chain` (org_id, icv, invoice_hash, prev_invoice_hash) avec **contrainte unique (org_id, icv)**.
  - Attribution ICV+PIH via **UPDATE conditionnel / verrou pessimiste** (modèle `InvoiceNumberingService`), jamais check-then-act.
  - 1ère facture : PIH = SHA-256 de NULL/0 ; séquence atomique **dans la transaction d'émission**.
  - Tout trou/rupture de chaîne déclenche une alerte (fraude).
- **Notes techniques** : créer `model/ZatcaInvoiceChain.java` + `ZatcaChainService` (calqué sur `InvoiceNumberingService`) ; **migration** `0244__create_zatca_invoice_chain.sql` (contrainte unique) + master yaml. Concurrence : verrou pessimiste / contrainte unique DB (audit #8). Séquencement ordonné par EGS unit.
- **Estimation** : L (~8 j-h)
- **Dépendances** : CLZ-P0-01

---

### [CLZ-P0-22] ZATCA — QR TLV + onboarding CSID (KMS)
- **Phase / Domaine** : Phase 3 · 8. Finance & Comptabilité
- **Cible** : Différenciation — **Multi-pays** : KSA
- **Contexte** : `qr_code_data` colonne libre non normalisée ; aucun stockage de certificat, aucun onboarding CSID. Cf. 41 §4.3 et 42 §8 (L / P0). Certificats en KMS (jamais en BDD).
- **Critères d'acceptation** :
  - Encodeur QR **TLV 9 tags** (vendeur, TIN, horodatage, TTC, TVA, hash facture, signature ECDSA, clé publique, signature CA) en Base64.
  - Onboarding via CSR + OTP vers `/compliance` puis `/production-csid` ; certificats X.509 + clés privées **stockés en KMS** (jamais en BDD/clair), rotation gérée.
  - Compliance CSID (test) puis Production CSID (live) après réussite des tests de conformité.
- **Notes techniques** : créer `einvoicing/ksa/ZatcaQrEncoder.java`, `ZatcaOnboardingService` ; intégration KMS (réutiliser la soupape de chiffrement infra — cf. changeset 0233 secrets chiffrés) ; modèle de certificat = **référence KMS uniquement** (pas de secret en clair, sécurité #7 / audit #12). Migration éventuelle pour la référence de certificat (`0245__...`) + master yaml.
- **Estimation** : L (~8 j-h)
- **Dépendances** : CLZ-P0-01

---

### [CLZ-P0-23] ZATCA — clearance B2B / reporting B2C (appels hors transaction)
- **Phase / Domaine** : Phase 3 · 8. Finance & Comptabilité
- **Cible** : Différenciation — **Multi-pays** : KSA
- **Contexte** : Aucun appel à l'API Fatoora ; aucune notion de clearance préalable ni de reporting différé. Cf. 41 §4.3 et 42 §8 (L / P0). Conformité = bloquant, pas best-effort (41 §1 principe 5).
- **Critères d'acceptation** :
  - **B2B** : `POST /invoices/clearance/single` **avant** remise à l'acheteur (clearance synchrone bloquante — facture non *cleared* = invalide).
  - **B2C** : `POST /invoices/reporting/single` sous 24h (job asynchrone).
  - Appels **HORS transaction DB** avec idempotency (UUID facture) ; retry/backoff + **DLT Kafka** sur échec ; jamais de `catch(Exception)` avaleur (audit #7).
  - Statut `CLEARED/REPORTED/REJECTED` persisté en transaction séparée + **notification admin si rejet** (état `CLEARANCE_FAILED`, pas de retry silencieux qui casserait la chaîne PIH).
  - Effets post-commit via `afterCommit`.
- **Notes techniques** : créer `integration/zatca/FatooraClient.java` ; `ZatcaProvider.clear/report` ; topic Kafka + DLT ; entité `EInvoiceSubmission` (réutiliser `einvoice_submission` de CLZ-P0-04). Effets externes post-commit (audit #2). Échec de clearance = état de réconciliation explicite + notif admin (audit #7 / 41 §1.5).
- **Estimation** : L (~8 j-h)
- **Dépendances** : CLZ-P0-04, CLZ-P0-20, CLZ-P0-21, CLZ-P0-22
