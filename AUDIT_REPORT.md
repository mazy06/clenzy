# Audit de code Clenzy — Rapport de campagne multi-agents (2026-06-10)

> **Date** : 2026-06-10
> **Méthode** : 2 workflows d'audit parallèles, 16 agents d'investigation bornés par zone + contre-expertise adversariale systématique de tous les constats graves (Critique/Élevée), ~3,6 M tokens d'analyse, **lecture seule** (aucune modification de code).
> **Avertissement** : audit par échantillonnage priorisé par risque. L'absence de constat dans une zone non couverte ne vaut pas absence de problème (voir le registre de couverture, section 2). **Mise à jour : les correctifs ont été appliqués les 2026-06-10/11.** Les sections 1 à 7 documentent l'état AVANT correctifs ; l'état post-correctifs est consigné dans la section 0 ci-dessous.

---

## 0. État post-correctifs (campagne du 2026-06-10/11)

> Cette section documente la campagne de correctifs exécutée immédiatement après l'audit. Les sections 1 à 7 sont conservées telles quelles : elles décrivent l'état du code AVANT correctifs.

### 0.1 Méthode

La campagne a traité les 124 constats en **4 vagues par clusters disjoints** (26 graves → 18 Élevées → 52 Moyennes → 28 Faibles + reliquats). Chaque cluster a suivi le même cycle : agent fixeur → réviseur adversarial → reprise des bloquants, avec un build complet `mvn package` entre chaque vague. Un **contre-audit final de re-scoring en lecture seule** (7 axes : re-notation, vérifications ligne à ligne des correctifs annoncés, recensement des risques résiduels) a clôturé la campagne ; il a débusqué et fait corriger 2 constats oubliés par les vagues (Z6-SECBUGS-03/04) ainsi qu'un trou d'ownership résiduel (PaymentController : contrôle d'org sur l'intervention chargée via `findById`).

Volumétrie : ~60 agents, ~16,5 M tokens. Builds verts : **11 119 tests / 0 échec** côté backend (dont ~470 tests ajoutés par la campagne), `tsc` frontend **0 erreur**.

### 0.2 Scores de santé avant → après (zones auditées uniquement)

