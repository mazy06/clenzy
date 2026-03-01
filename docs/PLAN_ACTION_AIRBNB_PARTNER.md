# 🏗️ Plan d'Action Technique — Clenzy PMS × Airbnb Partner

> **Objectif :** Rendre Clenzy conforme aux exigences techniques d'Airbnb pour obtenir le statut de PMS Partner (Connected Software Program).
>
> **Durée estimée :** 90 jours (12 semaines)
>
> **Dernière mise à jour :** 11 février 2026 (Phase 3 complète)

---

## 📊 État actuel de la stack Clenzy

| Composant | Technologie | Statut |
|-----------|-------------|--------|
| Backend | Java 17 + Spring Boot 3.2 + Maven | ✅ OK |
| Frontend | React 18 + TypeScript 5 + Vite 7 + MUI 5 | ✅ OK |
| Base de données | PostgreSQL 15 + HikariCP | ✅ OK |
| Cache | Redis 7 (cache only) | ⚠️ Pas de pub/sub |
| Authentification | Keycloak 24 + OAuth2 + JWT | ✅ OK |
| Paiement | Stripe 24.16 | ✅ OK |
| Monitoring | Actuator + Prometheus + Grafana (dev + prod) | ✅ Implémenté |
| Documentation API | SpringDoc OpenAPI / Swagger UI | ⚠️ Basique |
| Logs Centralisés | Grafana Loki 2.9.4 + Promtail + JSON structuré | ✅ Implémenté |
| CI/CD | GitHub Actions (backend + frontend) | ✅ Implemente |
| Message Broker | Apache Kafka 7.6 (KRaft) + Spring Kafka | ✅ Implémenté |
| API Gateway | ApiGatewayFilter + ApiMetricsConfig (pattern monolithique) | ✅ Implémenté |
| Audit Trail | AuditLog entity + AOP + Service | ✅ Implemente |
| Rate Limiting | Interceptor applicatif + Nginx | ✅ Implemente |
| MFA | Non activé | ❌ Bloquant Airbnb |
| Chiffrement au repos | AES-256 Jasypt (tokens Airbnb + PII User + GDPR) | ✅ Implémenté |
| Environnement staging | Docker Compose + Spring profile | ✅ Implémenté |

---

## Phase 1 — Fondations Sécurité & CI/CD (Semaines 1-4)

> **Objectif :** Poser les bases de sécurité et d'automatisation indispensables avant tout développement Airbnb.

### 1.1 Sécurisation immédiate (Quick Wins)

- [x] **1.1.1** Supprimer tous les mots de passe en dur dans les docker-compose → fichiers `.env` avec `.env.example` versionne *(docker-compose.dev.yml + application-dev.yml + application.yml + AuthController.java)*
- [x] **1.1.2** Creer `.env.dev`, `.env.staging`, `.env.prod` avec des secrets differents par environnement *(3 fichiers crees dans clenzy-infra)*
- [x] **1.1.3** Ajouter `.env*` (sauf `.env.example`) au `.gitignore` *(clenzy/.gitignore + clenzy-infra/.gitignore)*
- [x] **1.1.4** Ajouter les headers de securite HTTP dans Nginx et Spring Security :
  - `Strict-Transport-Security` (HSTS) avec preload
  - `Content-Security-Policy` (CSP)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
- [ ] **1.1.5** Versionner l'API : `/api/v1/` (prefixe sur tous les endpoints existants) — *REPORTE : changement breaking, a planifier avec migration frontend*

### 1.2 TLS / Chiffrement en transit

