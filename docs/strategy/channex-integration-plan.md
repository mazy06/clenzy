# Plan d'intégration Channex — Channel Manager partenaire

> **Objectif** : connecter Clenzy à 100+ OTAs (Airbnb, Booking.com, Vrbo, etc.) via l'API Channex, sans avoir à devenir Software Partner direct de chaque OTA.
>
> **Délai cible** : 5-6 semaines de dev en parallèle de la prospection.
>
> **Effort** : 1 dev backend + 1 dev frontend, ~25% du temps chacun.

---

## 1. Pourquoi Channex (rappel)

Voir doc `strategie-acquisition.pdf` section 7.1 pour le détail. En résumé :

- **Channex** = société UK qui fournit une API REST unifiée pour pousser prix/dispo vers 100+ OTAs et recevoir les réservations en retour
- **Pricing** : ~£10/bien/mois (~12€) revendable au client final (intégré au plan Pro de Clenzy)
- **API moderne** : REST + webhooks + doc claire (channex.io/docs)
- **Couverture** : Airbnb, Booking.com, Vrbo, Expedia, Agoda, Hotels.com, Tripadvisor, 100+ autres
- **Modèle d'agrément** : Channex est officiellement certifié partner de toutes les OTAs supportées. Tu passes par eux, tu profites de leurs accréditations.

### Alternatives évaluées et écartées

| Alternative | Pourquoi écartée |
|-------------|------------------|
| **Rentals United** | Plus cher (15€/bien), API plus complexe, plus orienté gros volumes |
| **NextPax** | 20€+, enterprise, sur-dimensionné |
| **MyAllocator (Cloudbeds)** | Hôtelier-centric, moins fluide pour STR |
| **Hostex** | Couverture OTA limitée pour le marché EU |
| **Build own** | 12-24 mois de dev, 200-500k€, pas envisageable en pre-revenue |

---

## 2. Architecture cible

### Vue d'ensemble

```
┌────────────────────────────────────────────────────────────┐
│  Clenzy PMS                                                │
│                                                            │
│  ┌──────────────────┐                                      │
│  │ CalendarEngine   │ (existant)                           │
│  │ - CalendarDay    │                                      │
│  └────────┬─────────┘                                      │
│           │                                                │
│  ┌────────▼─────────┐                                      │
│  │ PriceEngine      │ (existant)                           │
│  │ - RateOverride   │                                      │
│  │ - Seasonal       │                                      │
│  │ - Promotional    │                                      │
│  └────────┬─────────┘                                      │
│           │                                                │
│           ▼ events                                         │
│  ┌──────────────────┐                                      │
│  │ Outbox table     │ (existant)                           │
│  └────────┬─────────┘                                      │
│           │                                                │
│           ▼                                                │
│  ┌──────────────────┐                                      │
│  │ Kafka            │ (existant)                           │
│  │ - channel-sync   │                                      │
│  └────────┬─────────┘                                      │
│           │                                                │
│           ▼                                                │
│  ┌──────────────────────────────┐                          │
│  │ ChannexSyncService (NEW)     │                          │
│  │ - pushAvailability()         │                          │
│  │ - pushPricing()              │                          │
│  │ - pushRestrictions()         │                          │
│  └────────┬─────────────────────┘                          │
│           │                                                │
│           ▼ HTTP                                           │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────┐
│  Channex API (channex.io)              │
│  - /api/v1/availabilities              │
│  - /api/v1/rates                       │
│  - /api/v1/restrictions                │
│  - /api/v1/bookings (webhook in)       │
└────────────┬───────────────────────────┘
             │
   ┌─────────┼─────────┐
   ▼         ▼         ▼
┌────────┐┌─────────┐┌────────┐
│ Airbnb ││ Booking ││  Vrbo  │
└────────┘└─────────┘└────────┘
```

### Flux entrant (réservations OTA → Clenzy)