| Axe | Avant | Après | Justification (contre-audit) |
|---|---|---|---|
| Sécurité | 3/10 | 8/10 | Les 7 correctifs les plus graves vérifiés ligne à ligne, réels et complets : recalcul serveur des montants (checkout booking + paiements interventions), ownership org sur SmartLock/Document/Property, CONNECT WebSocket rejeté sans JWT + SUBSCRIBE deny-by-default org-scopé, TenantFilter fail-closed, actuator restreint, session sans token brut, sanitisation des templates email au stockage et au rendu. Sondages aléatoires (trusted-proxy CIDR, plafond Redis livre d'or, cookie opaque, @Profile positif) tous conformes. |
| Bugs | 3/10 | 8/10 | Les 6 Critiques et les points de focus vérifiés ligne à ligne sont réels et complets : idempotence compare-and-set sur les confirmations, idempotency keys Stripe transmises, verrous pessimistes sur la numérotation, holds calendrier, outbox. Qualité d'implémentation élevée (ids d'audit tracés en commentaire, trade-offs documentés), 4 sondages Faible/Moyenne conformes. |
| Effets de bord | 6/10 | 8/10 | 4/4 constats cœur corrigés et vérifiés : appels Stripe sortis des transactions (refund en NOT_SUPPORTED), numérotation en REQUIRED, nettoyage ThreadLocal centralisé (4 seuls points d'écriture du TenantContext, tous avec finally-clear), plus aucune mutation de l'état statique `Stripe.apiKey`. T-BP-06 (transaction partagée de syncFeeds) corrigé en reprise post-contre-audit : une transaction par feed via le proxy Spring. |
| Architecture | 4/10 | 6/10 | Les 4 Élevées réellement traitées sur leurs points chauds (ReservationController 272 lignes / 0 repository, WalletController 113 lignes, orchestration transactionnelle déplacée en service, duplication PriceEngine supprimée), aucun correctif factice détecté ; mais la dette structurelle large subsiste : 53/150 controllers importent encore des repositories, cycle service↔integration quasi intact, 5 controllers exposent des entités JPA, 6 copies de validatePropertyAccess. |
| SOLID & Design | 4/10 | 7.5/10 | Extractions architecturales vérifiées, non cosmétiques : DocumentGeneratorService 329 lignes (vs 1 077), AgentOrchestrator 568 lignes (vs 1 403), registre OCP ReferenceTagResolver (8 beans) remplaçant les switch String, StripeGateway avec RequestOptions par appel, importICalFeed réduit à ~36 lignes d'orchestration. Dette résiduelle documentée : 3 classes restent au-delà de 1 000 lignes (ICalImportService, StripeService, EmailService). |
| Code mort | 7/10 | 9/10 | 7/7 constats corrigés et vérifiés : paquets zapier/hubspot supprimés sans référence résiduelle, migration 0229 (drop des tables orphelines), racine nettoyée (serverless.yml, scripts ad hoc), 12 composants React orphelins supprimés, PennylaneSignatureProvider supprimé. Résidu mineur : la valeur d'enum PENNYLANE subsiste avec comportement fail-fast. |
| Bonnes pratiques | 5/10 | 7.5/10 | 9/10 constats corrigés et vérifiés ligne à ligne : PiiMasker, FeedUrlMasker, StripeAmounts (HALF_UP + longValueExact), notifications de réconciliation ledger, remboursement automatique au lieu du mode dégradé, constantes nommées ; utilitaires testés et couverture des 5 fichiers critiques renforcée (tests signature créés). T-BP-06, initialement passé entre les mailles, corrigé en reprise post-contre-audit (10/10). |

### 0.3 Statut des constats

Sur les **124 constats (116 fiches uniques)**, le registre final de correctifs compte 130 entrées (dont les reliquats et reprises post-contre-audit traités séparément) : **96 corrigés** (y compris T-BP-06 et la régression latente DirectBookingService, repris après le contre-audit), **32 « déjà résolus »** (couverts par les correctifs d'autres constats) et **2 partiels assumés** (T-ARCH-01, T-ARCH-03). Plus aucun constat n'est hors registre.

| ID | Statut | Note |
|---|---|---|
| T-ARCH-01 | Partiel | Injection de repositories refactorée sur les pires controllers cités (ReservationController, WalletController) ; pattern systémique restant sur ~50 controllers — refactor progressif recommandé (voir 0.6). |
| T-ARCH-03 | Partiel | Backfill wallet déplacé de WalletController vers WalletService `@Transactional` décomposé ; optimisation des requêtes repository restante (`findAll()` filtré en mémoire). |
| Z6-SECBUGS-03, Z6-SECBUGS-04 | Corrigé (reprise post-contre-audit) | Oubliés par les vagues, débusqués par le contre-audit puis corrigés : catch global du listener Kafka de ChannelSyncService, parsing TZID/UTC d'ICalEventParser. |
| T-ARCH-06, T-ARCH-07, T-ARCH-08 | Déjà résolu (périmètre réduit) | Statut exact sur le fichier cité de chaque fiche, mais périmètre limité relevé par le contre-audit : cycle service↔integration quasi intact, 5 controllers exposent encore des entités JPA, 6 copies de validatePropertyAccess (voir 0.6). |
| Z1-SEC-01 à 08 ; Z1-SEC-FRONTAUX-01 à 05 ; Z1-BUGS-01, 02, 05, 09, 10 | Corrigé | Sécurité & config (WebSocket, profils, rate-limit, actuator, frontaux auth). |
| Z2-SEC-01 à 05, Z2-SEC-07 ; Z2-EFFETS-01, 02 | Corrigé | Multi-tenant : IDOR fermés, TenantFilter fail-closed, TenantScopedExecutor. |
| Z3-SEC-01 à 05 ; Z3-BUGS-01 à 10 | Corrigé | Paiements : montants serveur, idempotence, payouts, factures, fiscalité. |
| Z4A-SEC-01 à 05 ; Z4A-BUGS-01 à 10 ; reliquat BookingEnginePreview | Corrigé | Booking engine : checkout recalculé serveur, cycle de vie réservation, front aligné. |
| Z4B-SECBUGS-03, 04, 05 | Corrigé | Surfaces publiques (signature, livret, échange de clés). |
| Z5-BUGS-01 à 05, Z5-BUGS-08 | Corrigé | Pricing & calendrier : move CalendarEngine, yield idempotent, prix manuels → RateOverride. |
| Z6-SECBUGS-01 à 07 | Corrigé | iCal & channel sync (03/04 en reprise, voir ci-dessus). |
| Z7-SEC-01, 02 | Corrigé | Emails : sanitisation templates et customBody. |
| T-ARCH-02, 04, 10 ; T-SOLID-1, 2, 3, 5, 6, 7 (+ reliquat), 8 ; T-MORT-01 à 04 ; T-BP-01, 02, 05, 09 | Corrigé | Transverse : orchestration en service, god classes découpées, StripeGateway, code mort purgé, PII/secrets masqués. |
| Z1-BUGS-03, 04, 06, 07, 08 ; Z2-SEC-06 ; Z4B-SECBUGS-01, 02 ; Z5-BUGS-06, 07, 09, 10 ; Z7-SEC-03 ; T-ARCH-05 à 09 ; T-SOLID-4, 9, 10 ; T-BP-03, 04, 07, 08, 10 ; T-MORT-05, 06, 07 (+ reliquats T-MORT-03/04, C11) | Déjà résolu | Couverts par les correctifs d'autres constats des vagues précédentes (vérifié dans le code par les agents de cluster puis sondé par le contre-audit). |

### 0.4 Registre de couverture mis à jour

**Zones auditées → corrigées.** Les 17 zones de la section 2.1 (Z1-SEC, Z1-BUGS, Z2-SEC, Z2-EFFETS, Z3-SEC, Z3-BUGS, Z4A-SEC, Z4A-BUGS, Z4B-SECBUGS, Z1-SEC-FRONTAUX, Z5-BUGS, Z6-SECBUGS, Z7-SEC, T-ARCH, T-SOLID, T-MORT, T-BP) ont vu tous leurs constats traités, aux 2 partiels assumés près. Les scores « après » de la section 0.2 ne valent que pour ces zones.

**Zones restées HORS couverture d'audit** — inchangées par la campagne, donc non re-scorées :

- `client/src/modules/` — ~171 k lignes (hors surfaces auth/storage et BookingEnginePreview, seules touchées) ;
- ~30 sous-paquets de `server/.../integration/` (seuls `channel/` et `channelmanager/` audités en profondeur) ;
- `model/` (254 entités), `dto/`, `repository/` (échantillonné via les axes sécurité) ;
- `service/agent/` et multiagent (assistant IA, vu seulement par T-SOLID) ;
- `exception/`, `util/`, `compliance/`.

**Zones écartées volontairement** (inchangé) : `mobile/`, `ios/`, `booking-sdk/`, `clenzy-infra/`, `infrastructure/`, `nginx/`, `scripts/`, `command/`, `shared/`, `tests/`.

L'absence de constat dans une zone non auditée ne vaut toujours pas absence de problème : le périmètre non couvert reste à auditer.

### 0.5 Migrations créées

| Changeset | Objet |
|---|---|
| `0226__facture_numerotation_contrainte.sql` | Contraintes d'intégrité sur la numérotation des factures |
| `0227__pricing_lead_time_et_source.sql` | Bornes de lead time des rate_plans (fenêtres LAST_MINUTE / EARLY_BIRD) |
| `0228__paypal_provider_tx_id_index.sql` | Index sur provider_tx_id PayPal (remplace le scan `findAll()`) |
| `0229__drop_tables_integrations_mortes.sql` | Drop des tables orphelines `webhook_subscriptions` / `signature_requests` |

Les 4 changesets sont câblés dans `db.changelog-master.yaml` ; application automatique au boot prod après merge (invariant Liquibase du projet).

### 0.6 Risques résiduels & points de vigilance au déploiement

1. **EncryptedFieldConverter strict par défaut** — si des lignes legacy en CLAIR existent en prod (aucun backfill historique n'a jamais été fait), leur lecture lèvera `FieldDecryptionException` (login possiblement cassé). Soupape : `clenzy.security.field-encryption.fail-on-decrypt-error=false` le temps d'un backfill. **À VÉRIFIER AVANT DÉPLOIEMENT.**
2. **Plans LAST_MINUTE / EARLY_BIRD sans bornes** — des fenêtres par défaut sont désormais appliquées (≤ 7 j / ≥ 30 j) : changement de comportement tarifaire à communiquer aux organisations concernées.
3. **Front BookingEnginePreview aligné sur le total serveur** — déployer front et back ensemble, sinon 400 systématique sur le checkout du widget legacy.
4. **Endpoints PayPal return/webhooks absents des `permitAll()` de SecurityConfigProd** — le flux PayPal est probablement inopérant en prod ; **décision utilisateur requise** avant d'ouvrir ces endpoints.
5. **`@Filter` Hibernate non actif hors requête HTTP transactionnelle** — l'isolation multi-tenant repose sur les contrôles d'org explicites : convention à maintenir pour tout nouveau code (TenantScopedExecutor pour les schedulers ; les threads `@Async` propagent le TenantContext mais n'activent pas le filtre sur la nouvelle Session).
6. **`requireSameOrganization` no-op si `organizationId` NULL** (données legacy, DocumentController/PropertyController) — fail-open résiduel limité ; backfill des organizationId recommandé.
7. **EmailHtmlSanitizer = regex maison** (choix documenté pour préserver le round-trip éditeur) — robuste aux payloads imbriqués/obfusqués testés, mais surface de contournement supérieure à un parseur : envisager jsoup/OWASP en durcissement futur.
8. **Prix manuels historiques** stockés uniquement dans `calendar_days.nightly_price` : invisibles du PriceEngine (pas de backfill fiable possible) — les nouveaux prix manuels passent par RateOverride source MANUAL.
9. **Holds booking 30 min** — DoS mitigé par rate-limit IP + propriété ; surveillance recommandée.
10. **T-ARCH-01 — RÉSORBÉ INTÉGRALEMENT (chantier du 2026-06-11)** — les 160/160 controllers (y compris booking/ et integration/*/controller) ne dépendent plus d'aucun repository : logique et accès données déplacés vers la couche service (@Transactional + ownership org systématiques), entités JPA exposées remplacées par des records DTO à shape identique. Garde-fou permanent : règle ArchUnit **gelée** (`server/src/test/java/com/clenzy/architecture/ArchitectureRulesTest.java` + store `server/archunit_store/`, passé de 546 violations gelées à **0**) — toute nouvelle violation casse le build. Bonus chantier : 1 IDOR réel corrigé au passage (RateManagerController, règles tarifaires org-wide modifiables sans contrôle d'org).
11. **T-BP-06 — corrigé en reprise post-contre-audit** : `ICalImportService.syncFeeds` n'est plus `@Transactional` ; chaque feed est importé via le proxy Spring (`ObjectProvider<ICalImportService>`) donc dans sa propre transaction, conformément à la javadoc.
12. **Bug latent DirectBookingService — corrigé en reprise post-contre-audit** : `PaymentIntent.create` passe par `StripeGateway.createPaymentIntent` (clé portée par RequestOptions) et la conversion centimes par `StripeAmounts.toMinorUnits`. Flux direct-booking opérationnel après suppression du `Stripe.apiKey` global.
13. **Fuite de token iCal résiduelle — corrigée en reprise post-contre-audit** : les 3 logs d'ICalChannelAdapter masquent désormais la feedUrl via `FeedUrlMasker` (même pattern que T-BP-02).
14. **Conversions euros→centimes** — DeferredPaymentService et DirectBookingService corrigés (StripeAmounts) en reprise post-contre-audit ; reste cosmétique : 3 fichiers (BookingCheckoutController, StripeConnectPayoutExecutor, StripeConnectService) ré-implémentent la conversion HALF_UP inline — fonctionnellement correcte, à unifier sur StripeAmounts au prochain passage.
15. **TwoLayerCache sans invalidation cross-instance** (pas de pub/sub, option minimale documentée) — L1 potentiellement périmé en multi-instance jusqu'au TTL Caffeine.
16. **Cross-check montant checkout à deux références** (total complet OU hors taxe de séjour, héritage du widget legacy) — fenêtre de divergence volontairement élargie, à resserrer après migration du widget.
17. **Payout Stripe** — un échec de persistance après un transfert réussi repose sur un log ERROR et une relance humaine (pas d'alerte structurée de réconciliation).
18. **Contrats REST et autorisations à unifier** — 5 controllers exposent encore des entités JPA (dont SplitConfiguration en `@RequestBody`, vecteur de mass assignment) et 6 copies de validatePropertyAccess subsistent : une copie divergente deviendrait un trou d'autorisation silencieux. À titre mineur : enum PENNYLANE fail-fast et répertoire legacy `db/migration/` (format Flyway) à purger ; signerName complet persisté dans les notifications in-app CONTRACT_SIGNED sans politique de rétention RGPD dédiée.

### 0.7 Ce qui n'a PAS été fait (périmètre)

- **Aucun commit / push / PR** : tous les correctifs sont dans l'arbre de travail, en attente d'une demande explicite.
- **Aucun redémarrage Docker** : les migrations 0226-0229 s'appliqueront au prochain boot du serveur (dev comme prod).
- **Dépendances vulnérables (CVE) non scannées** — axe non couvert par l'audit initial, donc hors campagne.
- **Zones hors couverture d'audit non corrigées** (voir 0.4) : leur état est inchangé.

---

## 1. Synthèse exécutive

La campagne a produit **124 constats** (12 Critique, 32 Élevée, 52 Moyenne, 28 Faible) sur 17 zones. Les **44 constats graves ont tous été confirmés par contre-expertise (100 %, 0 faux positif)**. Trois foyers dominent : (1) la **surface paiement/booking** — le booking engine public accepte un montant fourni par le client et confirme la réservation (Z4A-SEC-01), les confirmations Stripe ne sont pas idempotentes (double crédit ledger, double virement possible) et les montants client ne sont jamais recalculés côté serveur ; (2) l'**isolation multi-tenant** — trois IDOR confirmés (serrures connectées, documents générés, propriétés) car `findById` contourne le filtre Hibernate sans validation d'ownership compensatoire ; (3) l'**intégrité du calendrier** — la modification de dates d'une réservation n'appelle jamais le CalendarEngine (double-booking), et la resync iCal peut annuler en cascade jusqu'à 50 % des réservations futures sans réactivation possible. S'y ajoutent des risques structurels : 72 controllers court-circuitent la couche service, deux sources de vérité prix divergent, et plusieurs god classes (1 000+ lignes) concentrent les flux critiques. La majorité des correctifs prioritaires sont localisés et rapides (gardes d'ownership, guards d'idempotence, recalculs serveur) : voir les quick wins (section 6).

### Score de santé par axe

| Axe | Note /10 | Justification |
|---|---|---|
| Sécurité | 3/10 | 6 Critique exploitables (IDOR cross-tenant, checkout public à montant libre) + 7 Élevée ; le socle (Keycloak, @PreAuthorize classe, validateurs SSRF) existe mais est contourné précisément aux points chauds. |
| Bugs | 3/10 | 6 Critique et 15 Élevée touchant l'argent (ledger, factures, payouts, TVA) et le calendrier (double-booking) ; idempotence quasi absente des flux de paiement. |
| Effets de bord | 6/10 | 4 constats seulement ; le ThreadLocal tenant jamais nettoyé est une fuite cross-tenant latente, mais la discipline orgId explicite limite l'exploitabilité actuelle. |
| Architecture | 4/10 | Couche service contournée par 72 controllers, cycle de dépendances service↔integration, duplications divergentes (résolution de prix recopiée et déjà fausse). |
| SOLID & Design | 4/10 | God classes de 1 000+ lignes (DocumentGeneratorService, AgentOrchestrator), état global Stripe muté dans ~13 classes, 78 catch(Exception) génériques. |
| Code mort | 7/10 | Volume contenu (2 paquets d'intégration fantômes, 12 composants React, scripts racine) ; un seul cas avec impact surface d'attaque (endpoint public hubspot). |
| Bonnes pratiques | 5/10 | Secrets et PII dans les logs, dégradations silencieuses sur les flux financiers ; mais couverture de tests globalement solide (711 fichiers, 10 545 @Test). |

---

## 2. Registre de couverture

### 2.1 Audité

| Zone | Périmètre | Vague | Constats | Couverture rapportée (condensé) |
|---|---|---|---|---|
| Z1-SEC | config/ sécurité & auth (SecurityConfig*, filtres, WS, rate-limit, chiffrement) | 1 | 8 | 14 fichiers lus en profondeur + survol des 49 fichiers config/ par grep ciblé ; non lus en détail : Kafka/Redis/Cache/DataSourceRouting et sous-paquet ai/. |
| Z1-BUGS | config/ technique (caches 2 niveaux, routing DataSource, Async, Kafka, runners/seeders) | 1 | 10 | 17/17 fichiers du périmètre lus intégralement ; vérifications croisées application-prod.yml, tenant/, repositories et @Cacheable. |
| Z2-SEC | Multi-tenancy & ownership (tenant/, chaînes controller→service échantillonnées) | 1 | 7 | tenant/ intégral + chaînes SmartLock/Document/Property/Reservation/User ; 21 controllers sans @PreAuthorize classe vérifiés (tous publics légitimes) ; 121 entités avec organizationFilter vs 48 sans balayées ; majorité des 150 controllers protégés non lus. |
| Z2-EFFETS | Effets de bord tenant (schedulers, async, listeners Kafka) | 1 | 2 | TenantContext/TenantFilter/AsyncConfig + 6 schedulers lus ; grep des 18 fichiers tenant/+scheduler/ et de tous les @KafkaListener ; hors ICalSyncScheduler, les jobs passent l'orgId explicitement. |
| Z3-SEC | Paiements — surface sécurité (webhooks Stripe/PayPal/PayTabs/Payzone/CMI, orchestration) | 1 | 5 | 15 fichiers lus en profondeur ; non lus : payment/payout/* (Wise, GoCardless, SEPA, StripeConnect executors), calculateurs fiscaux pays, clients HTTP internes. |
| Z3-BUGS | Paiements — logique (StripeService, facturation, fiscal/, payouts) | 1 | 10 | StripeService, InvoiceGeneratorService, package fiscal/ intégral, StripeConnectPayoutExecutor + chaînes webhook/facturation lues pour confirmation ; PayTabs/Payzone/CMI et executors Wise/SEPA non lus. |
| Z4A-SEC | Booking engine — surface publique (controllers publics, API key filter) | 1 | 5 | 5 controllers publics + BookingApiKeyFilter + services associés lus ; AiDesignService, SiteSnapshotService et DTOs design non lus. |
| Z4A-BUGS | Booking engine — logique réservation/paiement | 1 | 10 | PublicBookingService, checkout, cleanup scheduler, DTOs lus + confirmations CalendarEngine/StripeService/PriceEngine ; ~25 fichiers (AI design, auth guest, admin) non lus. |
| Z4B-SECBUGS | Surfaces publiques signature/livret/échange de clés | 1 | 5 | Périmètre complet lu : signature publique (controller + services + stamper), WelcomeGuide, KeyExchange, throttles, RateLimitInterceptor. |
| Z1-SEC-FRONTAUX | Frontend auth/storage (tokens, cookies, telemetry) | 1 | 5 | storageService, TokenService, apiClient, keycloak.ts, main.tsx lus + grep exhaustif localStorage/sessionStorage de client/src ; aucun token d'auth en localStorage ; le seul point d'injection HTML brut React restant (WhatsAppTemplateEditorDialog) est hors périmètre. |
| Z5-BUGS | Pricing & calendar engines (CalendarEngine, PriceEngine, yield, distribution) | 2 | 10 | 12 fichiers cœur lus + confirmations Reservation/PublicBooking/adapters/migrations 0045-0050 ; PriceLabs, AiPricing, RestrictionEngine, ExchangeRate non lus. |
| Z6-SECBUGS | iCal & channel sync (import, parser, validateur, scheduler) | 2 | 7 | ICalImportService (1 099 l.) intégral + validateur, parser, adapter, ChannelSyncService, scheduler, controller ; redirections HTTP désactivées et caps de taille vérifiés (pas d'OOM ; pas d'export iCal avec secret). |
| Z7-SEC | Emails/templates/PDF (injection HTML, interpolation) | 2 | 3 | EmailService (1 252 l.) intégral, wrapper/interpolation/templates système, DocumentGeneratorService, TagResolverService ; preview cross-org, severityColor et pipeline ODT vérifiés et écartés. |
| T-ARCH | Architecture transverse (couches, dépendances, duplication) | 3 | 10 | 9 fichiers lus en profondeur + grep systématique des 150 controllers (imports repository, @Transactional, retours d'entités) ; aucune dépendance inverse model→controller ; scheduler/, fiscal/, compliance/ non lus. |
| T-SOLID | SOLID & design sur 10 gros services | 3 | 10 | 10 services couverts par métriques (longueur méthodes, dépendances, catch/switch) + lecture approfondie des zones critiques ; ManagerService et ContactMessageService, les plus sains, survolés. |
| T-MORT | Code mort (integration/, scripts racine, composants front) | 3 | 7 | 35 sous-paquets integration/ greppés exhaustivement, scripts racine croisés avec les 6 workflows CI, components/ double-greppé (12 orphelins confirmés) ; flags mock tous vivants. |
| T-BP | Bonnes pratiques sur 5 fichiers critiques | 3 | 10 | StripeService, ICalImportService, PublicBookingService, InvoiceGeneratorService, ContractSignatureService lus intégralement ; server/src/test traité en volumétrie (711 fichiers, 10 545 @Test). |

### 2.2 Resté hors couverture (à auditer ultérieurement)

- `client/src/modules/` — 580 fichiers, ~171 k lignes : seules les surfaces auth/storage ont été vues.
- `client/src/hooks/` et `client/src/components/` — couverture partielle (code mort + grep storage uniquement).
- ~30 sous-paquets de `server/.../integration/` — seuls `channel/` et `channelmanager/` ont été audités en profondeur ; les autres uniquement balayés par l'axe code mort.
- `model/` — 254 entités (vues seulement via le balayage organizationFilter), `dto/`, `repository/` — 165 interfaces, échantillonnées via les axes sécurité.
- `scheduler/` — partiel (6 schedulers lus, le reste greppé).
- `service/agent/*` (assistant IA) — vu seulement par T-SOLID.
- `exception/`, `util/`, `compliance/`.

### 2.3 Écarté volontairement

`mobile/`, `ios/`, `booking-sdk/` (4 fichiers), `clenzy-infra/`, `infrastructure/`, `nginx/`, `scripts/`, `command/`, `shared/`, `tests/`, fichiers `HANDOFF_*.md` et PDF racine — hors périmètre code applicatif principal.

---

## 3. Tableau de bord

Matrice des 124 constats par axe et sévérité (avant fusion des doublons) :

| Axe | Critique | Élevée | Moyenne | Faible | Total |
|---|---|---|---|---|---|
| Sécurité | 6 | 7 | 14 | 11 | 38 |
| Bugs | 6 | 15 | 16 | 8 | 45 |
| Effets de bord | 0 | 1 | 3 | 0 | 4 |
| Architecture | 0 | 4 | 4 | 2 | 10 |
| SOLID & Design | 0 | 3 | 5 | 2 | 10 |
| Code mort | 0 | 0 | 4 | 3 | 7 |
| Bonnes pratiques | 0 | 2 | 6 | 2 | 10 |
| **Total** | **12** | **32** | **52** | **28** | **124** |

**Contre-expertise** : les 44 constats graves (Critique + Élevée) ont tous été soumis à une contre-expertise adversariale indépendante : **44/44 confirmés (100 %), 0 faux positif, 0 incertain**. Quelques nuances de sévérité ont été relevées (exploitabilité latente de Z1-SEC-01/02 faute de route nginx /ws, sévérité de T-BP-01 discutable) et sont reportées dans les fiches.

Après fusion de 8 doublons inter-zones (voir section 5), le rapport compte **116 constats uniques** : 10 Critique, 30 Élevée, 50 Moyenne, 26 Faible.

---

## 4. Top 10 des problèmes critiques

> **Statuts post-correctifs : voir section 0.** Les fiches ci-dessous décrivent l'état AVANT correctifs.

Les 10 constats Critique uniques (après fusion), classés par priorité : exposition publique > fuite cross-tenant > argent > intégrité des données.

### 4.1 [Z4A-SEC-01 / Z4A-BUGS-01] — Checkout public : réservation confirmée pour un montant arbitraire (Critique — Sécurité)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/booking/controller/BookingCheckoutController.java:51-110 (74-75) ; booking/service/PublicBookingService.java:771-782 |
| Catégorie | Contournement de paiement / manipulation de prix |
| Description | POST /api/booking-engine/checkout/create-session est public non authentifié (permitAll SecurityConfigProd l.149, hors BookingApiKeyFilter) et crée la session Stripe avec le montant fourni par le client : request.amount() (DTO juste @Positive) n'est jamais recalculé via le PriceEngine — seules les service options le sont. Au webhook, confirmBookingEngineCheckout persiste session.getAmountTotal() comme totalPrice et crée une réservation CONFIRMED + PAID ; la divergence avec le prix recalculé n'est que loggée (log.warn). |
| Impact | Un attaquant réserve n'importe quel logement de n'importe quelle organisation pour un montant arbitraire (minimum Stripe ~0,50 EUR) : réservation confirmée et payée, calendrier bloqué, facture et crédit wallet générés sur ce montant. Perte de revenu directe et réservations frauduleuses. |
| Preuve | `java.math.BigDecimal totalAmount = request.amount().add(serviceOptionsTotal);` … `long amountInCents = totalAmount.multiply(java.math.BigDecimal.valueOf(100)).longValue();` |
| Recommandation | Recalculer intégralement le total côté serveur via checkAvailability (nuits + ménage + taxe de séjour) à partir de propertyId/dates/guests, ignorer request.amount() ; au webhook, rejeter (ne pas créer en mode dégradé) toute session dont amount_total diverge du total recalculé. |
| Confiance | confirmé |
| Vérification | Confirmé par deux contre-expertises indépendantes : permitAll vérifié, aucun recalcul au create-session, le webhook recalcule le breakdown mais persiste le montant client et se contente d'un log.warn sur divergence. Nuance : Stripe impose ~0,50 EUR minimum par charge — la criticité reste entière. |

### 4.2 [Z4A-BUGS-02] — Paiement tardif sur réservation annulée : argent encaissé, dates re-vendables (Critique — Bugs)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/booking/service/PendingReservationCleanupScheduler.java:50-62 |
| Catégorie | Concurrence / paiement tardif |
| Description | Le scheduler annule les réservations PENDING à 30 min et libère le calendrier, mais la session Stripe (createReservationCheckoutSession) n'a pas de setExpiresAt (validité Stripe 24 h) et n'est pas expirée à l'annulation. Si le guest paie après l'annulation, le webhook appelle confirmReservationPayment qui passe paymentStatus=PAID sans vérifier le status : la réservation reste « cancelled », le calendrier reste libre, mais l'argent est encaissé, les wallets crédités et la facture générée. |
| Impact | Guest débité pour une réservation annulée dont les dates peuvent déjà être re-réservées par un autre voyageur (double-vente), sans aucun blocage calendrier ni alerte. |
| Preuve | `reservation.setPaymentStatus(PaymentStatus.PAID);` … `reservation.setPaidAt(LocalDateTime.now());` … `reservationRepository.save(reservation);` |
| Recommandation | Poser session.expires_at à 30 min à la création (ou expirer la session via l'API Stripe lors du cleanup) ; dans confirmReservationPayment, vérifier le status : si « cancelled », rembourser automatiquement ou re-valider la disponibilité avant de réactiver. |
| Confiance | confirmé |
| Vérification | Confirmé : aucun setExpiresAt, aucun handler checkout.session.expired dans StripeWebhookController, confirmReservationPayment (StripeService l.559-565) ne vérifie jamais reservation.status ; le routage webhook type=reservation est avéré. |

### 4.3 [Z2-SEC-01] — IDOR cross-tenant sur les serrures connectées (Critique — Sécurité)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/SmartLockService.java:114-122, 142-144, 218-220 |
| Catégorie | IDOR / cross-tenant |
| Description | deleteDevice, getLockStatus et sendLockCommand chargent la serrure via smartLockRepository.findById(deviceId) sans appeler requireSameOrganization(device). Les commentaires du fichier (l.95) confirment que findById ne passe pas par le filtre Hibernate organizationFilter ; seul updateAccessCodeMode (l.101) valide l'org. Le commentaire l.110-112 affirme à tort que « l'isolation multi-tenant est assurée par le filtre Hibernate ». |
| Impact | Un utilisateur authentifié d'une org A (n'importe quel rôle org : HOST, TECHNICIAN, HOUSEKEEPER, SUPERVISOR) peut verrouiller/déverrouiller, lire le statut ou SUPPRIMER n'importe quelle serrure d'une org B en devinant l'id (incrémental). Accès physique compromis sur des logements tiers. |
| Preuve | `public void deleteDevice(String userId, Long deviceId) { SmartLockDevice device = smartLockRepository.findById(deviceId).orElseThrow(...);  // pas de requireSameOrganization(device)` |
| Recommandation | Appeler requireSameOrganization(device) dans deleteDevice, getLockStatus et sendLockCommand juste après le findById, exactement comme updateAccessCodeMode. Corriger le commentaire trompeur l.110-112. |
| Confiance | confirmé |
| Vérification | Confirmé : seul updateAccessCodeMode appelle le guard ; le helper requireSameOrganization existe déjà (l.124-131) — fix trivial. Controller en isAuthenticated() seul, tout rôle org passe (SecurityConfigProd:173). IDOR sur contrôle d'accès physique, lignes exactes. |

### 4.4 [Z2-SEC-02] — IDOR cross-tenant sur le téléchargement de documents générés (Critique — Sécurité)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/controller/DocumentController.java:291-320 |
| Catégorie | IDOR / cross-tenant |
| Description | downloadGeneration (GET /api/documents/generations/{id}/download, @PreAuthorize isAuthenticated()) récupère le document via getGeneration(id) qui fait generationRepository.findById(id) (DocumentGeneratorService.java:1067-1070, bypass du filtre Hibernate). Le seul contrôle d'ownership (validateInterventionOwnership) n'est exécuté que si referenceType == INTERVENTION ; pour tout autre type (DEVIS, INVOICE, contrat…) aucune vérification d'organisation. |
| Impact | Un utilisateur authentifié d'une org A peut télécharger n'importe quel document généré (facture, devis, mandat) d'une org B en itérant sur l'id. Fuite de données financières et contractuelles cross-tenant. |
| Preuve | `DocumentGeneration generation = generatorService.getGeneration(id);` … `if (generation.getReferenceType() == ReferenceType.INTERVENTION && ...) { validateInterventionOwnership(jwt, generation.getReferenceId()); }` |
| Recommandation | Valider systématiquement que generation.getOrganizationId() == tenantContext.getOrganizationId() (sauf staff plateforme) avant de servir le fichier, en plus du check intervention existant. |
| Confiance | confirmé |
| Vérification | Confirmé : DocumentGeneration porte bien organizationId + @Filter mais findById l'ignore ; aucun filtre email sur ce chemin (contrairement à getGenerationsByReference). Téléchargement cross-tenant par itération d'id avéré. |

### 4.5 [Z2-SEC-03] — IDOR cross-tenant sur les propriétés pour les rôles non-HOST (Critique — Sécurité)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/controller/PropertyController.java:135-171 |
| Catégorie | IDOR / cross-tenant |
| Description | checkHostAccess (l.56-76) ne valide l'ownership que si userRole == HOST. Pour les autres rôles org autorisés (TECHNICIAN, HOUSEKEEPER, SUPERVISOR, LAUNDRY, EXTERIOR_TECH — SecurityConfigProd l.173), le check est un no-op. Les méthodes service appelées (getById→findByIdRespectingTenant, update, updateStatus, delete) reposent toutes sur findById/existsById/deleteById, qui ne passent pas par le filtre Hibernate. |
| Impact | Un utilisateur non-HOST d'une org A (ex. TECHNICIAN) peut lire (GET /{id}), modifier (PUT /{id}, PATCH /{id}/status) ou supprimer (DELETE /{id}) n'importe quelle propriété d'une org B via son id. Le commentaire PropertyService.java:148-151 affirme à tort que findById gère l'isolation. |
| Preuve | `private void checkHostAccess(Long propertyId, Jwt jwt) { UserRole userRole = JwtRoleExtractor.extractUserRole(jwt); if (userRole == UserRole.HOST && jwt != null) { ... } // aucune branche pour les autres roles org` |
| Recommandation | Dans PropertyService (update/updateStatus/delete/getById), valider l'org via tenantContext.getOrganizationId() vs property.getOrganizationId() pour tout rôle non staff-plateforme, ou utiliser findByIdAndOrganizationId. Le check ne doit pas dépendre du rôle HOST. |
| Confiance | confirmé |
| Vérification | Confirmé : no-op pour les 5 rôles non-HOST, toutes les méthodes service bypassent le filtre, aucun @PreAuthorize méthode sur get/update/delete/updateStatus. Lecture/modification/suppression cross-tenant avérée. |

### 4.6 [Z1-SEC-01] — Topics WebSocket org-scopés diffusés sans aucune autorisation (Critique — Sécurité, latent)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/config/WebSocketConfig.java:29-49 |
| Catégorie | Auth WebSocket contournable / isolation multi-tenant |
| Description | Le broker STOMP diffuse du contenu métier org-scopé sur des topics non sécurisés (/topic/conversations/{orgId} — ConversationEventPublisher.java:34 ; /topic/contact/{orgId} — ContactMessageEventPublisher.java:73). /ws/** est permitAll() (SecurityConfigProd.java:150) et le seul intercepteur inbound (WebSocketAuthInterceptor) ne traite que la trame CONNECT — aucune autorisation au niveau SUBSCRIBE (pas de AbstractSecurityWebSocketMessageBrokerConfigurer / simpDestMatchers). |
| Impact | Un client (même non authentifié, cf. Z1-SEC-02) peut s'abonner aux topics de n'importe quelle organisation en devinant l'orgId et recevoir en temps réel tous les messages (conversations guests, messages de contact). Fuite cross-tenant, contournement du @Filter Hibernate. |
| Preuve | `config.enableSimpleBroker("/topic", "/queue");` … `registration.interceptors(webSocketAuthInterceptor);` |
| Recommandation | Ajouter une autorisation au niveau SUBSCRIBE : sur StompCommand.SUBSCRIBE, extraire l'orgId de la destination et vérifier la correspondance avec le TenantContext/Principal, ou utiliser Spring Security messaging (simpSubscribeDestMatchers). |
| Confiance | confirmé |
| Vérification | Confirmé (défaut de code réel, grep SUBSCRIBE = 0 résultat) avec nuance d'exploitabilité : en prod, nginx n'a aucun bloc location /ws — le endpoint n'est pas atteignable depuis Internet aujourd'hui. Défaut latent et critique dès qu'un proxy /ws sera ajouté (le front appelle pourtant app.clenzy.fr/ws). |

### 4.7 [Z3-SEC-01 / Z3-BUGS-02] — Paiement d'intervention : montant client non vérifié, ledger crédité sur l'estimation (Critique — Sécurité)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/controller/PaymentController.java:118-130, 197-201 ; service/StripeService.java:155-161, 442-447 |
| Catégorie | Manipulation de prix / intégrité financière |
| Description | /api/payments/create-session et /create-embedded-session passent request.getAmount() (validé seulement @Positive) directement à Stripe, sans jamais le comparer à intervention.getEstimatedCost(). À la confirmation, confirmPayment crédite le ledger et génère la facture avec getEstimatedCost(), pas le montant réellement encaissé. |
| Impact | Un HOST authentifié peut payer un montant arbitraire (ex. 1 EUR) pour une intervention facturée 500 EUR : Stripe encaisse 1 EUR mais wallet/ledger/facture enregistrent 500 EUR comme reçus — trou comptable et encaissement frauduleux. |
| Preuve | `PaymentOrchestrationRequest orchRequest = new PaymentOrchestrationRequest(request.getAmount(), currency, ...` |
| Recommandation | Ignorer request.getAmount() : recalculer le montant côté serveur depuis intervention.getEstimatedCost() (ou rejeter si différent) avant l'orchestrateur ; à la confirmation, enregistrer le montant réellement payé (session.getAmountTotal). |
| Confiance | confirmé |
| Vérification | Confirmé par deux contre-expertises : aucun contrôle dans le controller ni dans PaymentOrchestrationService ; le ledger est crédité sur estimatedCost. Nuance : l'endpoint exige un rôle HOST/SUPER_*, mais le HOST est précisément le payeur — il contrôle son propre montant. |

### 4.8 [Z3-BUGS-01 / Z3-SEC-02] — Confirmations Stripe non idempotentes : double crédit ledger sur relivraison webhook (Critique — Bugs)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/StripeService.java:559-578, 425-447 |
| Catégorie | Idempotence / double comptabilisation |
| Description | confirmPayment, confirmReservationPayment, confirmServiceRequestPayment et confirmGroupedPayment ne vérifient jamais si le paiement est déjà PAID avant de re-exécuter le flux (passage PAID + ensureWalletsAndRecordPayment : ledgerService.recordTransfer escrow→platform + split). LedgerService.recordTransfer n'a aucune déduplication par (refType, refId), StripeWebhookController ne déduplique pas par Event.id, et PaymentController.getSessionStatus déclenche aussi une confirmation manuelle en fallback (course possible avec le webhook). |
| Impact | Une relivraison du webhook checkout.session.completed (Stripe livre at-least-once) duplique les écritures ledger ESCROW→PLATFORM et le split PLATFORM→OWNER/CONCIERGE : soldes wallets faux (argent compté deux fois). |
| Preuve | `reservation.setPaymentStatus(PaymentStatus.PAID);` … `ensureWalletsAndRecordPaymentForReservation(reservation.getOrganizationId(), ownerId, ...` |
| Recommandation | Guard en tête de chaque confirm* (early-return si paymentStatus == PAID) ; en complément, dédupliquer par Event.id Stripe (table processed_webhook_events) ou contrainte unique sur ledger_entries(reference_type, reference_id, entry_type, wallet_id). |
| Confiance | confirmé |
| Vérification | Confirmé deux fois : aucun guard PAID dans les 4 confirm*, ledger_entries sans contrainte unique (vérifié en base : PK + 2 CHECK seulement). Preuve a contrario : confirmBookingEngineCheckout a, lui, un guard PAID — pattern connu mais non généralisé. Sur le chemin webhook pur le split échoue silencieusement (pas de TenantContext) ; le double-split passe par la course webhook/fallback authentifié — le double-crédit ledger reste réel. |

### 4.9 [Z3-BUGS-03] — Payout Stripe Connect : retry sans idempotence, double virement possible (Critique — Bugs)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/payment/payout/executor/StripeConnectPayoutExecutor.java:58-81 |
| Catégorie | Retry sans idempotence / double virement |
| Description | Le try englobe le transfert Stripe ET le save DB + notifications post-transfert. Si payoutRepository.save (l.73) ou notifier.notifySuccess (l.75) lève une exception APRÈS que Transfer.create a réussi, failPayout marque le payout FAILED et incrémente retryCount. StripeConnectService.createTransfer (l.120-139) n'utilise aucune idempotency key Stripe. |
| Impact | Un re-essai d'un payout marqué FAILED alors que le transfert Stripe a réussi envoie l'argent une deuxième fois au propriétaire. |
| Preuve | `Transfer transfer = stripeConnectService.createTransfer(...);` … `} catch (Exception e) { return failPayout(payout, e.getMessage());` |
| Recommandation | Restreindre le catch à l'appel createTransfer uniquement ; passer une idempotency key Stripe (ex. "payout-" + payout.getId()) via RequestOptions ; persister le transferId avant toute notification. |
| Confiance | confirmé |
| Vérification | Confirmé : le try englobe Transfer.create + save + notifySuccess (PayoutNotifier ne catch rien) ; aucune RequestOptions/idempotency key ; PayoutExecutionService.retryPayout (l.100-118) remet un FAILED en APPROVED et ré-exécute → second Transfer.create réel si l'échec initial était post-transfert. |

### 4.10 [Z5-BUGS-01] — Modification de réservation sans CalendarEngine : double-booking et calendrier stale (Critique — Bugs)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/controller/ReservationController.java:230-299 (+ ReservationService.java:122, 141-156) |
| Catégorie | Double-booking / calendrier stale |
| Description | PUT /reservations/{id} (« tous les champs sont modifiables ») applique les nouvelles dates via reservationMapper.apply puis sauve avec reservationRepository.save(existing) directement, sans jamais appeler CalendarEngine (ni cancel ni book). Le seul chemin qui écrit calendar_days est ReservationService.save, gardé par isNewConfirmed = (id == null && "confirmed") : une mise à jour ou un passage pending→confirmed ne touche jamais le calendrier. |
| Impact | Changement de dates d'une réservation confirmée : les anciens jours restent BOOKED (bloqués à tort), les nouveaux jours ne sont ni vérifiés ni bloqués → double-booking possible + aucun event outbox → désynchronisation des channels. |
| Preuve | `LocalDate oldCheckIn = existing.getCheckIn(); ... reservationMapper.apply(dto, existing); ... Reservation saved = reservationRepository.save(existing);` |
| Recommandation | Sur changement de dates : sous le lock advisory, libérer les anciens jours puis re-réserver les nouveaux via CalendarEngine (cancel+book ou opération move dédiée) et publier l'event outbox ; idem pour la transition pending→confirmed. |
| Confiance | confirmé |
| Vérification | Confirmé : le controller DÉTECTE le changement de dates (datesChanged) mais ne s'en sert que pour régénérer les codes serrure — le cas a été pensé, le calendrier oublié. Grep exhaustif : aucun réconciliateur ne reconstruit calendar_days depuis les réservations. Lignes réelles 230-309. |

---

## 5. Backlog complet

> **Statuts post-correctifs : voir section 0.** Les fiches ci-dessous décrivent l'état AVANT correctifs.

Cette section recense les **106 constats restants** (116 fiches uniques moins les 10 du Top 10). **8 fusions de doublons inter-zones** ont été opérées dans l'ensemble du rapport (3 dans le Top 10 : Z4A-SEC-01/Z4A-BUGS-01, Z3-SEC-01/Z3-BUGS-02, Z3-BUGS-01/Z3-SEC-02 ; 5 dans ce backlog : Z1-SEC-04/Z1-BUGS-02, Z4A-BUGS-03/T-BP-08, T-SOLID-3/Z3-SEC-05, Z4A-SEC-03/Z2-SEC-07, Z3-BUGS-09/T-BP-05) — chaque fusion conserve les deux IDs et la sévérité maximale. Tri : sévérité décroissante puis effort de correction croissant (Faible < 2 h, Moyen ≤ 1 j, Élevé > 1 j).

### 5.1 Constats Élevée (30 fiches)

#### [Z1-SEC-02] — Connexion STOMP acceptée sans authentification (Élevée — Sécurité — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/config/WebSocketAuthInterceptor.java:41-54 |
| Catégorie | Auth WebSocket contournable |
| Description | Sur la trame CONNECT, en cas de header Authorization absent OU d'échec de jwtDecoder.decode (token expiré/invalide/signature fausse), l'intercepteur se contente de logger un warn/debug et retourne le message tel quel sans lever d'exception ni rejeter la connexion. La session STOMP est donc établie sans Principal. |
| Impact | Une connexion WebSocket non authentifiée (ou avec un JWT invalide) est acceptée. Combinée à l'absence d'autorisation SUBSCRIBE (Z1-SEC-01), cela permet l'abonnement aux topics de diffusion sans aucune authentification. |
| Preuve | `} catch (Exception e) { log.warn("Echec authentification WebSocket STOMP: {}", e.getMessage()); }` |
| Recommandation | Sur CONNECT, rejeter la connexion si le header Authorization est absent/malformé ou si le decode échoue (lever une exception pour interrompre la handshake STOMP), au lieu de laisser passer une session anonyme. |
| Confiance | confirmé |
| Vérification | Confirmé : session établie sans Principal, sans rejet ni exception (bloc CONNECT 39-54, catch 48-50). Même mitigant prod que Z1-SEC-01 (/ws non routé par nginx aujourd'hui). |

#### [Z1-SEC-03] — Config de sécurité permissive sélectionnée par @Profile("!prod") (Élevée — Sécurité — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/config/SecurityConfig.java:45, 133-185 |
| Catégorie | Config dev activable en prod (profil Spring) |
| Description | La chaîne de sécurité permissive (permitAll sur /api/sync/**, /api/managers/**, /api/permissions/**, /api/portfolios/**, /api/property-teams/**, /h2-console/**, swagger, + httpBasic + JwtDecoder sans validation d'issuer) est sélectionnée par @Profile("!prod"), une règle NÉGATIVE. Toute valeur de SPRING_PROFILES_ACTIVE différente de la chaîne exacte « prod » (faute de frappe « production », profil « staging ») active cette config à la place de SecurityConfigProd. |
| Impact | Si le profil prod n'est pas exactement « prod », l'application démarre avec une autorisation quasi ouverte (endpoints admin/sync/permissions en permitAll, console H2, validation d'issuer JWT désactivée). Exposition critique sur une simple erreur de configuration d'environnement. |
| Preuve | `@Profile("!prod")` … `public class SecurityConfig {` |
| Recommandation | Remplacer le matching négatif par un profil positif explicite (@Profile("dev") / liste blanche) ou ajouter un fail-fast au boot si aucun profil de sécurité reconnu n'est actif. |
| Confiance | à vérifier (agent) |
| Vérification | Confirmé par contre-expertise : défaut Spring si SPRING_PROFILES_ACTIVE absent = dev,local → config permissive ; docker-compose.prod.yml fixe bien « prod » aujourd'hui, mais aucun fail-fast — anti-pattern de match négatif réel, defense-in-depth absente. |

#### [Z1-SEC-04 / Z1-BUGS-02] — Rate-limit contournable par spoofing X-Forwarded-For (Élevée — Sécurité — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/config/RateLimitInterceptor.java:170-192 |
| Catégorie | Rate-limit contournable (IP spoofing) |
| Description | getClientIp fait confiance au header X-Forwarded-For dès que le pair direct est en RFC1918 et prend l'élément LE PLUS À GAUCHE (split(",")[0]) — la valeur fournie par le client, puisque nginx AJOUTE l'IP réelle à la fin (proxy_add_x_forwarded_for). De plus isTrustedProxy utilise startsWith("172.") qui couvre aussi 172.32-172.255 (plages publiques), au-delà du /12 privé. |
| Impact | Les protections brute-force par IP deviennent contournables par rotation du XFF : /api/auth/** (30/min), énumération des vouchers (20/min) et surtout des codes d'échange de clés à 6 chiffres (10/min) protégeant l'accès physique aux logements. |
| Preuve | `if (isTrustedProxy(remoteAddr)) { String xForwardedFor = request.getHeader("X-Forwarded-For"); if (xForwardedFor != null && !xForwardedFor.isEmpty()) { return xForwardedFor.split(",")[0].trim();` |
| Recommandation | Prendre l'IP cliente depuis la droite du XFF (sauter les proxies de confiance connus) ou s'appuyer sur X-Real-IP posé par nginx en écrasement ; restreindre isTrustedProxy aux CIDR exacts (172.16.0.0/12, 10/8, 192.168/16). |
| Confiance | à vérifier (agent) |
| Vérification | Confirmé deux fois : nginx prod pose X-Forwarded-For en mode APPEND (nginx.conf.template:246) → premier élément spoofable ; nginx pose aussi X-Real-IP (sûr) mais le code ne s'y rabat que si XFF absent. Atténuation partielle : KeyVerificationThrottle ajoute un lockout par token (key-verify seulement). |

#### [Z1-BUGS-01] — DLQ Kafka jamais alimentée sur échec de consommation (Élevée — Bugs — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/config/KafkaConfig.java:129-132 |
| Catégorie | Fiabilité messaging / perte de données |
| Description | Le commentaire annonce « Retry : 5 tentatives avec 2s d'intervalle, puis DLQ », mais le DefaultErrorHandler est construit sans DeadLetterPublishingRecoverer : le recoverer par défaut logge puis saute le record. Les topics DLQ (airbnb.dlq, expedia.dlq) ne sont alimentés qu'au produce par les webhook services, jamais sur échec de consommation. |
| Impact | Tout message dont le traitement échoue 5 fois (calendar.updates de l'outbox CalendarEngine, notifications.send, payment.events) est définitivement perdu sans trace en DLQ — risque de désynchronisation calendrier et de double réservation. |
| Preuve | `factory.setCommonErrorHandler(new DefaultErrorHandler(new FixedBackOff(2000L, 5)));` |
| Recommandation | Passer un DeadLetterPublishingRecoverer(kafkaTemplate) en premier argument du DefaultErrorHandler pour router les échecs épuisés vers les topics DLQ existants, et aligner le commentaire. |
| Confiance | confirmé |
| Vérification | Confirmé : le recoverer par défaut commit l'offset (skip) ; la factory partagée sert tous les @KafkaListener (ChannelSyncService, notifications, payment.events) → message perdu après 5 échecs, seule trace = log ERROR. |

#### [Z2-EFFETS-01] — ThreadLocal tenant jamais nettoyé dans ICalSyncScheduler (Élevée — Effets de bord — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/scheduler/ICalSyncScheduler.java:87-90, 101-104 |
| Catégorie | Effets de bord / concurrence — pollution ThreadLocal |
| Description | Le scheduler fait tenantContext.setOrganizationId(orgId) par itération, mais son finally n'appelle QUE RequestContextHolder.resetRequestAttributes() — jamais tenantContext.clear(). TenantContext n'est plus @RequestScope : c'est un singleton avec ThreadLocal statique ; le reset est donc un no-op pour ce ThreadLocal. Le commentaire de classe (« beans @RequestScope ») est obsolète. |
| Impact | Le orgId de la dernière org traitée reste collé au thread du pool de scheduling partagé (pool.size=4, réutilisé par tous les @Scheduled). Tout job lisant tenantContext.getOrganizationId() de façon ambiante hériterait silencieusement de ce tenant fuité → fuite cross-tenant. Viole le contrat explicite de TenantContext (« TOUT thread qui set DOIT clear() »). |
| Preuve | `} finally { // Clean up synthetic request scope RequestContextHolder.resetRequestAttributes(); }` |
| Recommandation | Ajouter tenantContext.clear() dans le finally (comme TenantFilter l.91 et AssistantController l.205) ; mettre à jour le commentaire obsolète. |
| Confiance | à vérifier (agent) |
| Vérification | Confirmé : no-op vérifié, contrat violé, commentaires obsolètes. Nuance : pas d'exploitation immédiate prouvée (les autres schedulers passent l'orgId explicitement, le filtre Hibernate n'est actif que côté HTTP), mais la lecture ambiante est un pattern vivant (ICalImportService.getRequiredOrganizationId) → fuite latente réelle. |

#### [Z3-BUGS-08] — Trous de numérotation facture sur rollback (REQUIRES_NEW) (Élevée — Bugs — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/InvoiceNumberingService.java:44-67 |
| Catégorie | Numérotation facture : trous sur rollback |
| Description | generateNextNumber est en Propagation.REQUIRES_NEW : le compteur est incrémenté et commité dans une transaction indépendante. Si la transaction appelante (issueInvoice, cancelInvoice, AutoInvoiceService.generateFor* qui sauvegarde la facture APRÈS avoir obtenu le numéro) rollback ensuite, le numéro est consommé sans facture associée — en contradiction avec la javadoc « Garantit l'absence de trous » et l'exigence séquentielle NF. |
| Impact | Trous dans la numérotation légale des factures en cas d'échec d'émission après attribution du numéro. |
| Preuve | `@Transactional(propagation = Propagation.REQUIRES_NEW) public String generateNextNumber(Long orgId) {` |
| Recommandation | Attribuer le numéro dans la MÊME transaction que l'insertion de la facture (REQUIRED + verrou pessimiste déjà en place via findAndLock) : le rollback annule alors à la fois la facture et l'incrément. |
| Confiance | confirmé |
| Vérification | Confirmé : REQUIRES_NEW aux l.44 et 54, appelants rollbackables identifiés ; REQUIRES_NEW évite les doublons mais pas les trous ; le fix REQUIRED + findAndLock existant est correct. |

#### [Z4A-BUGS-04] — Réservation confirmed + paiement PENDING jamais nettoyée : calendrier bloqué (Élevée — Bugs — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/booking/service/PublicBookingService.java:359-368, 400-402 |
| Catégorie | Cycle de vie réservation / calendrier bloqué |
| Description | Quand autoConfirm=true ET collectPaymentOnBooking=true, reserve() crée la réservation avec status="confirmed", paymentStatus=PENDING et expiresAt=null. La requête de nettoyage findExpiredPendingReservations ne matche que r.status='pending' : une réservation confirmée jamais payée n'est donc jamais annulée et les dates restent BOOKED indéfiniment. |
| Impact | Un guest qui abandonne le paiement après /reserve bloque définitivement le calendrier de la propriété sur ses dates, sans paiement ni nettoyage automatique. |
| Preuve | `if (config.isAutoConfirm()) { reservation.setStatus("confirmed"); }` |
| Recommandation | Inclure dans le cleanup les réservations confirmed+paymentStatus=PENDING issues du booking engine (source='direct') au-delà du délai, ou ne passer en confirmed qu'après confirmation du paiement quand collectPaymentOnBooking=true. |
| Confiance | confirmé |
| Vérification | Confirmé : aucun autre mécanisme trouvé (pas de handler checkout.session.expired, pas d'autre scheduler) ; les dates restent BOOKED jusqu'à annulation manuelle par l'hôte. |

#### [Z4A-BUGS-05] — Réservation payée restant « pending » pour toujours (Élevée — Bugs — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/booking/service/PublicBookingService.java:676-696 |
| Catégorie | Cycle de vie réservation / statut incohérent |
| Description | Pour une réservation existante non payée, confirmBookingEngineCheckout délègue à stripeService.confirmReservationPayment(sessionId), dont la javadoc booking promet « on la passe en CONFIRMED + PAID ». Or confirmReservationPayment ne modifie que paymentStatus=PAID et ne touche jamais reservation.status. Flux standard /reserve (autoConfirm=false) + /checkout + paiement : la réservation payée reste status="pending". |
| Impact | Le guest voit « pending » sur sa page de confirmation après avoir payé ; côté PMS la réservation payée apparaît toujours en attente et exige une confirmation manuelle non documentée. |
| Preuve | `// Reservation existante mais pas encore PAID → on la confirme via le flux existant stripeService.confirmReservationPayment(sessionId);` |
| Recommandation | Dans confirmReservationPayment (ou juste après l'appel côté booking), passer status à "confirmed" quand le statut courant est "pending" et que le paiement est validé. |
| Confiance | confirmé |
| Vérification | Confirmé : confirmReservationPayment (StripeService l.559-565) ne modifie que paymentStatus + paidAt ; getConfirmation renvoie le status « pending » au guest. N'affecte pas le cas autoConfirm=true. |

#### [T-BP-01] — PII (email propriétaire, nom signataire) dans les logs de signature (Élevée — Bonnes pratiques — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/signature/ContractSignatureService.java:166 (et 383) |
| Catégorie | PII dans les logs |
| Description | L'adresse email du propriétaire est loggée en clair à chaque envoi de lien de signature (log.info l.166). Le nom complet du signataire est aussi loggé à la signature (l.383). Ces PII partent dans les logs applicatifs à chaque création/renvoi de lien et à chaque signature. |
| Impact | Fuite de données personnelles (email, identité) dans les logs centralisés, non couverts par les politiques RGPD de rétention/effacement. |
| Preuve | `log.info("Lien de signature envoyé à {} pour le contrat {}", ownerEmail, contract.getContractNumber());` |
| Recommandation | Logger l'ownerId ou un email masqué (m***@domain) ; remplacer signerName par l'id de la demande de signature. |
| Confiance | confirmé |
| Vérification | Confirmé : lignes exactes, aucun filtre PII dans logback-spring.xml, logs prod en JSON centralisés (Loki/ELK). Nuance : sévérité Moyenne défendable (pas de secret d'accès) ; correctif trivial. |

#### [T-BP-02] — URL de feed iCal avec token secret loggée en ERROR (Élevée — Bonnes pratiques — effort Faible)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/ICalImportService.java:587 |
| Catégorie | Secrets dans les logs |
| Description | En cas d'échec de téléchargement, l'URL complète du feed iCal est loggée en ERROR. Les URLs iCal des OTA contiennent un token secret (ex. Airbnb ?s=…) qui donne accès au calendrier complet du logement. Chaque erreur réseau/timeout (récurrente via le scheduler) écrit ce secret dans les logs. |
| Impact | Exfiltration possible des tokens de feed iCal (accès aux calendriers/réservations) par toute personne ayant accès aux logs. |
| Preuve | `log.error("Erreur telechargement iCal depuis {}: {}", url, e.getMessage());` |
| Recommandation | Logger l'id du feed ou l'URL tronquée (host + path sans query string) au lieu de l'URL brute. |
| Confiance | confirmé |
| Vérification | Confirmé : récurrence via le scheduler vérifiée (chaque feed en erreur réécrit son URL token compris à chaque passage) ; la fuite est circonscrite aux logs (lastSyncError ne contient que e.getMessage()). Sévérité Élevée justifiée (secret réutilisable, écrit de façon récurrente). |

#### [Z3-BUGS-04] — TVA ajoutée sur un montant déjà TTC : factures auto fausses (Élevée — Bugs — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/InvoiceGeneratorService.java:368-388 |
| Catégorie | Calcul de taxes (HT/TTC inversés) |
| Description | generateFromReservation passe reservation.getTotalPrice()/getRoomRevenue() (montant encaissé auprès du guest) comme amount de TaxableItem. Les calculateurs pays (FranceTaxCalculator l.51-53) traitent ce montant comme du HT et AJOUTENT la TVA par-dessus. AutoInvoiceService marque ensuite cette facture PAID. |
| Impact | La facture auto-générée affiche un totalTTC = montant payé + 10/20 % de TVA, supérieur à ce que le guest a réellement payé via Stripe — facture fiscalement fausse. |
| Preuve | `BigDecimal amountHT = MoneyUtils.round(item.amount()); BigDecimal taxAmount = MoneyUtils.calculateTaxAmount(amountHT, rule.getTaxRate()); BigDecimal amountTTC = MoneyUtils.round(amountHT.add(taxAmount));` |
| Recommandation | Pour les factures guest, décomposer le montant TTC encaissé via MoneyUtils.calculateHT (déjà existant, non utilisé) : HT = totalPrice / (1 + taux), TVA = TTC − HT, afin que totalTtc == montant payé. |
| Confiance | confirmé |
| Vérification | Confirmé : chaîne complète vérifiée (montant encaissé → traité en HT → facture PAID) ; MoneyUtils.calculateHT existe et n'est appelé nulle part (grep : seule la définition). |

#### [Z3-BUGS-05] — Devise ledger = config globale, pas la devise réellement chargée (Élevée — Bugs — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/StripeService.java:345, 391 |
| Catégorie | Devise incohérente charge vs ledger |
| Description | La session Stripe est créée dans la devise résolue de la propriété/réservation, mais ensureWalletsAndRecordPayment/ForReservation créent les wallets et les écritures ledger dans la devise de CONFIG stripe.currency (fallback EUR), sans conversion. |
| Impact | Un paiement de 1 000 MAD est enregistré comme 1 000 EUR dans les wallets/ledger : soldes et splits faux pour toute org hors devise de config. |
| Preuve | `String curr = (currency != null && !currency.isBlank()) ? currency.toUpperCase() : "EUR"; Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, curr);` |
| Recommandation | Propager la devise réellement chargée (celle de la session Stripe / de la réservation) jusqu'à ensureWalletsAndRecordPayment* au lieu de relire la config globale. |
| Confiance | confirmé |
| Vérification | Confirmé : stripe.currency fixé « eur » dans application-prod.yml l.123 ; wallets, recordTransfer et split utilisent tous ce « curr » de config. |

#### [Z3-BUGS-06] — Remboursement : effet externe au milieu de la transaction, pas d'écriture ledger inverse (Élevée — Bugs — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/StripeService.java:756-787 |
| Catégorie | Remboursement : transaction mal délimitée, état incohérent |
| Description | refundPayment (classe @Transactional) appelle Refund.create (effet externe irréversible) AU MILIEU de la transaction DB : si le save/commit échoue ensuite, le remboursement Stripe est parti mais le statut reste PAID (un nouvel appel re-rembourse, aucune idempotency key). De plus, aucune écriture ledger inverse n'est créée : les crédits ESCROW→PLATFORM et le split restent en place après remboursement. Seul le remboursement total est supporté. |
| Impact | État bloqué PAID après refund parti, et soldes wallets surévalués après tout remboursement. |
| Preuve | `Refund.create(refundParams); // Mettre a jour le statut intervention.setPaymentStatus(PaymentStatus.REFUNDED);` |
| Recommandation | Passer le statut en REFUND_PENDING et commiter AVANT l'appel Stripe (ou idempotency key dérivée de l'intervention) ; enregistrer les écritures ledger inverses (PLATFORM→ESCROW + annulation du split) à la confirmation du refund. |
| Confiance | confirmé |
| Vérification | Confirmé avec correction d'impact : pas de double sortie d'argent en pratique (Stripe rejette un second refund total du même PaymentIntent) ; le risque réel est l'incohérence ledger systématique + l'état bloqué — sévérité Élevée justifiée. |

#### [Z4A-SEC-02] — SSRF par DNS rebinding sur le preview proxy public (Élevée — Sécurité — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/booking/controller/SitePreviewProxyController.java:342-344 |
| Catégorie | SSRF (DNS rebinding / TOCTOU) |
| Description | ICalUrlValidator.validateAndResolve retourne l'InetAddress résolue précisément pour que l'appelant épingle l'IP (javadoc : « The caller MUST use this resolved address »). validateUrl() ignore la valeur de retour, puis restTemplate.exchange(URI.create(url), …) re-résout le DNS indépendamment. Endpoint public non authentifié (/api/public/preview-proxy/**, permitAll, hors BookingApiKeyFilter). Affecte proxySite, proxyPage et proxyAsset. |
| Impact | Un attaquant héberge un domaine qui résout vers une IP publique à la validation puis vers une IP interne (169.254.169.254, 10.x…) lors du fetch, atteignant les metadata cloud et services internes via un endpoint totalement anonyme. |
| Preuve | `private void validateUrl(String url) { ICalUrlValidator.validateAndResolve(url); }` |
| Recommandation | Épingler l'IP retournée par validateAndResolve (connexion à l'InetAddress validée + Host/SNI) ou re-valider l'IP juste avant connexion et interdire les redirections. Appliquer le même correctif à WebsiteFetchService (Jsoup re-résout aussi le DNS). |
| Confiance | confirmé |
| Vérification | Confirmé : aggravant, le RestTemplate est un `new RestTemplate()` nu (factory par défaut qui suit les redirections). |

#### [Z5-BUGS-02] — Boucle de rétroaction yield : dérive géométrique des prix (Élevée — Bugs — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/AdvancedRateManager.java:286-293, 302-311, 327-343 |
| Catégorie | Boucle de rétroaction pricing (dérive composée) |
| Description | applyYieldRules (scheduler horaire) lit le prix courant via priceEngine.resolvePrice, qui retourne en priorité max le RateOverride — y compris celui écrit par la règle de yield au run précédent (source YIELD_RULE, non exclue). L'ajustement (% ou montant) est donc ré-appliqué à chaque exécution sur le résultat du run précédent. |
| Impact | Dérive géométrique du prix (ex. −10 %/heure) jusqu'au clamp min/max — et minPrice/maxPrice sont nullables : sans clamp, le prix s'effondre ou explose. Écrase aussi les overrides EXTERNAL_PRICING (PriceLabs). |
| Preuve | `BigDecimal currentPrice = priceEngine.resolvePrice(property.getId(), targetDate, orgId); ... BigDecimal adjustedPrice = applyYieldAdjustment(currentPrice, rule);` |
| Recommandation | Calculer l'ajustement à partir du prix de base hors overrides YIELD_RULE, ou stocker le prix de référence dans l'override et appliquer l'ajustement de façon idempotente. |
| Confiance | confirmé |
| Vérification | Confirmé. Nuance d'exposition : YieldManagementScheduler est conditionné à clenzy.yield.scheduler.enabled=true, propriété définie nulle part → scheduler INACTIF par défaut ; le bug reste déclenchable via POST /yield-rules/evaluate/{propertyId}. Bombe à retardement dès activation du flag. |

#### [Z5-BUGS-03] — Prix channel calculés puis jetés : markups jamais poussés aux OTA (Élevée — Bugs — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/RateDistributionService.java:149-154 |
| Catégorie | Prix channel jamais distribués (calcul jeté) |
| Description | distributeToChannel calcule channelPrices via advancedRateManager.resolveChannelPriceRange (application des ChannelRateModifier) puis n'utilise jamais ce résultat : il appelle connector.pushCalendarUpdate(propertyId, from, to, orgId), et les adapters (Airbnb l.160, Booking l.144) re-résolvent les prix via priceEngine.resolvePriceRange — prix de base, sans les modificateurs channel. |
| Impact | Les markups/markdowns par channel ne sont jamais poussés aux OTA : Airbnb reçoit le prix de base au lieu du prix channel — la feature de tarifs dérivés par channel est silencieusement inopérante. |
| Preuve | `Map<LocalDate, BigDecimal> channelPrices = advancedRateManager.resolveChannelPriceRange(propertyId, from, to, channelName, orgId); SyncResult result = connector.pushCalendarUpdate(propertyId, from, to, orgId);` |
| Recommandation | Passer les prix résolus au connector (surcharge pushCalendarUpdate(prices)) ou faire résoudre le prix channel-specific dans l'adapter via AdvancedRateManager. |
| Confiance | confirmé |
| Vérification | Confirmé : variable locale jamais lue (dead store), signature ChannelConnector.pushCalendarUpdate sans paramètre prix, aucun adapter n'injecte AdvancedRateManager ; les autres appelants (ChannelSyncService, PricingPushScheduler, ReconciliationService) souffrent du même contournement. |

#### [Z5-BUGS-04] — Prix manuel du calendrier jamais facturé et silencieusement écrasé (Élevée — Bugs — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/CalendarEngine.java:120, 128-133, 343-347 |
| Catégorie | Deux sources de prix divergentes / prix manuel écrasé |
| Description | updatePrice écrit calendar_days.nightly_price (CalendarController:210), mais PriceEngine ne lit jamais calendar_days : les devis du booking engine (PublicBookingService:207) et le push OTA (AirbnbChannelAdapter:160) utilisent uniquement RateOverride/RatePlan/Property.nightlyPrice. De plus, book() écrase le nightly_price du jour avec la résolution PriceEngine dès qu'elle est non nulle. |
| Impact | Un prix fixé manuellement sur le calendrier n'est jamais facturé au guest ni poussé aux OTA, et il est silencieusement écrasé à la première réservation — le PMS affiche un prix, le guest en paie un autre. |
| Preuve | `BigDecimal resolvedPrice = priceMap.get(day.getDate()); if (resolvedPrice != null) { day.setNightlyPrice(resolvedPrice);` |
| Recommandation | Faire de updatePrice un écrivain de RateOverride (source MANUAL) pour que PriceEngine le voie, ou intégrer calendar_days.nightly_price comme niveau prioritaire de la cascade ; ne pas écraser un prix manuel existant dans book(). |
| Confiance | confirmé |
| Vérification | Confirmé sur les trois branches ; le fallback Property.nightlyPrice rend l'écrasement quasi systématique. Incohérence d'affichage avérée (/pricing affiche PriceEngine, d'autres vues exposent nightly_price) ; les adapters OTA inbound écrivent aussi dans ce champ mort. |

#### [Z5-BUGS-05] — LAST_MINUTE / EARLY_BIRD sans condition de délai : prix bradé hors intention (Élevée — Bugs — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/PriceEngine.java:64-72, 103-111 (+ model/RatePlan.java:98-107) |
| Catégorie | Sémantique LAST_MINUTE/EARLY_BIRD non implémentée |
| Description | LAST_MINUTE (« booking proche check-in ») et EARLY_BIRD (« réservation X jours à l'avance ») sont dans TYPE_PRIORITY mais résolus uniquement via RatePlan.appliesTo(date), qui ne vérifie que isActive + [startDate,endDate] + jour de semaine. Aucune condition de délai entre la date de réservation et le check-in (ni champ lead-time sur l'entité, ni paramètre de date de booking dans resolvePrice). |
| Impact | Un plan LAST_MINUTE (typiquement un prix bradé) sans bornes de dates s'applique à TOUTES les dates, même réservées 6 mois à l'avance — tarif réduit appliqué hors de son intention métier. |
| Preuve | `public boolean appliesTo(LocalDate date) { if (!Boolean.TRUE.equals(isActive)) return false; if (startDate != null && date.isBefore(startDate)) return false;` |
| Recommandation | Ajouter un critère de lead time (minLeadDays/maxLeadDays) sur RatePlan, évalué par PriceEngine avec la date de réservation en paramètre ; à défaut, retirer ces types de TYPE_PRIORITY. |
| Confiance | confirmé |
| Vérification | Confirmé : entité RatePlan relue intégralement (aucun champ lead-time), grep leadDays/bookingDate = 0 ; la javadoc même du moteur contredit l'implémentation. À distinguer du yield LAST_MINUTE_FILL qui, lui, a une vraie sémantique temporelle. |

#### [Z6-SECBUGS-01] — SSRF par DNS rebinding sur l'import iCal (Élevée — Sécurité — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/ICalImportService.java:581, 584, 597-608 |
| Catégorie | SSRF / DNS rebinding (TOCTOU) |
| Description | fetchAndParseICalFeed appelle ICalUrlValidator.validateAndResolve(url) mais JETTE l'InetAddress retournée, puis downloadICalContent(url) reconstruit l'URI brute et httpClient.send re-résout le DNS. Aucun pinning sur l'IP validée, malgré le contrat explicite du validateur. |
| Impact | Un attaquant maîtrisant le DNS d'un hôte (TTL court) fait pointer evil.com vers une IP publique à la validation puis vers 127.0.0.1 / 169.254.169.254 / RFC1918 à la requête → lecture de metadata cloud ou de services internes. Les blocages statiques (blockLocalHosts/blockCloudMetadata) ne couvrent que des chaînes littérales. |
| Preuve | `ICalUrlValidator.validateAndResolve(url);` … `InputStream limitedStream = downloadICalContent(url); HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());` |
| Recommandation | Utiliser l'InetAddress retournée : connexion sur l'IP épinglée (resolver custom / connexion par IP + header Host + SNI), ou re-valider l'IP effectivement connectée. Ne pas re-résoudre l'hôte à la requête. |
| Confiance | confirmé |
| Vérification | Confirmé : httpClient construit sans resolver custom ; followRedirects(NEVER) bloque le bypass par redirection mais pas le rebinding ; URL fournie par l'utilisateur HOST/MANAGER à l'import. Lignes exactes. |

#### [Z6-SECBUGS-02] — Resync iCal : annulation en cascade jusqu'à 50 % des réservations futures, sans réactivation (Élevée — Bugs — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/ICalImportService.java:391-427, 244-253 |
| Catégorie | Perte de réservations / overbooking à la resync |
| Description | La détection d'orphelins n'avorte que si plus de 50 % des réservations futures actives disparaissent. Un feed momentanément partiel mais valide faisant disparaître jusqu'à 50 % des UID entraîne cancelReservationWithCascade : statut cancelled, paiement annulé, calendrier libéré (→ outbox → sync sortante vers les autres channels), interventions et factures DRAFT annulées. À la resync suivante, l'UID réapparaît mais l'existant (status=cancelled) tombe dans la branche else → skipped : la réservation n'est JAMAIS réactivée. |
| Impact | Jusqu'à 50 % des réservations futures d'un feed peuvent être annulées de façon permanente sur un feed transitoirement incomplet, avec ré-ouverture des dates à la vente sur les autres canaux → overbooking. Aucune auto-récupération. |
| Preuve | `if (!futureActive.isEmpty() && orphans.size() * 2 > futureActive.size()) { ... for (Reservation orphan : orphans) { cancelReservationWithCascade(orphan, orgId); cancelled++; }` |
| Recommandation | Durcir le seuil (avorter dès qu'un orphelin futur CONFIRMED/payé disparaît, exiger N syncs consécutives, ou soft-cancel avec re-vérification) ; surtout, prévoir une réactivation quand un UID annulé réapparaît au lieu de le skipper définitivement. |
| Confiance | confirmé |
| Vérification | Confirmé : cascade vérifiée intégralement (calendarEngine.cancel publie CALENDAR_CANCELLED dans l'outbox), aucun chemin ne repasse cancelled→confirmed ; garde-fous existants (feedUids non vide, futures only, scope par feed) reconnus mais insuffisants. Lignes exactes. |

#### [Z7-SEC-01] — Injection HTML stockée dans les templates email, modifiables par tout rôle org (Élevée — Sécurité — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/controller/SystemEmailTemplateController.java:45, 90-99 (sink : EmailWrapperService.java:93-135, isHtmlBlock 195-202 ; EmailService.java:238-239) |
| Catégorie | Stored XSS / injection HTML cross-user dans les emails |
| Description | Tout utilisateur AUTHENTIFIÉ (HOST, TECHNICIAN, HOUSEKEEPER…) peut créer un override per-org du body d'un template email système via PUT /api/system-email-templates/{key}/{language} : @PreAuthorize("isAuthenticated()") au niveau classe, aucune restriction de rôle. Le body (max 100 KB) est stocké sans sanitation HTML ; interpolate n'échappe que les variables, jamais le texte littéral, et isHtmlBlock préserve verbatim les blocs HTML. |
| Impact | Un utilisateur org peu privilégié injecte du HTML/liens arbitraires (phishing, contenu masqué, attribut onerror) dans les emails reçus par des tiers (owners, guests) de son organisation. |
| Preuve | `@PreAuthorize("isAuthenticated()")  // classe` … `SystemEmailTemplate saved = templateService.upsertOverride(orgId, key, language, request.subject(), request.body());` |
| Recommandation | Restreindre upsertOverride aux rôles admin (hasAnyRole SUPER_ADMIN/ADMIN/HOST) ET sanitiser le body côté serveur (whitelist HTML ou échappement systématique du texte littéral). |
| Confiance | confirmé |
| Vérification | Confirmé avec portée précisée : les templates invitation/contrat/devis sont résolus avec organizationId=null → l'override per-org ne s'y applique JAMAIS ; les seuls flux consommant l'override d'org sont les alertes bruit (noise_alert_owner/guest, envoyées au propriétaire et au voyageur). Injection HTML cross-user réelle mais limitée aux orgs avec alertes bruit actives ; les clients mail neutralisent généralement le JS — impact pratique = phishing/HTML plutôt que XSS exécutable. Le défaut d'autorisation (tout rôle org réécrit les templates) reste entier. |

#### [T-ARCH-02] — ReservationController.update : orchestration multi-écritures sans transaction (Élevée — Architecture — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/controller/ReservationController.java:230-309 |
| Catégorie | Logique métier dans controller + écritures non atomiques |
| Description | ReservationController.update orchestre dans le controller, SANS @Transactional (seuls DocumentController et WalletController en ont un) : création/liaison de Guest (l.245-255), re-planification de l'intervention liée avec interventionRepository.save (l.265-280), puis reservationRepository.save (l.282), puis révocation/régénération des codes serrure (l.288-300). |
| Impact | Chaque save est une transaction séparée : un échec entre l.279 et l.282 laisse l'intervention décalée sur une réservation aux anciennes dates (état incohérent non rollbackable). |
| Preuve | `interventionRepository.save(intervention); } Reservation saved = reservationRepository.save(existing);` |
| Recommandation | Extraire l'orchestration dans une méthode ReservationService.update(…) annotée @Transactional ; le controller ne garde que validation d'accès + mapping DTO. |
| Confiance | confirmé |
| Vérification | Confirmé : aucun @Transactional, lignes exactes ; avec open-in-view=false chaque save() ouvre sa propre transaction — l'état incohérent décrit est réel. |

#### [T-ARCH-03] — Backfill comptable dans WalletController + findAll() toutes orgs filtré en mémoire (Élevée — Architecture — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/controller/WalletController.java:86-167 |
| Catégorie | Logique financière dans controller + full scan filtré en mémoire |
| Description | WalletController.initializeWallets contient toute la logique de backfill du ledger (3 boucles interventions/réservations/service requests, transferts escrow→platform) directement dans le controller avec @Transactional (l.88). La 3e boucle itère serviceRequestRepository.findAll() et filtre l'organizationId en mémoire malgré le commentaire « Use a query that gets paid SRs ». |
| Impact | Logique comptable critique non testable hors HTTP ; findAll() charge toutes les service requests dans une transaction longue. |
| Preuve | `for (ServiceRequest sr : serviceRequestRepository.findAll()) { if (sr.getOrganizationId() != null && sr.getOrganizationId().equals(orgId) && sr.getPaymentStatus() == PaymentStatus.PAID) {` |
| Recommandation | Déplacer le backfill dans WalletService/LedgerService et ajouter une derived query findByOrganizationIdAndPaymentStatus au lieu de findAll(). |
| Confiance | confirmé |
| Vérification | Confirmé avec circonstance aggravante : l'endpoint est réservé SUPER_ADMIN/SUPER_MANAGER, or pour ces rôles TenantFilter désactive le @Filter Hibernate → findAll() charge réellement les SR de TOUTES les orgs. |

#### [T-ARCH-04] — Duplication divergente de la résolution de prix dans le controller (Élevée — Architecture — effort Moyen)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/controller/CalendarController.java:279-292 |
| Catégorie | Duplication divergente du PriceEngine |
| Description | resolvePriceSource ré-implémente dans le controller l'algorithme de résolution de prix (« même algorithme que PriceEngine ») mais avec seulement 4 types (PROMOTIONAL, SEASONAL, LAST_MINUTE, BASE) alors que PriceEngine.TYPE_PRIORITY en compte 7 (PROMOTIONAL, EVENT, WEEKEND, SEASONAL, EARLY_BIRD, LAST_MINUTE, BASE). La duplication a déjà divergé. |
| Impact | Le champ priceSource renvoyé par GET /api/calendar/{id}/pricing est faux dès qu'un plan EVENT, WEEKEND ou EARLY_BIRD s'applique. |
| Preuve | `for (RatePlanType type : List.of(RatePlanType.PROMOTIONAL, RatePlanType.SEASONAL, RatePlanType.LAST_MINUTE, RatePlanType.BASE)) {` |
| Recommandation | Exposer la source du prix depuis PriceEngine (resolvePriceRange retournant prix + source) et supprimer resolvePriceSource du controller. |
| Confiance | confirmé |
| Vérification | Confirmé : la javadoc PriceEngine montre que EVENT/WEEKEND/EARLY_BIRD ont été ajoutés en « Phase 5 OTA pricing » après la copie ; le prix est calculé avec 7 types mais étiqueté avec 4. |

#### [Z3-BUGS-07] — Deux séquences de numérotation de factures, doublons possibles (Élevée — Bugs — effort Élevé)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/InvoiceGeneratorService.java:681-716 |
| Catégorie | Numérotation facture : double séquence, doublons possibles |
| Description | Deux flux concurrents numérotent les Invoice du même org pour le même paiement : (1) event Kafka FACTURE → createIssuedFromDocumentGeneration avec DocumentNumberingService (séquence document_number_sequences) ; (2) autoInvoiceService.generateFor* via InvoiceNumberingService (séquence invoice_number_sequences, préfixe « FA » en dur). Les deux compteurs avancent indépendamment et invoices.invoice_number n'a aucune contrainte unique. Les checks d'idempotence sont du check-then-insert non protégé entre le consumer Kafka et le webhook. |
| Impact | Numéros de facture dupliqués ou non séquentiels entre les deux flux (non-conformité NF), et possibilité de deux factures pour la même référence en cas de course Kafka/webhook. |
| Preuve | `invoice.setInvoiceNumber(invoiceNumber); invoice.setStatus(InvoiceStatus.ISSUED); invoice.setDocumentGenerationId(documentGenerationId);` |
| Recommandation | Unifier sur UNE seule séquence de numérotation ; ajouter une contrainte unique (organization_id, invoice_number) et une contrainte unique partielle sur (reservation_id, invoice_type) / intervention_id pour fermer la course. |
| Confiance | confirmé |
| Vérification | Confirmé : double numérotation réelle, check-then-insert des deux côtés ; l'archive Flyway V81 contenait UNIQUE(organization_id, invoice_number) mais elle est morte — vérifié en base dev : invoices n'a que PK + CHECK status, aucune contrainte unique. |

#### [Z4A-BUGS-03 / T-BP-08] — Conflit détecté APRÈS paiement : réservation créée en « mode DÉGRADÉ » sans alerte (Élevée — Bugs — effort Élevé)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/booking/service/PublicBookingService.java:730-736, 785-793 |
| Catégorie | Concurrence / double-booking ; dégradation silencieuse |
| Description | Dans confirmBookingEngineCheckout (flux Embedded Checkout sans réservation préalable : aucune retenue des dates entre create-session et le paiement), si un conflit est détecté après paiement, la réservation est quand même créée en CONFIRMED+PAID (« mode DEGRADE ») et l'échec de calendarEngine.book est avalé par un try/catch. Aucune notification admin n'est émise (contrairement aux autres chemins de paiement) — l'« intervention manuelle requise » du log ne sera jamais déclenchée. |
| Impact | Double-booking effectif en base (deux réservations confirmées et payées sur le même créneau), détectable uniquement via les logs d'erreur — aucune notification ni statut d'anomalie. |
| Preuve | `log.error("Booking Engine: CONFLIT detection apres paiement reussi - session {}, property {}, " + "dates {} → {}, violations: {}. Reservation creee en mode DEGRADE...",` |
| Recommandation | Créer une réservation/hold PENDING dès create-session (comme le flux /reserve) avec expiration de session Stripe courte ; en cas de conflit post-paiement, créer la réservation dans un statut dédié (CONFLICT) et notifier l'hôte via NotificationService au lieu d'un log.error. |
| Confiance | confirmé |
| Vérification | Confirmé deux fois : la fenêtre de course create-session→paiement est réelle (aucun hold préalable), l'échec de book est avalé, aucune notification dans les deux branches. |

#### [T-ARCH-01] — 72 controllers injectent des repositories : couche service contournée (Élevée — Architecture — effort Élevé)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/controller/ReservationController.java:8-14, 60-73 |
| Catégorie | Architecture en couches — contournement de la couche service |
| Description | Injection massive de repositories dans les controllers : 56/150 controllers de controller/ importent com.clenzy.repository.*, plus 5 dans booking/controller et 11 dans integration/**/controller (72 au total). Pires cas : ReservationController (7 repos, 16 dépendances constructeur), PaymentController (5), CalendarController (5), CheckInInstructionsController (4), WalletController (3). |
| Impact | La logique d'accès aux données et les invariants métier sont éparpillés dans la couche présentation, non réutilisables et non transactionnels. |
| Preuve | `private final ReservationRepository reservationRepository; private final InterventionRepository interventionRepository; private final PropertyRepository propertyRepository;` |
| Recommandation | Règle d'architecture (ArchUnit) interdisant controller→repository ; déplacer les accès dans les services existants en commençant par les 5 pires controllers. |
| Confiance | confirmé |
| Vérification | Confirmé : tous les chiffres re-vérifiés par grep (72 controllers, 37 % du total) ; aucune règle ArchUnit dans le repo. |

#### [T-SOLID-1] — DocumentGeneratorService : god class de 1 077 lignes à 27 dépendances (Élevée — SOLID & Design — effort Élevé)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/DocumentGeneratorService.java:76-108, 634-808, 891-1078 |
| Catégorie | God class / SRP |
| Description | DocumentGeneratorService (1 077 l.) injecte ~27 dépendances (6 repositories métier, stockage, parsing, conversion LibreOffice, EmailService, NotificationService, KafkaTemplate, numérotation, compliance, facturation, métriques, EntityManager). Il cumule CRUD des templates, pipeline de génération (executeGeneration, 175 l.), remplissage, envoi email et métriques. |
| Impact | Toute évolution (nouveau type de document, nouveau canal de diffusion) passe par cette classe ; tests unitaires quasi impossibles sans mocker 27 collaborateurs. |
| Preuve | `private final EmailService emailService; private final NotificationService notificationService; private final KafkaTemplate<String, Object> kafkaTemplate;` |
| Recommandation | Extraire 3 classes : TemplateManagementService (CRUD), DocumentGenerationPipeline (executeGeneration + métriques) et DocumentDispatchService (email + notifications). Le contexte de tags rejoint la stratégie T-SOLID-5. |
| Confiance | confirmé |
| Vérification | Confirmé avec corrections : 27 paramètres constructeur (pas 28) ; fillTemplate ne fait que 27 l. (la plage 891-1078 couvre aussi l'envoi email) ; kafkaTemplate est injecté mais JAMAIS utilisé — dépendance morte à supprimer, pas à extraire. |

#### [T-SOLID-2] — importICalFeed : 339 lignes, 6 sous-flux dans une seule transaction (Élevée — SOLID & Design — effort Élevé)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/ICalImportService.java:51-67, 101-104, 152-490 |
| Catégorie | Long Method / SRP |
| Description | importICalFeed fait 339 lignes dans une seule @Transactional : contrôle forfait, ownership, détection doublons, fetch+parse du feed, upsert du feed, boucle de création réservations/interventions, gestion annulations, hooks afterCommit (auto-assign + facturation OTA). La classe injecte 17 dépendances, dont un champ nommé reservationRepository2, et construit son HttpClient dans le constructeur. |
| Impact | Méthode quasi intestable et fragile : chaque correctif (cf. les rustines UnexpectedRollbackException l.211-217) risque de casser un autre des 6 sous-flux. |
| Preuve | `@Transactional public ImportResponse importICalFeed(ImportRequest request, String keycloakId) {` |
| Recommandation | Découper en étapes nommées : ICalImportGuard, ICalFeedUpserter, ReservationImporter, AfterCommitDispatcher. Renommer reservationRepository2 et exposer le HttpClient comme bean configuré. |
| Confiance | confirmé |
| Vérification | Confirmé : tout exact (16 dépendances injectées + HttpClient auto-construit = 17 champs) ; les hooks afterCommit sont déjà des rustines anti-rollback qui confirment la fragilité. |

#### [T-SOLID-3 / Z3-SEC-05] — État global Stripe.apiKey muté dans ~13 classes (Élevée — SOLID & Design — effort Élevé)

| Champ | Contenu |
|---|---|
| Fichier:lignes | server/src/main/java/com/clenzy/service/StripeService.java:99, 156, 211, 260, 303, 758, 842, 914 (+ InscriptionService.java:181) |
| Catégorie | DIP / état global mutable (thread-safety SDK) |
| Description | Le SDK Stripe est utilisé via son état statique global : Stripe.apiKey = stripeSecretKey est réassigné 8 fois dans StripeService et aussi dans InscriptionService ; la logique métier dépend des appels statiques Session.create/retrieve, Refund.create. Le pattern se répète dans ~10 autres classes (StripeWebhookController, ReservationController, ServiceRequestController, PaymentController, DeferredPaymentService, StripeConnectService, MobilePaymentService, ShopService, SubscriptionService). |
| Impact | Couplage fort au SDK (aucune interface mockable) ; impossible de supporter plusieurs comptes Stripe (Connect multi-clé) sans race condition sur l'état statique JVM-wide. Risque de fuite de clé entre threads/tenants si des clés per-tenant sont introduites. |
| Preuve | `// Initialiser Stripe avec la clé secrète Stripe.apiKey = stripeSecretKey;` |
| Recommandation | Introduire une interface StripePaymentGateway (createSession, retrieveSession, refund) implémentée avec com.stripe.StripeClient instancié une fois avec la clé, injectée partout ; supprimer toutes les mutations de Stripe.apiKey (couvrir les ~13 classes). |
| Confiance | confirmé |
| Vérification | Confirmé et même SOUS-ESTIMÉ (~13 classes au total). Nuance : toutes lisent la même propriété ${stripe.secret-key}, donc aucune race effective aujourd'hui — le risque est prospectif (2e clé / Connect multi-comptes) ; le couplage DIP reste réel. |

### 5.2 Constats Moyenne (50 entrées, format compact)

Chemins abrégés : `…/` = `server/src/main/java/com/clenzy/`. Tri par effort croissant. Vérification de contre-expertise : non requise pour les sévérités Moyenne/Faible (la colonne Confiance reflète l'auto-évaluation de l'agent).

| ID | Sévérité | Fichier:lignes | Catégorie | Description courte | Effort | Confiance |
|---|---|---|---|---|---|---|
| Z1-SEC-05 | Moyenne | …/config/WebSocketConfig.java:38-44 | CORS WebSocket permissif | Endpoints STOMP en setAllowedOriginPatterns("*") : handshake WS depuis toute origine | Faible | confirmé |
| Z1-SEC-06 | Moyenne | …/config/KeycloakConfig.java:20-27 | Secrets / credentials par défaut | Fallback admin/admin codé en dur pour le client admin Keycloak ; log.warn au lieu de fail-fast | Faible | à vérifier |
| Z2-SEC-04 | Moyenne | …/tenant/TenantFilter.java:182-185 | Fail-open multi-tenancy | resolveTenant catch toute exception et laisse passer la requête sans filtre Hibernate actif | Faible | à vérifier |
| Z2-SEC-05 | Moyenne | …/tenant/TenantFilter.java:192-212 | Fallback org implicite | Utilisateur sans org rattachée assigné silencieusement à l'unique organisation existante | Faible | confirmé |
| Z3-SEC-03 | Moyenne | …/payment/provider/PayPalPaymentProvider.java:261-279 | Vérification webhook insuffisante | verifyWebhook « soft » retourne true sans vérification cryptographique (piège hors chemin actif) | Faible | confirmé |
| Z3-SEC-04 | Moyenne | …/controller/PayPalReturnController.java:72-75 | Scan cross-tenant / DoS | findAll().stream() sur toutes les PaymentTransaction pour résoudre un providerTxId | Faible | confirmé |
| Z4A-SEC-03 / Z2-SEC-07 | Moyenne | …/booking/controller/SitePreviewProxyController.java:33-44, 363-370 (et 85-214) | Open proxy non authentifié | Reverse proxy public sans auth ni rate-limit ; retire X-Frame-Options et force frame-ancestors * (SSRF mitigé par ICalUrlValidator, cf. Z4A-SEC-02) | Faible | confirmé |
| Z4A-SEC-04 | Moyenne | …/booking/security/BookingApiKeyFilter.java:115-130 | Contrôle d'origine trop permissif | allowedOrigins vide = toute origine acceptée, alors que la clé booking est visible côté client | Faible | à vérifier |
| Z4B-SECBUGS-01 | Moyenne | …/controller/PublicContractSignatureController.java:115-124 | Preuve de signature falsifiable | IP du certificat eIDAS lue depuis X-Forwarded-For contrôlé par le client (sans gate trusted-proxy) | Faible | confirmé |
| Z4B-SECBUGS-02 | Moyenne | …/service/WelcomeGuideService.java:413-425 | Bypass règle métier (code d'accès) | Photos d'accès et instructions d'arrivée servies pendant la fenêtre lead, avant l'heure de check-in | Faible | à vérifier |
| Z1-SEC-FRONTAUX-03 | Moyenne | client/src/main.tsx:87-108 | Fuite vers un tiers (session replay) | PostHog session recording sans masquage du texte rendu (PII guests, codes d'accès logement) | Faible | à vérifier |
| Z7-SEC-02 | Moyenne | …/service/EmailService.java:698-722 | Injection HTML email prospect | customBody de l'éditeur « Renvoyer » passé brut au wrapper, sans interpolation ni échappement | Faible | confirmé |
| Z1-BUGS-03 | Moyenne | …/config/RateLimitInterceptor.java:142-160 | Race check-then-act Redis | INCR puis EXPIRE non atomiques : clé sans TTL possible → 429 indéfini jusqu'à purge manuelle | Faible | confirmé |
| Z1-BUGS-04 | Moyenne | …/config/TwoLayerCache.java:25, 76-79 | Contrat de cache incohérent | allowNullValues=true mais put() passe null brut à Caffeine (NPE latente → 500) | Faible | confirmé |
| Z3-BUGS-09 / T-BP-05 | Moyenne | …/service/StripeService.java:106, 161, 219, 262, 857, 924 | Troncature au lieu d'arrondi | Conversion centimes par longValue() (tronque, masque l'overflow), dupliquée 6 fois + StripePaymentProvider | Faible | confirmé |
| Z4A-BUGS-06 | Moyenne | …/booking/service/PublicBookingService.java:212-221 | Calcul de prix | Propriété sans prix de base ni rate plan réservable pour 0 EUR (nuit facturée 0) | Faible | à vérifier |
| Z4A-BUGS-07 | Moyenne | …/booking/controller/BookingCheckoutController.java:39-40, 90-91 | Devise embedded checkout | Session créée en devise globale stripe.currency, réservation enregistrée dans la devise propriété | Faible | à vérifier |
| Z4A-BUGS-08 | Moyenne | …/booking/dto/AvailabilityRequestDto.java:16-22 | Fuseaux horaires / dates | @Future interdit le same-day ; « aujourd'hui » évalué en zone JVM et non celle de la propriété | Faible | confirmé |
| Z6-SECBUGS-03 | Moyenne | …/integration/channel/ChannelSyncService.java:69-71, 190-192 | Échec de sync silencieux | catch global sans rethrow : message Kafka acquitté même en échec, ni retry ni DLQ | Faible | à vérifier |
| Z5-BUGS-06 | Moyenne | …/service/PricingConfigService.java:81-99 | Cache cross-tenant (effet de bord) | @Cacheable clé constante 'current' sur entité org-filtrée ; updateConfig réassigne la dernière ligne toutes orgs | Faible | à vérifier |
| T-MORT-01 | Moyenne | …/integration/zapier/service/WebhookBroadcasterService.java:60 | Code mort — feature fantôme | broadcastEvent jamais appelé : abonnements webhook Zapier sans aucun événement émis | Faible | confirmé |
| T-MORT-02 | Moyenne | …/integration/hubspot/service/HubSpotSyncService.java:45, 74 | Code mort — intégration orpheline | Paquet hubspot sans référence externe, réservant un endpoint public /api/webhooks/hubspot (permitAll) | Faible | confirmé |
| T-MORT-03 | Moyenne | serverless.yml:47 (+ package.json:5,13-17,34-35) | Config de déploiement legacy cassée | Déploiement Lambda au handler inexistant ; npm run deploy:prod trompeur vs flux CD réel | Faible | confirmé |
| T-MORT-04 | Moyenne | client/src/components/NotificationBell.tsx:65 (représentatif des 12 fichiers) | Composants React orphelins | 12 composants (2 032 lignes) importés nulle part, dont TokenHealthMonitor antérieur à la migration cookie | Faible | confirmé |
| T-BP-03 | Moyenne | …/service/StripeService.java:893-899 (et 958-966) | Commentaire contredisant le code | Fallback « V97 » force PENDING en prétendant garder le statut ; probablement inopérant (tx rollback-only) | Faible | confirmé |
| T-BP-04 | Moyenne | …/service/StripeService.java:726-728 (et 747-749) | Catch silencieux | catch(NumberFormatException) totalement vide : intervention jamais marquée PAID/FAILED, zéro trace | Faible | confirmé |
| T-BP-06 | Moyenne | …/service/ICalImportService.java:897-901, 929-935 | Commentaire contredisant le code (tx) | syncFeeds @Transactional + self-invocation : un feed en erreur peut annuler les imports de tout le batch | Faible | à vérifier |
| Z1-SEC-FRONTAUX-01 | Moyenne | client/src/services/storageService.ts:239-247 | Stockage de token / exposition XSS | JWT d'accès complet dans le cookie non-HttpOnly clenzy_session sur .clenzy.fr (max-age 8 h > durée du token) | Moyen | confirmé |
| Z1-SEC-FRONTAUX-02 | Moyenne | client/src/keycloak.ts:50-58 | Contournement protection HttpOnly | GET /api/auth/session renvoie en clair le token du cookie HttpOnly clenzy_auth (echo neutralisant HttpOnly) | Moyen | confirmé |
| Z1-BUGS-05 | Moyenne | …/config/ReadWriteRoutingDataSource.java:19-26 | Routage lecture/écriture inopérant | Flag readOnly lu avant d'être posé (pas de LazyConnectionDataSourceProxy) : la réplique n'est jamais utilisée | Moyen | à vérifier |
| Z1-BUGS-06 | Moyenne | …/config/AsyncConfig.java:19-22 | Perte de contexte tenant en async | Executor @Async sans propagation TenantContext/SecurityContext/MDC : JPA sans cloisonnement d'org | Moyen | à vérifier |
| Z1-BUGS-07 | Moyenne | …/config/DefaultDocumentTemplateSeeder.java:125-129 | Seeder non org-scopé | Requêtes globales : seed sauté ou IncorrectResultSizeDataAccessException si 2 templates actifs du même type | Moyen | à vérifier |
| Z1-BUGS-08 | Moyenne | …/config/RoleMigrationRunner.java:41-130 | DDL au boot hors Liquibase | DROP/CREATE de users_role_check à chaque boot avec liste de rôles en dur ; erreurs avalées (risque prod-only type 0164) | Moyen | confirmé |
| Z3-BUGS-10 | Moyenne | …/controller/StripeWebhookController.java:259-266 | Échec de paiement masqué | Webhook retourne toujours 200 : un échec de confirmation supprime définitivement la relivraison Stripe | Moyen | confirmé |
| Z4A-BUGS-09 | Moyenne | …/booking/dto/BookingReserveBatchRequestDto.java:21-23 | Panier / flux incomplet | /checkout/create-session-batch documenté mais inexistant ; batchCode jamais persisté, pas de webhook multi-résas | Moyen | à vérifier |
| Z4A-BUGS-10 | Moyenne | …/booking/service/PublicBookingService.java:698-709, 765-779 | Service options perdues au webhook | Le webhook embedded ne lit pas les options : totalPrice incohérent avec les composantes, pas de ReservationServiceItem | Moyen | confirmé |
| Z5-BUGS-08 | Moyenne | …/service/AdvancedRateManager.java:193 (+ PublicBookingService.java:180, ChannelPromotionService.java:197) | Timezone propriété ignorée | Fenêtres yield/last-minute/advance/promos calculées en LocalDate.now() zone JVM au lieu de Property.timezone | Moyen | confirmé |
| Z6-SECBUGS-04 | Moyenne | …/service/ICalEventParser.java:241-247 | Parsing iCal (timezone) | TZID et suffixe Z ignorés (substring 8 premiers caractères) : check-in/out décalés d'un jour possibles | Moyen | à vérifier |
| Z2-EFFETS-02 | Moyenne | …/scheduler/ICalSyncScheduler.java:101-104 | Filtre Hibernate inactif hors HTTP (effet de bord) | Le job iCal tourne sans organizationFilter ; l'isolation repose sur la discipline orgId manuelle, fragile | Moyen | à vérifier |
| Z5-BUGS-07 | Moyenne | …/service/ChannelPromotionService.java:64-85, 156-187 | Effet de bord externe avant commit | Push HTTP OTA dans la transaction ; rollback → promo active côté OTA mais absente/PENDING en base | Moyen | confirmé |
| T-ARCH-05 | Moyenne | …/controller/ReservationController.java:55-56, 508-517 | Intégration externe dans la présentation | Clé Stripe @Value + Stripe.apiKey muté dans les controllers ; email de paiement construit dans le controller | Moyen | confirmé |
| T-ARCH-07 | Moyenne | …/controller/TaxRuleController.java:64-65 | Entités JPA exposées par l'API | 9 controllers retournent des entités brutes (TaxRuleController renvoie même findAll() directement) | Moyen | confirmé |
| T-ARCH-08 | Moyenne | …/controller/CalendarController.java:337-365 | Duplication d'autorisation transverse | validatePropertyAccess copiée-collée dans 8 controllers avec variantes — trou d'autorisation silencieux possible | Moyen | confirmé |
| T-SOLID-4 | Moyenne | …/service/StripeService.java:97-147, 155-205, 841-906, 913-971 | Duplication (Rule of Three dépassée) | 4 méthodes de création de session Checkout quasi identiques (~55 l. copiées), divergence déjà visible | Moyen | confirmé |
| T-SOLID-5 | Moyenne | …/service/TagResolverService.java:117-127 (+ DocumentGeneratorService.java:488-518) | OCP / Shotgun Surgery | Dispatch sur le type de référence dupliqué en 3 switches String dans 2 fichiers, default silencieux | Moyen | confirmé |
| T-SOLID-8 | Moyenne | …/service/InvoiceGeneratorService.java:70-201, 330-414 | Duplication / divergence fiscale | Deux surcharges generateFromReservation refont la même construction avec fallbacks divergents ("FR", "EUR") | Moyen | confirmé |
| T-BP-07 | Moyenne | …/service/StripeService.java:344-382 (et 388-420) | Dégradation silencieuse (finance) | Échec ledger/split seulement loggé : paiement confirmé sans écriture comptable, aucun rattrapage | Moyen | confirmé |
| T-ARCH-06 | Moyenne | …/service/SyncAdminService.java:18-25 | Cycle service↔integration | 32 fichiers service→integration et 48 integration→service : connecteurs non modularisables | Élevé | confirmé |
| T-SOLID-6 | Moyenne | …/service/agent/AgentOrchestrator.java:74-253, 255-270, 388-505, 709-824 | God class / double chemin legacy | 1 403 l., 16 dépendances, prompts v1+v2 en parallèle, boucle d'outils, multi-agent et persistance dans une classe | Élevé | confirmé |
| T-SOLID-7 | Moyenne | …/service/StripeService.java:306-309, 378-380, 845-850 (transverse) | Gestion d'erreur incohérente | 78 catch(Exception) génériques sur les 10 services, trois stratégies mélangées dans la même classe | Élevé | confirmé |

### 5.3 Constats Faible (26 entrées, format compact)

| ID | Sévérité | Fichier:lignes | Catégorie | Description courte | Effort | Confiance |
|---|---|---|---|---|---|---|
| Z1-SEC-07 | Faible | …/config/SecurityConfigProd.java:166 | Endpoints actuator exposés | /actuator/prometheus et /metrics en permitAll, protégés par nginx seul (point de défense unique) | Faible | confirmé |
| Z1-SEC-08 | Faible | …/config/EncryptedFieldConverter.java:72-79 | Chiffrement au repos (erreurs) | Échec de déchiffrement → valeur brute retournée silencieusement (altération/rotation de clé indétectable) | Faible | confirmé |
| Z2-SEC-06 | Faible | …/controller/UserController.java:242-255 | Ownership manquant | getProfilePicture sans validateOwnershipOrAdmin : photo de tout utilisateur lisible par itération d'id | Faible | confirmé |
| Z4A-SEC-05 | Faible | …/booking/controller/BookingGuestAuthController.java:39, 55, 103 | PII dans les logs | Emails guests loggés en INFO sur register/login/forgot-password | Faible | confirmé |
| Z4B-SECBUGS-03 | Faible | …/controller/PublicContractSignatureController.java:50-56 | Rate-limit contournable | Compteur 30/10 min keyé sur une IP XFF contrôlée par le client ; fail-open si Redis indisponible | Faible | confirmé |
| Z4B-SECBUGS-04 | Faible | …/service/KeyExchangeService.java:344-350 | Validation d'état insuffisante | Mouvements « returned »/« deposited » enregistrés sur des codes annulés/expirés (pollution piste d'audit) | Faible | confirmé |
| Z4B-SECBUGS-05 | Faible | …/service/WelcomeGuideEntryService.java:38-54 | Absence de rate-limit applicatif | Livre d'or sans plafond par token (entrées de 2 000 chars en boucle) | Faible | confirmé |
| Z1-SEC-FRONTAUX-04 | Faible | client/src/services/TokenService.ts:455-459 | postMessage sans origine | Listener TOKEN_UPDATE sans vérification event.origin (impact actuel limité, surface future) | Faible | confirmé |
| Z1-SEC-FRONTAUX-05 | Faible | client/src/services/TokenService.ts:448-451 | Robustesse synchro multi-onglets | JSON.parse sans try/catch + clé en dur au lieu de STORAGE_KEYS.TOKEN_UPDATE | Faible | confirmé |
| Z1-BUGS-09 | Faible | …/config/TwoLayerCache.java:82-91 | Invalidation cache L1/L2 | evict L1 avant L2, aucune invalidation cross-instance (données périmées ≤ 30 s, pire en multi-instance) | Faible | confirmé |
| Z1-BUGS-10 | Faible | …/config/CalendarPartitionManager.java:45-63 | Échec silencieux au boot mensuel | Création de partition avalée en warn, sans métrique/alerte ni verrou distribué — panne différée ~18 mois | Faible | confirmé |
| Z5-BUGS-09 | Faible | …/service/AdvancedRateManager.java:152-158 | Affichage yield erroné | appliedYieldRule sans filtrage par date (variable currentDate inutilisée) : règle affichée à tort chaque jour | Faible | confirmé |
| Z5-BUGS-10 | Faible | …/service/AdvancedRateManager.java:292, 309 | BigDecimal.equals (échelle) | equals au lieu de compareTo : overrides et lignes rate_audit_log parasites à chaque run horaire | Faible | à vérifier |
| Z6-SECBUGS-05 | Faible | …/service/ICalEventParser.java:171-175, 241-247 | Parsing iCal / perte silencieuse | substring(0,8) sans check de longueur : événement exclu en silence, peut alimenter les orphelins (Z6-SECBUGS-02) | Faible | confirmé |
| Z7-SEC-03 | Faible | …/service/messaging/EmailChannel.java:69-74 | Contournement du wrapper email | Body commençant par <html / <!doctype envoyé verbatim sans wrapper ni échappement | Faible | à vérifier |
| T-ARCH-09 | Faible | …/controller/CalendarController.java:298-324 | Endpoint factice | push-pricing renvoie « PUSHED » alors que l'appel Airbnb est un TODO non implémenté | Faible | confirmé |
| T-ARCH-10 | Faible | …/service/KeycloakService.java:37-38 | Injection par champ | 2 @Autowired sur champ subsistent (KeycloakService, PermissionService:46-47) | Faible | confirmé |
| T-SOLID-10 | Faible | …/service/TagResolverService.java:730, 1149 | DIP / instanciation infra | new ObjectMapper() à chaque appel (config Jackson globale ignorée) ; HttpClient construit dans le constructeur | Faible | confirmé |
| T-MORT-05 | Faible | fix-async-vars.js:1-56 | Script one-shot mort | Codemod obsolète à la racine + dépendance npm glob entretenue pour rien | Faible | confirmé |
| T-MORT-06 | Faible | test-endpoint.sh:1-14 (+ test-report-generation.sh:1-113) | Scripts de test ad-hoc morts | Scripts curl périmés et non fonctionnels (Basic auth admin:admin inexistante dans la stack) | Faible | confirmé |
| T-MORT-07 | Faible | …/integration/pennylane/PennylaneSignatureProvider.java:17-19 | Vestige provider de signature | Pennylane (comptabilité) encore enregistré comme fournisseur de signature électronique | Faible | à vérifier |
| T-BP-09 | Faible | …/service/ICalImportService.java:700 (vs 268) | Magic number / incohérence | guestCheckinTime fixé 15:00 en dur au lieu de property.getDefaultCheckInTime() (fenêtre de ménage erronée) | Faible | confirmé |
| Z6-SECBUGS-06 | Faible | …/service/ICalImportService.java:238 | Collision d'UID inter-sources | Dédoublonnage par (UID, propriété) et non par feed : réservation d'un second canal silencieusement skippée | Moyen | à vérifier |
| Z6-SECBUGS-07 | Faible | …/service/ICalEventParser.java:84-112, 119-176 | Parsing iCal (RRULE) | RRULE/RDATE jamais expansées : seule la première occurrence d'un événement récurrent est importée | Moyen | à vérifier |
| T-SOLID-9 | Faible | …/service/EmailService.java:204-278, 405-412, 1084-1100 | SRP / contenu métier dans le transport | EmailService (1 251 l., 33 méthodes) mêle SMTP, rendu HTML et libellés métier en dur (forfaits, rôles) | Moyen | confirmé |
| T-BP-10 | Faible | server/src/test/java/com/clenzy (volumétrie globale) | Couverture de tests | Package signature (~1 100 l., preuve légale) : 13 @Test ; SignatureCertificateStamper et provider sans classe dédiée | Moyen | confirmé |

---

## 6. Quick wins

Constats à fort impact corrigeables en moins de ~2 heures chacun (sévérité ≥ Moyenne, correctif trivial et localisé) :

**Critique — quelques lignes suffisent :**
- **Z2-SEC-01** — ajouter 3 appels à `requireSameOrganization(device)` (le helper existe déjà l.124-131) dans deleteDevice/getLockStatus/sendLockCommand.
- **Z2-SEC-02** — comparer `generation.getOrganizationId()` au TenantContext avant de servir le download.
- **Z2-SEC-03** — valider l'org dans PropertyService indépendamment du rôle HOST (ou findByIdAndOrganizationId).
- **Z3-BUGS-01 / Z3-SEC-02** — early-return `if (paymentStatus == PAID)` en tête des 4 méthodes confirm* (le pattern existe déjà dans confirmBookingEngineCheckout).
- **Z3-SEC-01 / Z3-BUGS-02** — remplacer request.getAmount() par intervention.getEstimatedCost() côté serveur.
- **Z4A-BUGS-02** (première moitié) — poser session.expires_at à 30 min + guard sur reservation.status dans confirmReservationPayment.

**Élevée — effort Faible :**
- **Z1-SEC-02** — rejeter la trame CONNECT sans Authorization valide (lever une exception au lieu de log.warn).
- **Z1-SEC-03** — remplacer `@Profile("!prod")` par un profil positif explicite ou un fail-fast au boot.
- **Z1-SEC-04 / Z1-BUGS-02** — lire X-Real-IP (déjà posé par nginx en écrasement) + vrai test CIDR dans isTrustedProxy.
- **Z1-BUGS-01** — passer un `DeadLetterPublishingRecoverer(kafkaTemplate)` au DefaultErrorHandler (1 argument).
- **Z2-EFFETS-01** — ajouter `tenantContext.clear()` dans le finally d'ICalSyncScheduler.
- **Z3-BUGS-08** — passer generateNextNumber de REQUIRES_NEW à REQUIRED (le verrou pessimiste existe déjà).
- **Z4A-BUGS-04** — étendre la requête de cleanup aux réservations confirmed + paymentStatus PENDING.
- **Z4A-BUGS-05** — passer status="confirmed" après validation du paiement quand le statut courant est pending.
- **T-BP-01** — masquer email/nom dans les logs de signature.
- **T-BP-02** — logger l'URL iCal tronquée (host + path, sans query string).

**Moyenne — effort Faible :**
- **Z1-SEC-05** — restreindre les origines WebSocket à cors.allowed-origins.
- **Z1-SEC-06** — supprimer les défauts admin/admin et fail-fast au boot (comme dbPassword/jasyptPassword).
- **Z2-SEC-04** — faire échouer la requête (403/500) si la résolution tenant échoue pour un non-staff.
- **Z3-SEC-03** — supprimer l'implémentation verifyWebhook « soft » de PayPalPaymentProvider.
- **Z3-SEC-04** — derived query findByProviderTxId au lieu de findAll().stream().
- **Z4A-SEC-03 / Z2-SEC-07** — @PreAuthorize staff (ou API key + allowlist) sur le preview-proxy public.
- **Z4A-SEC-04** — deny par défaut quand allowedOrigins n'est pas configuré en production.
- **Z4B-SECBUGS-01** — réutiliser la logique trusted-proxy pour l'IP du certificat de signature.
- **Z3-BUGS-09 / T-BP-05** — helper unique toCents() en HALF_UP + longValueExact().
- **Z4A-BUGS-06** — refuser la disponibilité quand le prix résolu d'une nuit est null ou ≤ 0.
- **Z4A-BUGS-08** — @FutureOrPresent + LocalDate.now(zone de la propriété).
- **Z7-SEC-02** — échapper/sanitiser customBody avant le wrap.
- **Z1-SEC-FRONTAUX-03** — activer mask_all_text / maskTextSelector dans la config PostHog.
- **T-BP-04** — logger l'id invalide dans les catch vides de confirmGroupedPayment.
- **T-MORT-01/02/03/04** — suppressions sèches (paquets zapier/hubspot, serverless.yml, 12 composants orphelins) ; retirer au passage la règle permitAll /api/webhooks/hubspot. 

---

## 7. Risques structurels nécessitant une refonte

**1. Montants « client-trusted » et absence d'idempotence : la couche paiement doit être refondée.** Le même défaut — faire confiance au montant envoyé par le client — apparaît indépendamment en trois endroits (Z4A-SEC-01/Z4A-BUGS-01 sur le checkout public, Z3-SEC-01/Z3-BUGS-02 sur les interventions, et par extension Z4A-BUGS-07 sur la devise), et l'absence d'idempotence se répète sur tout le cycle : confirmations webhook (Z3-BUGS-01/Z3-SEC-02), payouts (Z3-BUGS-03), remboursements (Z3-BUGS-06), numérotation (Z3-BUGS-07, Z3-BUGS-08). Ce n'est pas une série de bugs isolés mais l'absence d'un invariant central « le serveur est seul maître des montants, chaque effet financier est rejouable sans double-écriture ». La refonte passe par : résolution des montants exclusivement côté serveur, idempotency keys Stripe systématiques, contraintes uniques sur ledger_entries et invoices, et la passerelle StripePaymentGateway (T-SOLID-3/Z3-SEC-05) pour éliminer l'état statique muté dans ~13 classes.

**2. L'isolation multi-tenant repose sur un mécanisme que les chemins critiques contournent.** Le @Filter Hibernate ne s'applique ni aux findById (Z2-SEC-01, Z2-SEC-02, Z2-SEC-03, Z2-SEC-06), ni aux threads non-HTTP (Z1-BUGS-06, Z2-EFFETS-01, Z2-EFFETS-02), ni aux caches (Z5-BUGS-06), et le TenantFilter est fail-open (Z2-SEC-04) avec un fallback d'org implicite (Z2-SEC-05). Les commentaires du code affirment même le contraire de la réalité (SmartLockService:110, PropertyService:148). Il manque une couche d'autorisation ownership systématique : un PropertyAccessService/ResourceAccessService unique (qui remplacerait aussi les 8 copies de validatePropertyAccess, T-ARCH-08), des requêtes findByIdAndOrganizationId par défaut, et un TaskDecorator propageant le TenantContext en async. Sans cela, chaque nouveau endpoint reproduit le même IDOR.

**3. Deux sources de vérité pour les prix, déjà divergentes.** calendar_days.nightly_price est écrit par le PMS et les adapters OTA mais jamais lu par le PriceEngine (Z5-BUGS-04) ; la résolution de prix est recopiée dans CalendarController avec 4 types sur 7 (T-ARCH-04) ; les prix channel calculés sont jetés avant le push OTA (Z5-BUGS-03) ; le yield se ré-applique sur son propre résultat (Z5-BUGS-02) et la sémantique LAST_MINUTE/EARLY_BIRD n'est pas implémentée (Z5-BUGS-05). Le PriceEngine doit devenir l'unique résolveur (prix + source + canal), les écritures manuelles devenant des RateOverride, et les connecteurs consommant le prix résolu plutôt que de le recalculer.

**4. Les controllers sont devenus des orchestrateurs.** 72 controllers injectent des repositories (T-ARCH-01), ReservationController.update orchestre quatre écritures sans transaction (T-ARCH-02) et oublie le CalendarEngine (Z5-BUGS-01), WalletController contient le backfill comptable (T-ARCH-03), Stripe est appelé statiquement depuis la présentation (T-ARCH-05) et 9 controllers exposent des entités JPA (T-ARCH-07). La conséquence directe est visible : les invariants métier (calendrier, ledger) ne sont appliqués que sur certains chemins. Une règle ArchUnit (controller ne dépend jamais de repository, toute écriture multiple passe par un service @Transactional) et la migration des 5 pires controllers sont le point de départ.

**5. God classes et gestion d'erreur « avale-tout » sur les flux les plus critiques.** DocumentGeneratorService (1 077 l., 27 dépendances, T-SOLID-1), ICalImportService (importICalFeed 339 l. mono-transaction, T-SOLID-2), AgentOrchestrator (1 403 l., double chemin de prompts, T-SOLID-6) et EmailService (T-SOLID-9) concentrent les responsabilités, pendant que 78 catch(Exception) génériques (T-SOLID-7) et les dégradations silencieuses sur l'argent et le booking (T-BP-07, T-BP-08/Z4A-BUGS-03, Z3-BUGS-10, Z6-SECBUGS-03, T-BP-04) rendent les pannes financières indistinguables des bugs. La refonte doit coupler le découpage de ces classes à une politique d'erreur explicite : exceptions métier typées, retour 500 sur les webhooks une fois l'idempotence en place, et marqueurs de réconciliation persistés au lieu de logs.

**6. Deux patterns de sécurité transverses à corriger une fois, partout.** D'une part le contrat anti-DNS-rebinding d'ICalUrlValidator (« the caller MUST use this resolved address ») est violé par tous ses appelants (Z4A-SEC-02 sur le preview proxy public, Z6-SECBUGS-01 sur l'import iCal) : il faut fournir un client HTTP « pinné » réutilisable plutôt qu'un validateur dont le contrat est ignoré. D'autre part la résolution de l'IP cliente depuis X-Forwarded-For est implémentée trois fois, dont deux de façon spoofable (Z1-SEC-04/Z1-BUGS-02, Z4B-SECBUGS-01, Z4B-SECBUGS-03) : un résolveur d'IP unique aligné sur la chaîne Cloudflare→nginx (X-Real-IP) doit remplacer les copies locales — il sécurise d'un coup rate-limiting, anti brute-force et valeur probante des signatures.

---

*Fin du rapport — campagne d'audit multi-agents Clenzy, 2026-06-10. Constats issus exclusivement de l'analyse statique en lecture seule ; les numéros de ligne correspondent à l'état du dépôt au moment de l'audit.*

