# 🏗️ Plan d'Action Technique — Clenzy PMS × Airbnb Partner

> **Objectif :** Rendre Clenzy conforme aux exigences techniques d'Airbnb pour obtenir le statut de PMS Partner (Connected Software Program).
>
> **Durée estimée :** 90 jours (12 semaines)
>
> **Dernière mise à jour :** 11 février 2026

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
| Monitoring | Actuator + Prometheus + Grafana (profil perf) | ⚠️ Pas en dev/prod |
| Documentation API | SpringDoc OpenAPI / Swagger UI | ⚠️ Basique |
| CI/CD | GitHub Actions (backend + frontend) | ✅ Implemente |
| Message Broker | Aucun | ❌ Critique |
| API Gateway | Aucun (acces backend direct) | ❌ Critique |
| Audit Trail | AuditLog entity + AOP + Service | ✅ Implemente |
| Rate Limiting | Interceptor applicatif + Nginx | ✅ Implemente |
| MFA | Non activé | ❌ Bloquant Airbnb |
| Chiffrement au repos | Non implémenté | ❌ Critique |
| Environnement staging | Inexistant | ❌ Critique |

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

- [ ] **1.2.1** Activer TLS 1.3 sur Nginx (prod + staging)
- [ ] **1.2.2** Activer SSL sur la connexion PostgreSQL (`sslmode=require`)
- [ ] **1.2.3** Activer `requirepass` + TLS sur Redis
- [ ] **1.2.4** Configurer Let's Encrypt avec renouvellement automatique (certbot)
- [ ] **1.2.5** Forcer HTTPS redirect sur toutes les routes

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

- [ ] **1.5.1** Activer Prometheus + Grafana dans le profil `dev` (pas seulement `performance`)
- [ ] **1.5.2** Activer Prometheus + Grafana dans le profil `prod`
- [ ] **1.5.3** Créer un dashboard Grafana "Overview" : requêtes/s, latence p50/p95/p99, erreurs, uptime
- [ ] **1.5.4** Mettre en place un monitoring uptime externe (UptimeRobot ou Blackbox Exporter)

### 1.6 Backups automatiques

- [ ] **1.6.1** Script cron backup PostgreSQL quotidien (`pg_dump` compressé + rotation 30 jours)
- [ ] **1.6.2** Script backup Keycloak (export realm JSON + dump base dédiée)
- [ ] **1.6.3** Backup Redis (vérifier AOF activé + export RDB périodique)
- [ ] **1.6.4** Stocker les backups sur un stockage externe chiffré (S3 ou équivalent)

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

- [ ] **1.9.1** Créer `docker-compose.staging.yml` (copie de prod avec données de test)
- [ ] **1.9.2** Créer `application-staging.yml` (config Spring Boot staging)
- [ ] **1.9.3** Créer `start-staging.sh` / `stop-staging.sh`
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

- [ ] **2.1.1** Ajouter Kafka + Zookeeper (ou KRaft) dans `docker-compose.dev.yml` et `docker-compose.staging.yml`
  ```yaml
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper
  ```
- [ ] **2.1.2** Ajouter `spring-kafka` au pom.xml
- [ ] **2.1.3** Créer les topics Kafka :
  - `airbnb.webhooks.incoming` — événements bruts d'Airbnb
  - `airbnb.reservations.sync` — sync réservations
  - `airbnb.calendar.sync` — sync calendrier
  - `airbnb.messages.sync` — sync messagerie
  - `airbnb.listings.sync` — sync annonces
  - `notifications.send` — notifications internes
  - `audit.events` — événements d'audit
- [ ] **2.1.4** Configurer les producers/consumers Spring Kafka (serialization JSON, error handling, retry)
- [ ] **2.1.5** Implémenter un Dead Letter Topic pour les messages en échec
- [ ] **2.1.6** Ajouter Kafka UI (Conduktor ou kafka-ui) pour le monitoring dev
- [ ] **2.1.7** Remplacer le polling HTTP des notifications par Kafka + WebSocket/SSE (cf. TODO existant)

### 2.2 Module Airbnb Integration