```
Airbnb (résa reçue)
    ↓
Channex (réception + parsing)
    ↓ POST webhook → Clenzy
ChannexWebhookController
    ↓
ChannexBookingService.handleNewBooking()
    ↓
- Mapping OTA reservation → Clenzy Reservation entity
- Lock dates dans CalendarDay
- Create Guest si nouveau
- Trigger NotificationService (email équipe)
    ↓
✅ Réservation visible dans Clenzy en < 30 secondes
```

### Flux sortant (prix/dispo → OTAs)

```
User modifie prix dans Clenzy UI
    ↓
PriceEngine.updateRate(propertyId, dates, amount)
    ↓
Outbox event publié (pricing-changed)
    ↓
Kafka topic clenzy-channel-sync
    ↓
ChannexSyncService.consume()
    ↓ HTTP PUT /api/v1/rates
Channex pushe vers les OTAs connectées
    ↓
✅ Prix mis à jour sur Airbnb/Booking/Vrbo en < 2 min
```

---

## 3. Concepts Channex à maîtriser

Avant de coder, comprendre le modèle de données Channex :

### Property → Room Type → Rate Plan

```
Property (le logement physique — "Studio Marais Paris")
    └── Room Type (catégorie de chambre — "Studio")
            └── Rate Plan (politique tarifaire — "Tarif standard non-remboursable")
                    └── Availability (qty + restrictions par date)
                    └── Rate (prix par date)
```

Pour Clenzy : 1 Property Clenzy = 1 Property Channex = 1 Room Type Channex (qty=1) = 1+ Rate Plans Channex.

### Mapping nécessaire

```sql
-- Nouvelle table de mapping Clenzy ↔ Channex
CREATE TABLE channex_property_mapping (
    id UUID PRIMARY KEY,
    clenzy_property_id BIGINT NOT NULL REFERENCES properties(id),
    channex_property_id VARCHAR(50) NOT NULL,
    channex_room_type_id VARCHAR(50) NOT NULL,
    channex_default_rate_plan_id VARCHAR(50) NOT NULL,
    organization_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending' -- pending, active, error
);

CREATE INDEX idx_channex_mapping_clenzy_prop ON channex_property_mapping(clenzy_property_id);
CREATE INDEX idx_channex_mapping_org ON channex_property_mapping(organization_id);
```

### Channel = connexion OTA

Une Property Channex peut être connectée à plusieurs OTAs (Airbnb + Booking + Vrbo). Chaque connexion = "Channel" Channex. Pour Clenzy, un Channel s'active via l'UI utilisateur.

```sql
CREATE TABLE channex_ota_channels (
    id UUID PRIMARY KEY,
    property_mapping_id UUID NOT NULL REFERENCES channex_property_mapping(id),
    ota_type VARCHAR(30) NOT NULL, -- 'airbnb', 'booking_com', 'vrbo', etc.
    channex_channel_id VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    last_push_at TIMESTAMP,
    last_pull_at TIMESTAMP,
    error_count INT DEFAULT 0,
    last_error_message TEXT
);
```

---

## 4. Roadmap par sprints

### Sprint 1 — Setup et POC (Semaine 1)

**Objectif** : valider que Channex fonctionne avec une property test, sans toucher au code Clenzy en prod.

#### Tasks

- [ ] **Souscrire compte Channex** (channex.io/signup)
  - Demander un environnement sandbox
  - Obtenir API key + webhook secret
  - Documenter les credentials dans 1Password partagé

- [ ] **Lire la doc Channex en intégralité** (channex.io/docs, ~3h)
  - API reference
  - Webhooks
  - Channel-specific guides (Airbnb, Booking.com)

- [ ] **POC Postman / curl**
  - Créer manuellement 1 Property dans Channex sandbox
  - Pousser des prix / dispo via API
  - Recevoir un webhook fictif
  - Valider le format des payloads

- [ ] **Documenter les credentials Channex dans Clenzy config**
  - Ajouter `CHANNEX_API_KEY` et `CHANNEX_WEBHOOK_SECRET` dans `application-{env}.yml`
  - Chiffrement Jasypt comme les autres providers
  - Variables d'env pour Docker