- [x] **1.2.1** TLS 1.2/1.3 deja actif sur Nginx prod *(ssl_protocols TLSv1.2 TLSv1.3)*
- [x] **1.2.2** SSL PostgreSQL : `sslmode=prefer` ajoute dans docker-compose.prod.yml
- [x] **1.2.3** Redis `--requirepass` deja actif en prod *(docker-compose.prod.yml)*
- [x] **1.2.4** Let's Encrypt deja configure avec certbot renouvellement auto 12h *(docker-compose.prod.yml)*
- [x] **1.2.5** HTTPS redirect deja actif *(nginx.conf : return 301 https://)*

### 1.3 MFA obligatoire (Exigence Airbnb)

- [ ] **1.3.1** Activer le MFA (TOTP) dans Keycloak pour tous les utilisateurs admin
- [ ] **1.3.2** Rendre le MFA obligatoire pour les rôles ADMIN et MANAGER
- [ ] **1.3.3** Documenter la procédure d'activation MFA pour les utilisateurs

### 1.4 CI/CD — GitHub Actions

- [x] **1.4.1** Creer `.github/workflows/ci-backend.yml` — Pipeline backend (Java 17, Maven, tests + OWASP dependency check + Docker build)
- [x] **1.4.2** Creer `.github/workflows/ci-frontend.yml` — Pipeline frontend (Node 22, tsc --noEmit, npm run build, npm audit + Docker build)
- [x] **1.4.3** Ajouter un scan de securite SAST dans le pipeline *(OWASP dependency-check inclus dans ci-backend.yml)*
- [x] **1.4.4** Ajouter un scan de dependances vulnerables *(mvn dependency-check:check + npm audit inclus)*
- [ ] **1.4.5** Configurer le build Docker automatique et push vers un registry (GitHub Container Registry)
- [ ] **1.4.6** Pipeline de déploiement staging (auto) et prod (manuel avec approbation)

### 1.5 Monitoring — Prometheus + Grafana partout

- [x] **1.5.1** Activer Prometheus + Grafana dans le profil `dev` *(docker-compose.dev.yml : services prometheus + grafana, ports 9090 + 3001)*
- [x] **1.5.2** Activer Prometheus + Grafana dans le profil `prod` *(docker-compose.prod.yml : services prometheus + grafana, retention 90j)*
- [x] **1.5.3** Créer un dashboard Grafana "Overview" : requêtes/s, latence p50/p95/p99, erreurs, uptime *(monitoring/grafana/dashboards/clenzy-overview.json)*
- [ ] **1.5.4** Mettre en place un monitoring uptime externe (UptimeRobot ou Blackbox Exporter)

### 1.6 Backups automatiques

- [x] **1.6.1** Script cron backup PostgreSQL quotidien *(backup/backup.sh : pg_dump compressé + rotation 7/28/180 jours)*
- [x] **1.6.2** Script backup Keycloak *(backup/backup.sh : export realm via kcadm + dump base keycloak_$ENV)*
- [x] **1.6.3** Backup Redis *(backup/backup.sh : BGSAVE + copie dump.rdb)*
- [x] **1.6.4** Script de restauration *(backup/restore.sh : --latest, --list, --archive)*
- [ ] **1.6.5** Stocker les backups sur un stockage externe chiffré (S3 ou équivalent)

### 1.7 Audit Trail

- [x] **1.7.1** Creer l'entite JPA `AuditLog` avec indexes (auto-genere la table via Hibernate ddl-auto)
- [x] **1.7.2** Creer `AuditLogService` dans le backend *(async, enrichi avec IP/User-Agent)*
- [x] **1.7.3** Implementer `@Audited` annotation + `AuditAspect` AOP pour les operations CRUD
- [x] **1.7.4** Logger automatiquement : login, login_failed, logout *(integre dans AuthController)*
- [ ] **1.7.5** Retention minimum : 2 ans *(a configurer en prod via politique de retention BDD)*

### 1.8 Rate Limiting

- [x] **1.8.1** Implementer `RateLimitInterceptor` custom (pas de dependance externe, zero-config)
- [x] **1.8.2** Configurer les limites par endpoint :
  - API auth : 30 req/min par IP (protection brute-force)
  - API authentifiee : 300 req/min par utilisateur
  - Webhooks : exclus du rate limiting
- [x] **1.8.3** Retourner les headers standards : `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`
- [x] **1.8.4** Logger les depassements de rate limit *(avec log.warn)*

### 1.9 Environnement Staging

- [x] **1.9.1** Créer `docker-compose.staging.yml` *(miroir prod : Nginx, Certbot, PostgreSQL, Redis, Keycloak, backend, frontend, Prometheus, Grafana)*
- [x] **1.9.2** Créer `application-staging.yml` *(Spring Boot staging : Swagger activé, logs debug, ddl-auto: update)*
- [x] **1.9.3** Créer `start-staging.sh` *(avec vérification .env.staging + alerte CHANGE_ME)*
- [ ] **1.9.4** Déployer staging sur un serveur dédié (ou même machine, ports différents)

### 1.10 Scan OWASP Top 10 (Exigence Airbnb)

- [ ] **1.10.1** Installer OWASP ZAP ou Burp Suite Community
- [ ] **1.10.2** Lancer un premier scan sur l'application staging
- [ ] **1.10.3** Corriger les vulnérabilités critiques et hautes identifiées
- [ ] **1.10.4** Documenter les résultats dans un rapport

---

## Phase 2 — Architecture Airbnb & Message Broker (Semaines 5-8)

> **Objectif :** Construire l'infrastructure d'intégration Airbnb (OAuth, webhooks, Kafka, endpoints dédiés).

### 2.1 Apache Kafka — Message Broker

- [x] **2.1.1** Ajouter Kafka KRaft (sans Zookeeper) dans `docker-compose.dev.yml` et `docker-compose.staging.yml` *(cp-kafka:7.6.0, mode KRaft, port 9092)*
- [x] **2.1.2** Ajouter `spring-kafka` + `jasypt-spring-boot-starter` au pom.xml
- [x] **2.1.3** Créer les topics Kafka via `KafkaConfig.java` (8 topics avec beans `NewTopic`) :
  - `airbnb.webhooks.incoming`, `airbnb.reservations.sync`, `airbnb.calendar.sync`
  - `airbnb.messages.sync`, `airbnb.listings.sync`, `notifications.send`
  - `audit.events`, `airbnb.dlq` (Dead Letter Queue)
- [x] **2.1.4** Configurer les producers/consumers Spring Kafka *(JSON serialization, idempotent producer, manual ack, error handling)*
- [x] **2.1.5** Implémenter un Dead Letter Topic `airbnb.dlq` pour les messages en échec
- [x] **2.1.6** Ajouter Kafka UI (provectuslabs/kafka-ui) pour le monitoring dev *(port 8085)*
- [ ] **2.1.7** Remplacer le polling HTTP des notifications par Kafka + WebSocket/SSE (cf. TODO existant)

### 2.2 Module Airbnb Integration

- [x] **2.2.1** Créer le package `com.clenzy.integration.airbnb` complet *(21 fichiers)* :
  ```
  integration/airbnb/
  ├── config/
  │   └── AirbnbConfig.java           -- Configuration externalisée (URLs, client ID, scopes)
  ├── controller/
  │   ├── AirbnbOAuthController.java   -- Endpoints OAuth (connect, callback, disconnect, status)
  │   ├── AirbnbWebhookController.java -- Endpoint webhook (validation signature HMAC)
  │   └── AirbnbListingController.java -- Endpoints listings (link, unlink, sync toggle)
  ├── dto/
  │   ├── AirbnbReservationDto.java
  │   ├── AirbnbCalendarEventDto.java
  │   ├── AirbnbListingDto.java
  │   ├── AirbnbMessageDto.java
  │   ├── AirbnbConnectionStatusDto.java
  │   └── AirbnbWebhookPayload.java
  ├── model/
  │   ├── AirbnbConnection.java        -- Entité : connexion OAuth (tokens chiffrés AES-256)
  │   ├── AirbnbWebhookEvent.java      -- Entité : événements webhook bruts (idempotent)
  │   └── AirbnbListingMapping.java    -- Entité : mapping propriété <-> listing
  ├── repository/
  │   ├── AirbnbConnectionRepository.java
  │   ├── AirbnbWebhookEventRepository.java
  │   └── AirbnbListingMappingRepository.java
  ├── service/
  │   ├── AirbnbOAuthService.java      -- Gestion OAuth2 (token exchange, refresh, revoke)
  │   ├── AirbnbReservationService.java
  │   ├── AirbnbCalendarService.java
  │   ├── AirbnbListingService.java
  │   ├── AirbnbMessageService.java
  │   └── AirbnbSyncScheduler.java     -- Jobs de sync planifiés
  └── mapper/
      └── AirbnbMapper.java            -- MapStruct : Airbnb DTO <-> Clenzy entities
  ```
- [x] **2.2.2** Créer les tables PostgreSQL via migration Flyway `V20__create_airbnb_integration_tables.sql` :
  - `airbnb_connections` : connexions OAuth (tokens chiffrés, index unique user_id)
  - `airbnb_webhook_events` : événements webhook (idempotent via eventId, index composite type+status)
  - `airbnb_listing_mappings` : mapping propriété ↔ listing (FK properties, index unique airbnb_listing_id)

### 2.3 OAuth 2.0 Airbnb

- [x] **2.3.1** Implémenter `AirbnbOAuthService` *(getAuthorizationUrl, exchangeCodeForToken, refreshToken, revokeToken, getValidAccessToken)*
- [x] **2.3.2** Chiffrer les tokens en base avec AES-256 via Jasypt *(AirbnbTokenEncryptionService)*
- [x] **2.3.3** Implémenter un scheduler pour le refresh automatique des tokens *(AirbnbSyncScheduler, toutes les 30 min)*
- [x] **2.3.4** Endpoints REST *(AirbnbOAuthController)* :
  - `GET /api/airbnb/connect` — retourne l'URL d'autorisation Airbnb
  - `GET /api/airbnb/callback` — callback OAuth (echange code -> token, public)
  - `POST /api/airbnb/disconnect` — revoque le token et deconnecte
  - `GET /api/airbnb/status` — statut connexion + nombre de listings lies

### 2.4 Webhooks Airbnb

- [x] **2.4.1** Créer `POST /api/webhooks/airbnb` — endpoint public avec validation de signature HMAC-SHA256
- [x] **2.4.2** Stocker chaque événement brut dans `airbnb_webhook_events` (idempotent via eventId unique)
- [x] **2.4.3** Publier l'événement dans le topic Kafka correspondant (routage automatique par eventType)
- [x] **2.4.4** Créer les consumers Kafka pour chaque type d'événement :
  - `AirbnbReservationService` : reservation.created/updated/cancelled
  - `AirbnbCalendarService` : calendar.updated/blocked/unblocked
  - `AirbnbListingService` : listing.updated/deactivated
  - `AirbnbMessageService` : message.received/sent
- [x] **2.4.5** Implémenter retry avec FixedBackOff (2s, 5 retries) via DefaultErrorHandler
- [x] **2.4.6** Répondre `200 OK` immédiatement (traitement asynchrone via Kafka)

### 2.5 Endpoints API Airbnb (sync bidirectionnelle)

- [ ] **2.5.1** Réservations (nécessite accès API Airbnb réelle — structure prête via consumers Kafka)
- [ ] **2.5.2** Calendrier (nécessite accès API Airbnb réelle — consumer prêt)
- [x] **2.5.3** Annonces (Listings) *(AirbnbListingController)* :
  - `GET /api/airbnb/listings` — lister les listings lies et actifs
  - `POST /api/airbnb/listings/link` — lier une propriété Clenzy a un listing Airbnb
  - `DELETE /api/airbnb/listings/{propertyId}/unlink` — délier
  - `PUT /api/airbnb/listings/{propertyId}/sync` — activer/desactiver la sync
  - `PUT /api/airbnb/listings/{propertyId}/auto-interventions` — activer/desactiver auto-interventions
- [ ] **2.5.4** Messages (nécessite accès API Airbnb réelle — consumer prêt)

### 2.6 Auto-génération des interventions

- [x] **2.6.1** À chaque nouvelle réservation Airbnb, auto-créer une intervention de ménage :
  - Date : jour du check-out (11h)
  - Durée estimée : formule basée sur nb chambres + nb guests + surface *(arrondi au 0.5h)*
  - Statut : `PENDING`, priorité `HIGH`
  - Instructions spéciales : code confirmation Airbnb + infos guest + consignes d'accès
- [x] **2.6.2** À l'annulation d'une réservation, annuler automatiquement l'intervention liée
- [x] **2.6.3** À la modification de dates, mettre à jour l'intervention automatiquement *(recalcul durée si nb guests change)*

### 2.7 API Gateway (pattern applicatif — architecture monolithique)

- [x] **2.7.1** Implémenter `ApiGatewayFilter.java` (OncePerRequestFilter) :
  - Génération/propagation `X-Request-Id` (UUID) pour le tracing distribué
  - Injection dans le MDC (Mapped Diagnostic Context) pour la corrélation des logs
  - Mesure de la durée de chaque requête (`X-Response-Time` header)
  - Logging : méthode, URI, status HTTP, durée, requestId
  - WARN pour les requêtes lentes (> 2000ms)
  - Exclusion des endpoints health/actuator et ressources statiques
- [x] **2.7.2** Implémenter `ApiMetricsConfig.java` (Micrometer) :
  - `clenzy.api.request.duration` — Timer durée requêtes (tags: method, uri, status)
  - `clenzy.api.request.total` — Compteur total requêtes
  - `clenzy.api.error.client` — Compteur erreurs 4xx
  - `clenzy.api.error.server` — Compteur erreurs 5xx
  - `clenzy.api.webhook.airbnb` — Compteur webhooks Airbnb
- [x] **2.7.3** Rate limiting déjà intégré via `RateLimitInterceptor` *(Phase 1.8)*
- [x] **2.7.4** Validation JWT via Spring Security + Keycloak *(existant)*
- [x] **2.7.5** Créer `logback-spring.xml` pour le structured logging :
  - Dev : console avec pattern `[requestId]` pour corrélation
  - Prod/Staging : JSON structuré (Logback JSON + Jackson) pour ingestion Loki/ELK

### 2.8 Centralisation des logs

- [x] **2.8.1** Déployer Loki 2.9.4 + Promtail dans l'infra Docker *(docker-compose.dev.yml + docker-compose.prod.yml)*
  - Loki : agrégation de logs, retention 30j, cache 100MB, stockage filesystem
  - Promtail : collecte via Docker socket, pipeline JSON pour logs Spring Boot
- [x] **2.8.2** Configurer le backend Spring Boot pour les logs structurés JSON *(logback-spring.xml + dépendances logback-json-classic + logback-jackson)*
- [x] **2.8.3** Configurer Grafana avec datasource Loki *(provisioning/datasources/datasources.yml : Prometheus + Loki)*
- [ ] **2.8.4** Implémenter le distributed tracing (Micrometer Tracing + Zipkin ou Jaeger)
- [ ] **2.8.5** Configurer des alertes Slack/email pour les erreurs critiques
- [ ] **2.8.6** Créer des dashboards Grafana dédiés :
  - Airbnb sync status (succès/erreurs par type)
  - Webhook processing (latence, erreurs, retries)
  - API health (requêtes/s, latence, codes d'erreur)

---

## Phase 3 — Conformité RGPD & Documentation (Semaines 9-10)

> **Objectif :** Assurer la conformité réglementaire et préparer la documentation exigée par Airbnb.

### 3.1 RGPD — Registre des traitements

- [x] **3.1.1** Créer le registre des traitements de données personnelles *(implémenté via `GdprService.getDataCategories()` — 8 catégories : Identité, Authentification, Propriétés, Réservations, Paiements, Intégration Airbnb, Logs d'audit, Consentements. Accessible via `GET /api/gdpr/data-categories`)* :
  | Traitement | Finalité | Base légale | Données | Durée | Destinataires |
  |-----------|----------|-------------|---------|-------|---------------|
  | Gestion des réservations | Exécution du contrat | Contrat | Nom, email, téléphone, dates | 5 ans | Airbnb, équipe ménage |
  | Gestion des interventions | Intérêt légitime | Intérêt légitime | Nom intervenant, adresse propriété | 3 ans | Équipe interne |
  | Facturation | Obligation légale | Obligation légale | Données de paiement (via Stripe) | 10 ans | Stripe, comptable |
  | Analytics | Intérêt légitime | Consentement | Données d'usage anonymisées | 2 ans | Interne |
- [ ] **3.1.2** Nommer un référent RGPD (DPO si obligatoire selon la taille)

### 3.2 RGPD — Droits des utilisateurs

- [x] **3.2.1** Implémenter `GET /api/gdpr/export` — export de toutes les données personnelles *(GdprController + GdprService.exportUserData : données perso, propriétés, consentements, 50 derniers logs d'audit — format JSON structuré pour portabilité Article 20)*
- [x] **3.2.2** Implémenter `POST /api/gdpr/anonymize` — anonymisation irréversible *(GdprService.anonymizeUser : remplace PII par valeurs génériques, statut DELETED, supprime consentements — Article 17)*
- [x] **3.2.3** Implémenter `GET /api/gdpr/consent` — consultation des consentements *(5 types : DATA_PROCESSING, MARKETING, ANALYTICS, THIRD_PARTY_SHARING, COOKIES — versionnés)*
- [x] **3.2.4** Implémenter `PUT /api/gdpr/consent` — modification des consentements *(historique versionné, IP loggée, horodatage — Article 7)*
- [ ] **3.2.5** Ajouter une bannière de consentement cookies/tracking sur le frontend
- [x] **3.2.6** Logger toutes les opérations RGPD dans l'audit trail *(EXPORT, DELETE, UPDATE via AuditLogService)*

### 3.3 Politique de conservation des données

- [x] **3.3.1** Définir et documenter les durées de conservation *(documentées dans GdprService.getDataCategories + DataRetentionService)* :
  | Type de donnée | Durée | Action à expiration |
  |---------------|-------|---------------------|
  | Réservations | 5 ans après checkout | Anonymisation |
  | Données personnelles guests | 3 ans après dernière interaction | Anonymisation |
  | Logs applicatifs | 1 an | Suppression |
  | Audit trail | 2 ans | Suppression (DataRetentionService) |
  | Données de paiement | 10 ans (obligation légale) | Archivage |
  | Messages Airbnb | 2 ans | Anonymisation |
  | Webhook events | 90 jours | Suppression (DataRetentionService) |
- [x] **3.3.2** Implémenter un job schedulé (`@Scheduled`) pour l'anonymisation/suppression automatique *(DataRetentionService : cron 0 0 3 \* \* \* — 3h du matin, 3 politiques : users inactifs > 3 ans, audit logs > 2 ans, webhook events > 90 jours)*
- [ ] **3.3.3** Tester le job sur l'environnement staging

### 3.4 DPA (Data Processing Agreement)

- [ ] **3.4.1** Rédiger le DPA Clenzy (sous-traitant) avec un avocat spécialisé RGPD
- [ ] **3.4.2** Préparer un DPA spécifique pour la relation Clenzy ↔ Airbnb
- [ ] **3.4.3** Lister tous les sous-traitants (AWS/OVH, Stripe, Keycloak hébergeur, etc.)
- [ ] **3.4.4** Rendre le DPA accessible sur le site web de Clenzy

### 3.5 Chiffrement au repos (Article 32 RGPD)

- [x] **3.5.1** Chiffrer les colonnes sensibles en base PostgreSQL :
  - Tokens Airbnb (`access_token_encrypted`, `refresh_token_encrypted`) — via `AirbnbTokenEncryptionService` (AES-256 Jasypt)
  - `users.phone_number` — via `EncryptedFieldConverter` (JPA `@Convert`, AES-256)
  - `gdpr_consents.ip_address` — via `EncryptedFieldConverter` (JPA `@Convert`, AES-256)
- [x] **3.5.2** Utiliser Jasypt Spring Boot pour la gestion des clés *(jasypt-spring-boot-starter, `JASYPT_ENCRYPTOR_PASSWORD` en variable d'environnement)*
- [x] **3.5.3** Créer `EncryptedFieldConverter.java` — JPA AttributeConverter réutilisable pour toute colonne sensible *(supporte migration progressive : fallback si déchiffrement impossible)*
- [x] **3.5.4** Créer `V22__prepare_encrypted_columns.sql` — Migration Flyway pour élargir les colonnes chiffrées (VARCHAR → VARCHAR(500) ou TEXT)
- [ ] **3.5.5** Stocker la master key dans un vault (HashiCorp Vault ou AWS KMS) — *prod uniquement*
- [ ] **3.5.6** Documenter la procédure de rotation des clés de chiffrement

---

## Phase 4 — Documentation & Préparation Audit (Semaines 11-12)

> **Objectif :** Constituer le dossier complet pour la candidature Airbnb et être prêt pour l'audit technique.

### 4.1 Documentation API

- [ ] **4.1.1** Enrichir les annotations OpenAPI sur tous les endpoints :
  - Descriptions détaillées
  - Exemples de requêtes/réponses
  - Codes d'erreur documentés
  - Schémas de données
- [ ] **4.1.2** Créer une documentation d'intégration Airbnb :
  - Diagramme d'architecture
  - Diagrammes de séquence (OAuth flow, webhook flow, sync flow)
  - Guide de connexion pour les propriétaires
- [ ] **4.1.3** Publier la doc API sur un portail dédié (Redoc ou Swagger UI hébergé)

### 4.2 Security Whitepaper

- [ ] **4.2.1** Rédiger le document de sécurité incluant :
  - Architecture de sécurité (schéma)
  - Authentification et autorisation (Keycloak, OAuth2, JWT, RBAC, MFA)
  - Chiffrement (en transit TLS 1.3, au repos AES-256)
  - Gestion des tokens et secrets
  - Rate limiting et protection DDoS
  - Audit trail et logging
  - Gestion des vulnérabilités (OWASP, scans trimestriels)
  - Conformité RGPD
  - Politique de backup et recovery
- [ ] **4.2.2** Joindre les résultats du scan OWASP Top 10
- [ ] **4.2.3** Documenter les certifications et standards suivis

### 4.3 Plan de réponse aux incidents (IRP)

- [ ] **4.3.1** Rédiger l'IRP avec les sections :
  - Définition des niveaux de sévérité :
    - **P1 (Critique)** : Perte de données, faille sécurité active, service down → réponse < 15 min
    - **P2 (Haute)** : Fonctionnalité majeure impactée, sync Airbnb cassée → réponse < 1h
    - **P3 (Moyenne)** : Fonctionnalité mineure impactée → réponse < 4h
    - **P4 (Basse)** : Cosmétique, amélioration → prochaine itération
  - Rôles et responsabilités (qui fait quoi)
  - Procédure d'escalade
  - Communication (interne et externe)
  - Post-mortem template
- [ ] **4.3.2** Configurer les canaux d'alerte (Slack + PagerDuty ou email)
- [ ] **4.3.3** Planifier un exercice de simulation (tabletop exercise)

### 4.4 Procédures internes

- [ ] **4.4.1** Rédiger la procédure de déploiement (dev → staging → prod)
- [ ] **4.4.2** Rédiger la procédure de rollback
- [ ] **4.4.3** Rédiger la procédure d'onboarding développeur
- [ ] **4.4.4** Documenter les standards de code review
- [ ] **4.4.5** Rédiger le runbook opérationnel (astreinte)

### 4.5 Haute disponibilité (Production)

- [ ] **4.5.1** Déployer 2 instances backend derrière un load balancer (Nginx ou HAProxy)
- [ ] **4.5.2** Configurer PostgreSQL streaming replication (1 primary + 1 replica read-only)
- [ ] **4.5.3** Définir le SLA interne : 99.9% uptime (< 8h45 downtime/an)
- [ ] **4.5.4** Mettre en place une page de statut publique
- [ ] **4.5.5** Tester la restauration des backups (PostgreSQL + Keycloak + Redis)

### 4.6 Scans de vulnérabilité trimestriels (Exigence Airbnb)

- [ ] **4.6.1** Automatiser le scan OWASP ZAP dans le pipeline CI/CD (DAST)
- [ ] **4.6.2** Configurer SonarQube pour le scan statique continu (SAST)
- [ ] **4.6.3** Planifier un scan trimestriel complet avec rapport
- [ ] **4.6.4** Mettre en place un processus de patch management (mise à jour des dépendances)

### 4.7 Constitution du dossier Airbnb

- [ ] **4.7.1** Préparer le dossier final contenant :
  - ✅ Security Whitepaper
  - ✅ Résultats scan OWASP Top 10
  - ✅ Documentation API complète
  - ✅ Plan de réponse aux incidents (IRP)
  - ✅ DPA (Data Processing Agreement)
  - ✅ Registre RGPD des traitements
  - ✅ Architecture technique (diagrammes)
  - ✅ Politique de conservation des données
  - ✅ Preuve MFA activé
  - ✅ Preuve chiffrement (transit + repos)
  - ✅ Preuve backups automatiques
  - ✅ Preuve monitoring et alerting
- [ ] **4.7.2** Soumettre la candidature Airbnb Connected Software
- [ ] **4.7.3** Contacter le support global Airbnb via la page Prohost

---

## 📅 Vue calendrier résumée

```
Semaine 1-2  │ 🔒 Sécurité quick wins + TLS + MFA + Backups
Semaine 2-3  │ 🔄 CI/CD GitHub Actions + Monitoring dev/prod
Semaine 3-4  │ 📝 Audit trail + Rate limiting + Staging + OWASP scan
Semaine 5-6  │ 📦 Kafka + Module Airbnb + OAuth 2.0 Airbnb
Semaine 6-7  │ 🔔 Webhooks Airbnb + Consumers Kafka + Logs centralisés
Semaine 7-8  │ 🔌 API endpoints Airbnb + API Gateway + Auto-interventions
Semaine 9-10 │ 📋 RGPD (endpoints + registre + DPA) + Chiffrement au repos
Semaine 11-12│ 📄 Documentation + Security Whitepaper + IRP + HA + Dossier final
```

---

## ⚠️ Risques identifiés

| # | Risque | Impact | Probabilité | Mitigation |
|---|--------|--------|-------------|------------|
| R1 | Airbnb n'accepte plus les candidatures ouvertes (invitation only) | Bloquant | Haute | Contacter le support Prohost, être visible (site pro, présence SaaS, réseau) |
| R2 | Absence de CI/CD bloque l'audit | Bloquant | Certaine | Priorité absolue S1-S3 |
| R3 | Mots de passe en dur dans le code | Faille critique | Certaine | Quick win S1 |
| R4 | Pas de message broker pour le real-time | Architecture inadaptée | Certaine | Kafka en S5 |
| R5 | MFA non activé (exigence explicite Airbnb) | Rejet candidature | Certaine | Keycloak MFA en S2 |
| R6 | Pas d'audit trail | Non-conformité | Certaine | Table audit_log en S3 |
| R7 | Temps de développement sous-estimé | Retard | Moyenne | Buffer de 2 semaines, prioriser les bloquants |
| R8 | API Airbnb change pendant l'intégration | Rework | Faible | Abstraction couche d'intégration, tests automatisés |

---

## 🎯 Critères de succès (Definition of Done)

À la fin des 90 jours, Clenzy doit :

1. ✅ Avoir un pipeline CI/CD fonctionnel avec SAST/DAST
2. ✅ Avoir le MFA activé pour tous les admins/managers
3. ✅ Avoir TLS partout (Nginx, PostgreSQL, Redis)
4. ✅ Avoir un audit trail complet
5. ✅ Avoir Kafka déployé et fonctionnel
6. ✅ Avoir le module Airbnb (OAuth, webhooks, sync) implémenté
7. ✅ Avoir les endpoints RGPD fonctionnels
8. ✅ Avoir passé un scan OWASP sans vulnérabilité critique
9. ✅ Avoir le Security Whitepaper et l'IRP rédigés
10. ✅ Avoir le dossier complet prêt pour soumission à Airbnb
11. ✅ Avoir 3 environnements séparés (dev/staging/prod)
12. ✅ Avoir des backups automatiques testés

---

> **Note :** Ce plan sera mis à jour au fur et à mesure de l'avancement. Chaque tâche cochée sera datée dans le commit correspondant.