- [ ] **2.2.1** Créer le package `com.clenzy.integration.airbnb` avec la structure :
  ```
  integration/airbnb/
  ├── config/
  │   └── AirbnbConfig.java           -- Configuration (URLs, client ID, scopes)
  ├── controller/
  │   ├── AirbnbOAuthController.java   -- Endpoints OAuth (connect, callback, disconnect)
  │   └── AirbnbWebhookController.java -- Endpoint webhook
  ├── dto/
  │   ├── AirbnbReservation.java
  │   ├── AirbnbCalendarEvent.java
  │   ├── AirbnbListing.java
  │   └── AirbnbMessage.java
  ├── model/
  │   ├── AirbnbConnection.java        -- Entité : connexion OAuth par propriétaire
  │   └── AirbnbWebhookEvent.java      -- Entité : événements webhook bruts
  ├── repository/
  │   ├── AirbnbConnectionRepository.java
  │   └── AirbnbWebhookEventRepository.java
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
- [ ] **2.2.2** Créer les tables PostgreSQL :
  ```sql
  CREATE TABLE airbnb_connection (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    airbnb_user_id VARCHAR(255),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT,
    status VARCHAR(20) DEFAULT 'active',  -- active, revoked, expired
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    UNIQUE(user_id)
  );

  CREATE TABLE airbnb_webhook_event (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    signature VARCHAR(512),
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, processed, failed
    error_message TEXT,
    retry_count INT DEFAULT 0
  );

  CREATE TABLE airbnb_listing_mapping (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL REFERENCES property(id),
    airbnb_listing_id VARCHAR(255) NOT NULL UNIQUE,
    sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

### 2.3 OAuth 2.0 Airbnb

- [ ] **2.3.1** Implémenter `AirbnbOAuthService` :
  - `getAuthorizationUrl()` — génère l'URL de redirection Airbnb
  - `exchangeCodeForToken(code)` — échange le code d'autorisation contre un access token
  - `refreshToken(connectionId)` — rafraîchit le token avant expiration
  - `revokeToken(connectionId)` — révoque le token (déconnexion)
  - `getValidToken(connectionId)` — retourne un token valide (refresh auto si nécessaire)
- [ ] **2.3.2** Chiffrer les tokens en base avec AES-256-GCM (Jasypt ou implémentation custom)
- [ ] **2.3.3** Implémenter un scheduler pour le refresh automatique des tokens (avant expiration)
- [ ] **2.3.4** Endpoints REST :
  - `GET /api/v1/airbnb/connect` — redirige vers Airbnb OAuth
  - `GET /api/v1/airbnb/callback` — callback OAuth (échange code → token)
  - `POST /api/v1/airbnb/disconnect` — déconnecte le compte Airbnb
  - `GET /api/v1/airbnb/status` — statut de la connexion

### 2.4 Webhooks Airbnb

- [ ] **2.4.1** Créer `POST /api/v1/webhooks/airbnb` — endpoint public avec validation de signature
- [ ] **2.4.2** Stocker chaque événement brut dans `airbnb_webhook_event` (audit trail)
- [ ] **2.4.3** Publier l'événement dans le topic Kafka `airbnb.webhooks.incoming`
- [ ] **2.4.4** Créer les consumers Kafka pour traiter chaque type d'événement :
  - `reservation.created` → créer la réservation dans Clenzy + auto-générer intervention ménage
  - `reservation.updated` → mettre à jour la réservation
  - `reservation.cancelled` → annuler la réservation + annuler l'intervention ménage
  - `calendar.updated` → mettre à jour le calendrier
  - `message.received` → stocker le message
- [ ] **2.4.5** Implémenter retry avec exponential backoff (1s, 2s, 4s, 8s, max 5 retries)
- [ ] **2.4.6** Répondre `200 OK` immédiatement (traitement asynchrone via Kafka)

### 2.5 Endpoints API Airbnb (sync bidirectionnelle)

- [ ] **2.5.1** Réservations :
  - `GET /api/v1/airbnb/reservations` — liste des réservations Airbnb
  - `GET /api/v1/airbnb/reservations/{id}` — détail d'une réservation
  - `POST /api/v1/airbnb/reservations/{id}/accept` — accepter une demande
  - `POST /api/v1/airbnb/reservations/{id}/decline` — refuser une demande
- [ ] **2.5.2** Calendrier :
  - `GET /api/v1/airbnb/calendar/{listingId}` — calendrier d'une annonce
  - `PUT /api/v1/airbnb/calendar/{listingId}` — mettre à jour disponibilités + prix
- [ ] **2.5.3** Annonces (Listings) :
  - `GET /api/v1/airbnb/listings` — lister les annonces connectées
  - `POST /api/v1/airbnb/listings/link` — lier une propriété Clenzy à une annonce Airbnb
  - `DELETE /api/v1/airbnb/listings/{id}/unlink` — délier
- [ ] **2.5.4** Messages :
  - `GET /api/v1/airbnb/messages/{reservationId}` — conversation d'une réservation
  - `POST /api/v1/airbnb/messages/{reservationId}` — envoyer un message

### 2.6 Auto-génération des interventions

- [ ] **2.6.1** À chaque nouvelle réservation (Airbnb ou autre), auto-créer une intervention de ménage :
  - Date : jour du check-out
  - Durée estimée : basée sur le nombre de guests et la taille du logement
  - Statut : `scheduled`
  - Assignation : selon les règles de rotation de l'équipe de ménage
- [ ] **2.6.2** À l'annulation d'une réservation, annuler automatiquement l'intervention liée
- [ ] **2.6.3** À la modification de dates, mettre à jour l'intervention automatiquement

### 2.7 API Gateway

- [ ] **2.7.1** Ajouter Spring Cloud Gateway au projet
- [ ] **2.7.2** Configurer le routage vers le backend Clenzy
- [ ] **2.7.3** Intégrer le rate limiting (Bucket4j ou Redis) au niveau du gateway
- [ ] **2.7.4** Centraliser la validation des tokens JWT
- [ ] **2.7.5** Ajouter le request/response logging

### 2.8 Centralisation des logs

- [ ] **2.8.1** Déployer Loki + Grafana (ou ELK Stack) dans l'infra Docker
- [ ] **2.8.2** Configurer le backend Spring Boot pour envoyer les logs à Loki (via Logback appender)
- [ ] **2.8.3** Créer des dashboards Grafana pour :
  - Airbnb sync status (succès/erreurs par type)
  - Webhook processing (latence, erreurs, retries)
  - API health (requêtes/s, latence, codes d'erreur)
- [ ] **2.8.4** Implémenter le distributed tracing (Micrometer Tracing + Zipkin ou Jaeger)
- [ ] **2.8.5** Configurer des alertes Slack/email pour les erreurs critiques

---

## Phase 3 — Conformité RGPD & Documentation (Semaines 9-10)

> **Objectif :** Assurer la conformité réglementaire et préparer la documentation exigée par Airbnb.

### 3.1 RGPD — Registre des traitements

- [ ] **3.1.1** Créer le registre des traitements de données personnelles (fichier ou outil dédié) :
  | Traitement | Finalité | Base légale | Données | Durée | Destinataires |
  |-----------|----------|-------------|---------|-------|---------------|
  | Gestion des réservations | Exécution du contrat | Contrat | Nom, email, téléphone, dates | 5 ans | Airbnb, équipe ménage |
  | Gestion des interventions | Intérêt légitime | Intérêt légitime | Nom intervenant, adresse propriété | 3 ans | Équipe interne |
  | Facturation | Obligation légale | Obligation légale | Données de paiement (via Stripe) | 10 ans | Stripe, comptable |
  | Analytics | Intérêt légitime | Consentement | Données d'usage anonymisées | 2 ans | Interne |
- [ ] **3.1.2** Nommer un référent RGPD (DPO si obligatoire selon la taille)

### 3.2 RGPD — Droits des utilisateurs

- [ ] **3.2.1** Implémenter `GET /api/v1/gdpr/export` — export de toutes les données personnelles d'un utilisateur (format JSON/CSV)
- [ ] **3.2.2** Implémenter `POST /api/v1/gdpr/delete` — suppression/anonymisation des données personnelles
- [ ] **3.2.3** Implémenter `GET /api/v1/gdpr/consent` — consultation des consentements
- [ ] **3.2.4** Implémenter `PUT /api/v1/gdpr/consent` — modification des consentements
- [ ] **3.2.5** Ajouter une bannière de consentement cookies/tracking sur le frontend
- [ ] **3.2.6** Logger toutes les opérations RGPD dans l'audit trail

### 3.3 Politique de conservation des données

- [ ] **3.3.1** Définir et documenter les durées de conservation :
  | Type de donnée | Durée | Action à expiration |
  |---------------|-------|---------------------|
  | Réservations | 5 ans après checkout | Anonymisation |
  | Données personnelles guests | 3 ans après dernière interaction | Suppression |
  | Logs applicatifs | 1 an | Suppression |
  | Audit trail | 2 ans | Archivage puis suppression |
  | Données de paiement | 10 ans (obligation légale) | Archivage |
  | Messages Airbnb | 2 ans | Anonymisation |
- [ ] **3.3.2** Implémenter un job schedulé (`@Scheduled`) pour l'anonymisation/suppression automatique
- [ ] **3.3.3** Tester le job sur l'environnement staging

### 3.4 DPA (Data Processing Agreement)

- [ ] **3.4.1** Rédiger le DPA Clenzy (sous-traitant) avec un avocat spécialisé RGPD
- [ ] **3.4.2** Préparer un DPA spécifique pour la relation Clenzy ↔ Airbnb
- [ ] **3.4.3** Lister tous les sous-traitants (AWS/OVH, Stripe, Keycloak hébergeur, etc.)
- [ ] **3.4.4** Rendre le DPA accessible sur le site web de Clenzy

### 3.5 Chiffrement au repos

- [ ] **3.5.1** Chiffrer les colonnes sensibles en base PostgreSQL :
  - Tokens Airbnb (`access_token_encrypted`, `refresh_token_encrypted`)
  - Données personnelles guests (email, téléphone)
  - Clés API Stripe
- [ ] **3.5.2** Utiliser Jasypt Spring Boot ou Spring Vault pour la gestion des clés
- [ ] **3.5.3** Stocker la master key dans un vault (HashiCorp Vault ou AWS KMS)
- [ ] **3.5.4** Documenter la procédure de rotation des clés de chiffrement

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