**Livrable** : doc interne `docs/integrations/CHANNEX_SETUP.md` avec les apprentissages

---

### Sprint 2 — Backend : client HTTP + modèles (Semaine 2)

**Objectif** : poser les fondations Java côté Clenzy.

#### Tasks

- [ ] **Créer le package** `com.clenzy.integration.channex`
  ```
  com/clenzy/integration/channex/
  ├── ChannexClient.java           (HTTP REST client)
  ├── ChannexConfig.java           (config Spring)
  ├── ChannexException.java        (custom exception)
  ├── dto/
  │   ├── ChannexPropertyDto.java
  │   ├── ChannexRoomTypeDto.java
  │   ├── ChannexRatePlanDto.java
  │   ├── ChannexAvailabilityDto.java
  │   ├── ChannexRateDto.java
  │   ├── ChannexBookingDto.java
  │   └── ChannexWebhookPayload.java
  └── model/
      └── (entities — déjà ci-dessous)
  ```

- [ ] **Liquibase changeset** `0125__add_channex_tables.sql`
  - Tables `channex_property_mapping` + `channex_ota_channels`
  - Index pertinents
  - Multi-tenant filter via `organization_id`

- [ ] **Entities JPA** `ChannexPropertyMapping`, `ChannexOtaChannel`
  - Avec `@Filter` pour multi-tenancy
  - Repositories Spring Data

- [ ] **ChannexClient** — RestTemplate avec :
  - Authentification Bearer token
  - Pagination automatique (Channex pagine à 100)
  - Retry logic (3 tentatives, backoff exponentiel)
  - Timeout 30s par requête
  - Logging via SLF4J pour debug

  ```java
  @Component
  @RequiredArgsConstructor
  public class ChannexClient {
      private final RestTemplate restTemplate;
      private final ChannexConfig config;

      public ChannexPropertyDto createProperty(CreatePropertyRequest req) {
          String url = config.getBaseUrl() + "/api/v1/properties";
          HttpHeaders headers = authHeaders();
          ResponseEntity<ChannexPropertyDto> response = restTemplate.exchange(
              url, HttpMethod.POST, new HttpEntity<>(req, headers),
              ChannexPropertyDto.class
          );
          return response.getBody();
      }

      public void pushAvailability(String propertyId, List<AvailabilityUpdate> updates) {
          String url = config.getBaseUrl() + "/api/v1/availabilities";
          // ...
      }

      // ...
  }
  ```

- [ ] **Tests unitaires** avec WireMock — couvrir :
  - createProperty success / 4xx / 5xx
  - Retry logic
  - Pagination
  - Erreur de format payload

**Livrable** : `ChannexClient` fonctionnel + 15-20 tests unitaires verts

---

### Sprint 3 — Sync sortant (Semaine 3)

**Objectif** : pousser prix / dispo / restrictions vers Channex automatiquement.

#### Tasks

- [ ] **ChannexSyncService** — orchestrateur
  ```java
  @Service
  public class ChannexSyncService {

      public void pushAvailabilityForProperty(Long propertyId, LocalDate from, LocalDate to) {
          // 1. Récupérer le mapping Clenzy ↔ Channex
          // 2. Récupérer les CalendarDay sur la période
          // 3. Construire AvailabilityUpdate[] pour Channex
          // 4. Appeler ChannexClient.pushAvailability()
          // 5. Mettre à jour last_push_at
      }

      public void pushPricingForProperty(Long propertyId, LocalDate from, LocalDate to) {
          // 1. PriceEngine.resolveAll(propertyId, from, to)
          // 2. Construire RateUpdate[]
          // 3. Appeler ChannexClient.pushRates()
      }

      public void pushRestrictionsForProperty(Long propertyId, LocalDate from, LocalDate to) {
          // 1. RestrictionEngine.resolveAll(...)
          // 2. Appeler ChannexClient.pushRestrictions()
      }
  }
  ```

- [ ] **Consumer Kafka** — réagir aux events du topic `clenzy-channel-sync`
  ```java
  @KafkaListener(topics = "clenzy-channel-sync", groupId = "channex-sync")
  public void consume(ChannelSyncEvent event) {
      switch (event.getType()) {
          case PROPERTY_AVAILABILITY_CHANGED -> channexSyncService.pushAvailability(...);
          case PROPERTY_PRICE_CHANGED -> channexSyncService.pushPricing(...);
          case PROPERTY_RESTRICTION_CHANGED -> channexSyncService.pushRestrictions(...);
      }
  }
  ```

- [ ] **Outbox events** — émettre les events depuis :
  - `CalendarService.blockDates()` / `unblockDates()`
  - `PriceEngine.updateRate()`
  - `RestrictionEngine.update()`

- [ ] **Job de rattrapage** — `@Scheduled` toutes les heures
  - Re-sync les properties avec `last_push_at > 1h`
  - Filet de sécurité si Kafka manque un event

- [ ] **Tests d'intégration** avec Testcontainers (PostgreSQL + Kafka)
  - Scénario : "blocage de dates → push vers Channex"
  - Scénario : "modification prix → push vers Channex"
  - Vérifier idempotence (replay event = même résultat)

**Livrable** : sync sortant fonctionnel sur 1 property test, validé en sandbox Channex

---

### Sprint 4 — Sync entrant (Semaine 4)

**Objectif** : recevoir les réservations depuis les OTAs via webhook Channex.

#### Tasks

- [ ] **ChannexWebhookController**
  ```java
  @RestController
  @RequestMapping("/webhooks/channex")
  public class ChannexWebhookController {

      @PostMapping
      public ResponseEntity<String> handleWebhook(
              @RequestHeader("X-Channex-Signature") String signature,
              @RequestBody String rawBody
      ) {
          // 1. Vérifier la signature HMAC-SHA256
          if (!channexSignatureValidator.isValid(rawBody, signature)) {
              return ResponseEntity.status(401).build();
          }

          // 2. Parser le payload
          ChannexWebhookPayload payload = objectMapper.readValue(rawBody, ...);

          // 3. Dispatcher selon le type
          switch (payload.getType()) {
              case "booking_new" -> channexBookingService.handleNewBooking(payload);
              case "booking_modification" -> channexBookingService.handleModification(payload);
              case "booking_cancellation" -> channexBookingService.handleCancellation(payload);
          }

          return ResponseEntity.ok().build();
      }
  }
  ```

- [ ] **ChannexBookingService**
  ```java
  @Service
  public class ChannexBookingService {

      @Transactional
      public void handleNewBooking(ChannexWebhookPayload payload) {
          // 1. Vérifier que la résa n'existe pas déjà (idempotence sur externalId)
          // 2. Mapper Property Channex → Property Clenzy
          // 3. Créer/récupérer le Guest
          // 4. Créer la Reservation en BDD
          // 5. Bloquer les dates dans CalendarDay
          // 6. Émettre NotificationEvent (email équipe)
          // 7. Si paiement déjà encaissé chez OTA → créer transaction PAID
      }
  }
  ```

- [ ] **Sécurité webhook**
  - Validation HMAC-SHA256 du body avec le webhook secret
  - Constant-time comparison (anti timing attack)
  - Vérification du timestamp (rejet > 5 min)
  - Whitelist IP Channex (optionnel)

- [ ] **Gestion des erreurs**
  - Si payload corrompu → 400 (Channex retentera)
  - Si signature invalide → 401 (ne pas retenter, alert)
  - Si exception logique → log + DLQ (dead letter queue)

- [ ] **Tests d'intégration**
  - Webhook new booking → reservation créée
  - Webhook modification → reservation modifiée
  - Webhook cancellation → reservation annulée + dates libérées
  - Webhook avec signature invalide → 401
  - Webhook duplicate → idempotent

**Livrable** : flux entrant fonctionnel, testé avec un faux booking envoyé via Postman

---

### Sprint 5 — UI onboarding (Semaine 5)

**Objectif** : permettre à un utilisateur Clenzy de connecter ses biens à Channex via l'UI.

#### Tasks

- [ ] **Page Settings → Channel Manager**
  - Section `client/src/modules/settings/ChannelManagerSettings.tsx`
  - Liste des propriétés Clenzy
  - Bouton "Connecter à Channex" par propriété
  - Statut visuel (✓ connecté / ⏳ en cours / ❌ erreur)

- [ ] **Wizard de mapping**
  - Étape 1 : créer la Property dans Channex (auto)
  - Étape 2 : choisir les OTAs à activer (Airbnb + Booking + Vrbo cases à cocher)
  - Étape 3 : confirmer le mapping
  - Étape 4 : push initial (prix + dispo des 6 prochains mois)

- [ ] **Composant `OtaChannelCard.tsx`**
  - Logo OTA + statut + bouton activer/désactiver
  - Lien vers le dashboard Channex pour debug
  - Compteur d'erreurs récentes

- [ ] **Endpoint API** :
  - `POST /api/properties/{id}/channex/connect` — créer mapping
  - `POST /api/properties/{id}/channex/disconnect` — supprimer
  - `POST /api/properties/{id}/channex/ota-channels` — activer un channel
  - `GET /api/properties/{id}/channex/status` — état actuel

- [ ] **Notifications utilisateur**
  - Success : "Propriété connectée à Channex, sync initial en cours..."
  - Error : "Erreur lors de la connexion, voir détails"
  - Banner si erreurs Channex récentes

**Livrable** : un utilisateur peut connecter une property à Channex en 3 clics

---

### Sprint 6 — Tests E2E + production (Semaine 6)

**Objectif** : valider en conditions réelles + déployer en prod avec un design partner pilote.

#### Tasks

- [ ] **Tests E2E Playwright**
  - Scénario complet : "connecter property → publier sur Airbnb sandbox → recevoir résa → la voir dans Clenzy"

- [ ] **Documentation utilisateur**
  - Page `docs/integrations/CHANNEX_USER_GUIDE.md`
  - Tutoriel vidéo Loom de 5 min

- [ ] **Monitoring**
  - Métriques Prometheus : `channex_sync_success_total`, `channex_sync_errors_total`, `channex_sync_latency_seconds`
  - Dashboard Grafana dédié
  - Alerte si taux d'erreur > 5%

- [ ] **Migration en production**
  - Liquibase changeset déployé (auto au boot Spring Boot)
  - Variables d'env Channex en prod
  - Feature flag `clenzy.channex.enabled` (off par défaut, on pour beta clients)

- [ ] **Pilote avec 1 design partner**
  - Choisir le DP le plus tech-friendly
  - Connecter ses 5-10 biens
  - Monitoring intensif pendant 2 semaines
  - Récolter feedback

**Livrable** : Channex en prod, 1 client pilote, dashboard de monitoring opérationnel

---

## 5. Tarification et marge

### Coût Channex pour Clenzy

| Tier Channex | Biens | Coût |
|--------------|-------|------|
| Free trial | 0-5 | 0€ |
| Starter | 1-25 | £10/bien/mois |
| Growth | 26-100 | £8/bien/mois |
| Pro | 100-500 | £6/bien/mois |
| Enterprise | 500+ | sur devis |

### Revente au client final

Inclure Channex dans le plan Pro de Clenzy :

```
Plan Pro = 39€/bien/mois (Clenzy)
+ 12€/bien/mois (coût Channex)
─────────────────
= Coût total 51€/bien/mois

Revente client = 39€/bien/mois (positionnement public)
Marge brute = 39€ - 12€ = 27€/bien/mois
Marge % = 69%
```

Alternative : **plan "Pro+" à 49€/bien/mois** incluant le Channel Manager. Marge sur le Pro+ = 49€ - 12€ = 37€/bien/mois (76% de marge). Le Pro reste à 39€ sans Channel Manager pour les clients qui n'en ont pas besoin (pro hosts solo).

---

## 6. Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Channex API down | Pas de sync OTA pendant l'incident | Retry queue + job de rattrapage horaire |
| Mapping Property erroné | Prix/dispo incorrects sur OTAs | Validation à la création + monitoring |
| Webhook secret leak | Faux booking injecté | Rotation des secrets tous les 6 mois |
| Channex change ses API | Sync casse | Version-pin l'API, suivre changelog Channex |
| Tarif Channex augmente | Marge réduite | Renégocier annuellement, alternative Rentals United |
| OTA refuse la sync | Property non visible | Channex gère le contact avec l'OTA, fallback iCal |
| Volume excessif (rate limit) | Erreurs 429 | Implémenter rate limiter + backoff |

---

## 7. Roadmap post-MVP (M+6 à M+18)

Une fois l'intégration Channex stable et 10+ clients connectés :

### Phase 2 — Postuler Software Partner direct (M+6 à M+12)

- **Airbnb Software Partner Program** (https://www.airbnb.com/partner)
  - Conditions : 25+ propriétés gérées, audit technique
  - Bénéfices : API native (messaging, dispute, statistiques), zéro fee
  - Délai : 6-12 mois certification

- **Booking.com Connectivity Partner**
  - Conditions : 10+ propriétés, contrat
  - Bénéfices : API directe sans Channex, marge meilleure
  - Délai : 3-6 mois

### Phase 3 — Migration progressive (M+12 à M+24)

- Garder Channex pour les OTAs longue traîne (HomeToGo, Trip.com, MENA OTAs)
- Utiliser les API directes pour les top 3 (Airbnb, Booking, Vrbo)
- Économie : passer de 12€/bien Channex à 4€/bien (longue traîne uniquement)

### Phase 4 — Devenir provider Channel Manager pour autres SaaS (M+24+)

- Si tu maîtrises tellement bien les API OTAs que ton intégration est meilleure qu'Channex
- Tu peux exposer ton Channel Manager comme API à d'autres SaaS (white-label)
- Modèle économique : 5-10€/bien revendu

---

## 8. Checklist de lancement

À cocher avant d'annoncer la feature aux clients :

- [ ] Channex sandbox testé end-to-end
- [ ] 15+ tests unitaires + 5+ tests d'intégration passent
- [ ] Tests E2E Playwright sur scénario complet
- [ ] Documentation utilisateur publiée
- [ ] Vidéo Loom de 5 min disponible
- [ ] Dashboard Grafana monitoring en place
- [ ] Alertes configurées (erreur > 5%)
- [ ] Feature flag activable par tenant
- [ ] Pilote avec 1 design partner réussi sur 2 semaines
- [ ] FAQ utilisateur écrite (10 questions courantes)
- [ ] Support : tu peux résoudre 80% des problèmes en < 1h
- [ ] Pricing décidé et affiché sur la landing
- [ ] Annonce LinkedIn préparée (avec témoignage du pilote)

---

## 9. Liens utiles

- **Channex** : https://channex.io
- **Documentation API** : https://docs.channex.io
- **API Reference** : https://docs.channex.io/api-reference
- **Support Channex** : support@channex.io
- **Status page** : https://status.channex.io
- **Changelog API** : https://docs.channex.io/changelog
- **Comparaison vs concurrents (Channex side)** : https://channex.io/vs-rentals-united

---

## En résumé

5-6 semaines de dev pour débloquer le marché conciergerie. Architecture propre via Channex (pas de dette à rembourser). Marge 69-76% selon le plan. Roadmap Software Partner Airbnb / Booking.com posée pour M+6 à M+12.

**Prochaine action concrète** : créer le compte Channex sandbox (channex.io/signup) et valider le POC sur 1 property test. ~3h.
