# Plan de Certification Partenaire API Airbnb

> Programme complet de preparation a la certification technique et operationnelle
> pour l'acces API Channel Manager partenaire Airbnb.
>
> **Version** : 1.0
> **Date** : 2026-02-21
> **Statut** : Draft
> **Auteur** : Architecture Team Clenzy

---

## Table des matieres

1. [Vue d'ensemble](#vue-densemble)
2. [Niveau 1 — Stabilite fonctionnelle du PMS](#niveau-1--stabilite-fonctionnelle-du-pms)
3. [Niveau 2 — Moteur calendrier transactionnel](#niveau-2--moteur-calendrier-transactionnel)
4. [Niveau 3 — Infrastructure synchronisation interne](#niveau-3--infrastructure-synchronisation-interne)
5. [Niveau 4 — Gestion conflits distribues](#niveau-4--gestion-conflits-distribues)
6. [Niveau 5 — Moteur de mapping abstrait](#niveau-5--moteur-de-mapping-abstrait)
7. [Niveau 6 — Observabilite systeme complete](#niveau-6--observabilite-systeme-complete)
8. [Niveau 7 — Securite niveau entreprise](#niveau-7--securite-niveau-entreprise)
9. [Niveau 8 — Scalabilite et haute disponibilite](#niveau-8--scalabilite-et-haute-disponibilite)
10. [Niveau 9 — Strategie tests automatises](#niveau-9--strategie-tests-automatises)
11. [Niveau 10 — Preuves d'usage production reel](#niveau-10--preuves-dusage-production-reel)
12. [Niveau 11 — Documentation technique complete](#niveau-11--documentation-technique-complete)
13. [Niveau 12 — Outils support et diagnostic](#niveau-12--outils-support-et-diagnostic)
14. [Niveau 13 — Integrite donnees et audit](#niveau-13--integrite-donnees-et-audit)
15. [Niveau 14 — KPI techniques cibles](#niveau-14--kpi-techniques-cibles)
16. [Niveau 15 — Environnement test et staging](#niveau-15--environnement-test-et-staging)
17. [Niveau 16 — Checklist certification readiness](#niveau-16--checklist-certification-readiness)
18. [Livrable final — Synthese](#livrable-final--synthese)

---

## Vue d'ensemble

### Objectif

Maximiser les chances d'acceptation comme partenaire officiel Airbnb en demontrant que le PMS est :

- **Stable** : aucune regression fonctionnelle, uptime > 99.9%
- **Fiable** : zero perte de reservation, zero divergence inventaire
- **Transactionnel** : atomicite garantie sur toutes les operations calendrier
- **Scalable** : architecture stateless, horizontal scaling valide
- **Securise** : isolation multi-tenant, chiffrement, RBAC, pentest
- **Utilise en production reelle** : clients actifs, historique verifiable
- **Capable de synchroniser un inventaire en temps reel** sans incoherence

### Architecture cible globale

```
+---------------------------------------------------------------------------+
|                        CDN (CloudFront) + WAF                             |
+-------------------------------------+-------------------------------------+
                                      |
+-------------------------------------v-------------------------------------+
|                     Load Balancer (ALB / Nginx)                           |
|                     TLS 1.3 termination                                   |
+--------+---------------------------+---------------------------+----------+
         |                           |                           |
+--------v--------+         +--------v--------+         +--------v--------+
|  PMS API #1     |         |  PMS API #2     |         |  PMS API #N     |
|  (Spring Boot)  |         |  (Spring Boot)  |         |  (Spring Boot)  |
|  Stateless      |         |  Stateless      |         |  Stateless      |
+--------+--------+         +--------+--------+         +--------+--------+
         |                           |                           |
         +-------------+-------------+-------------+-------------+
                       |                           |
            +----------v----------+     +----------v----------+
            |   Redis Cluster     |     |   Kafka Cluster     |
            |   (cache, sessions, |     |   (events, sync,    |
            |    tenant cache)    |     |    outbox drain)     |
            +----------+----------+     +----------+----------+
                       |                           |
            +----------v---------------------------v----------+
            |           PostgreSQL Cluster                     |
            |   Primary (writes) + Read Replicas (reads)      |
            |   + pgBouncer (connection pooling)               |
            +----------------------------+--------------------+
                                         |
                              +----------v----------+
                              |   Object Storage    |
                              |   (S3 / MinIO)      |
                              |   Photos, docs,     |
                              |   backups           |
                              +---------------------+
```

### Timeline estimee

| Phase | Duree | Focus |
|-------|-------|-------|
| Phase 1 | 4 semaines | Niveaux 1-2 : Stabilisation fonctionnelle + calendrier transactionnel |
| Phase 2 | 3 semaines | Niveaux 3-4 : Event-driven + gestion conflits |
| Phase 3 | 3 semaines | Niveaux 5-6 : Mapping abstrait + observabilite |
| Phase 4 | 2 semaines | Niveaux 7-8 : Securite + scalabilite |
| Phase 5 | 3 semaines | Niveaux 9-10 : Tests automatises + preuve production |
| Phase 6 | 2 semaines | Niveaux 11-16 : Documentation + staging + checklist |
| **Total** | **~17 semaines** | **~4 mois de travail intensif** |

---

## Niveau 1 — Stabilite fonctionnelle du PMS

### Objectifs

Demontrer que le PMS couvre l'integralite du cycle de vie d'une location courte duree, de la creation du bien jusqu'au checkout, avec une coherence transactionnelle absolue. Airbnb evalue la maturite fonctionnelle avant tout acces API : un PMS incomplet ou instable sera rejete immediatement.

### Architecture requise

**Modele de donnees immobilier hierarchique :**

```
Organization (tenant)
  +-- Portfolio (groupe de biens)
       +-- Property (bien physique : immeuble, maison)
            +-- Unit (unite reservable : appartement, chambre)
                 |-- UnitType (typologie : studio, T2, villa)
                 |-- UnitAmenity[] (equipements)
                 |-- UnitMedia[] (photos, videos, plans)
                 |-- UnitAddress (adresse normalisee + geocoding)
                 +-- UnitCapacity (adultes, enfants, bebes, max)
```

### Fonctionnalites obligatoires

#### 1.1 Gestion immobiliere complete

**Multi-proprietes / Multi-unites :**

- Modele `Property` avec relation `@ManyToOne` vers `Organization` (tenant isolation via Hibernate Filter)
- Modele `Unit` avec `@ManyToOne` vers `Property`, index composite `(property_id, unit_code)` unique
- Pagination serveur obligatoire : tout endpoint listant des proprietes/unites doit supporter `page`, `size`, `sort` avec limite max 100 items
- Recherche full-text sur nom, adresse, code interne via index PostgreSQL GIN/tsvector

**Typologie logements :**

- Enum `UnitType` couvrant au minimum : `ENTIRE_HOME`, `PRIVATE_ROOM`, `SHARED_ROOM`, `HOTEL_ROOM` (mapping direct vers Airbnb `property_type`)
- Table `unit_type_attributes` pour stocker les attributs specifiques par type (surface, nombre pieces, etage)
- Validation metier : une `SHARED_ROOM` ne peut pas avoir `entire_place = true`

**Capacite :**

- Champs obligatoires : `max_guests`, `adults_max`, `children_max`, `infants_max`, `beds_count`, `bedrooms_count`, `bathrooms_count`
- Contrainte CHECK : `adults_max + children_max <= max_guests`
- Detail literie : table `unit_beds` avec type (`KING`, `QUEEN`, `SINGLE`, `SOFA_BED`, `AIR_MATTRESS`), quantite, piece associee

**Equipements :**

- Table `amenities` avec code standardise mappable vers Airbnb amenity IDs
- Relation `unit_amenities` (many-to-many) avec champ `quantity` et `notes`
- Minimum 100 amenities pre-chargees correspondant au catalogue Airbnb
- Synchronisation bidirectionnelle : si un amenity est ajoute sur Airbnb, le PMS doit pouvoir l'importer

**Adresses normalisees :**

- Champs structures : `street`, `street2`, `city`, `state`, `postal_code`, `country_code` (ISO 3166-1 alpha-2)
- Coordonnees GPS : `latitude`, `longitude` (DECIMAL(10,8) et DECIMAL(11,8))
- Validation via geocoding API (Google Maps ou Mapbox) au moment de la saisie
- Contrainte : pas de propriete sans adresse validee et geocodee

**Medias :**

- Table `unit_media` : `type` (PHOTO, VIDEO, FLOOR_PLAN), `url`, `caption`, `sort_order`, `width`, `height`, `size_bytes`
- Stockage S3/MinIO avec CDN CloudFront devant
- Validation obligatoire : format (JPEG/PNG/WebP), dimensions minimales (1024x683 pour Airbnb), poids max 20MB
- Photo principale obligatoire (`is_primary = true`, exactement une par unite)
- Minimum 5 photos par unite pour etre publiable sur Airbnb

#### 1.2 Gestion calendrier robuste

**Schema de donnees :**

```sql
CREATE TABLE calendar_days (
    id BIGSERIAL PRIMARY KEY,
    unit_id BIGINT NOT NULL REFERENCES units(id),
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    -- AVAILABLE, BLOCKED_MANUAL, BLOCKED_AUTO, RESERVED, MAINTENANCE
    price_cents BIGINT,
    min_stay INTEGER DEFAULT 1,
    max_stay INTEGER,
    closed_to_arrival BOOLEAN DEFAULT FALSE,
    closed_to_departure BOOLEAN DEFAULT FALSE,
    notes TEXT,
    source VARCHAR(50), -- PMS, AIRBNB, BOOKING, MANUAL, ICAL
    reservation_id BIGINT REFERENCES reservations(id),
    version BIGINT NOT NULL DEFAULT 0, -- optimistic locking
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    organization_id BIGINT NOT NULL,
    UNIQUE(unit_id, date)
);

CREATE INDEX idx_calendar_unit_date ON calendar_days(unit_id, date);
CREATE INDEX idx_calendar_unit_range ON calendar_days(unit_id, date, status);
CREATE INDEX idx_calendar_org ON calendar_days(organization_id);
```

**Performance grands volumes :**

- Pre-generation des jours a J+730 (2 ans) pour chaque unite
- Batch INSERT/UPDATE via `VALUES ... ON CONFLICT (unit_id, date) DO UPDATE`
- Query optimisee pour recuperer un range : `WHERE unit_id = ? AND date BETWEEN ? AND ?` (index couvrant)
- Pour 1000 unites x 730 jours = 730 000 lignes : temps de reponse < 50ms pour un range de 90 jours
- Partitionnement par date si > 5M lignes : `PARTITION BY RANGE (date)`

**Vue consolidee multi-logements :**

- Endpoint `/api/calendar/consolidated?unit_ids=1,2,3&from=2026-01-01&to=2026-03-31`
- Reponse groupee par unite, avec agregation : taux occupation, revenu estime, jours bloques
- Cache Redis avec TTL 60s, invalide par evenement calendrier

**Blocages :**

- Blocage manuel : utilisateur pose un blocage avec motif obligatoire (`OWNER_USE`, `MAINTENANCE`, `OTHER`)
- Blocage automatique : declenche par reservation confirmee, synchronisation iCal, ou regle metier (ex: buffer day entre reservations)
- Chaque blocage cree un `CalendarEvent` auditable avec `source`, `actor_id`, `timestamp`

#### 1.3 Gestion prix avancee

**Schema tarifaire :**

```sql
CREATE TABLE rate_plans (
    id BIGSERIAL PRIMARY KEY,
    unit_id BIGINT NOT NULL REFERENCES units(id),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(30) NOT NULL, -- BASE, SEASONAL, PROMOTIONAL, LAST_MINUTE
    priority INTEGER NOT NULL DEFAULT 0,
    base_price_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    start_date DATE,
    end_date DATE,
    days_of_week INTEGER[], -- {1,2,3,4,5} = lun-ven, null = tous
    min_stay_override INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    organization_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE rate_overrides (
    id BIGSERIAL PRIMARY KEY,
    unit_id BIGINT NOT NULL REFERENCES units(id),
    date DATE NOT NULL,
    price_cents BIGINT NOT NULL,
    source VARCHAR(50) NOT NULL, -- MANUAL, DYNAMIC_PRICING, CHANNEL_SYNC
    created_by BIGINT,
    organization_id BIGINT NOT NULL,
    UNIQUE(unit_id, date)
);
```

**Resolution de prix (ordre de priorite) :**

1. `rate_overrides` pour la date specifique (prix fixe ecrase)
2. `rate_plans` de type PROMOTIONAL actif avec la plus haute priorite
3. `rate_plans` de type SEASONAL correspondant a la periode
4. `rate_plans` de type BASE (fallback)

**Modifications massives :**

- Endpoint `PUT /api/rates/bulk` acceptant un payload de type :

```json
{
  "unit_ids": [1, 2, 3],
  "date_range": { "from": "2026-06-01", "to": "2026-08-31" },
  "days_of_week": [5, 6],
  "price_cents": 15000,
  "min_stay": 3
}
```

- Traitement dans une transaction unique, max 10 000 jours par requete
- Reponse avec `affected_count` et `conflicts` (dates deja reservees non modifiables)

**Historisation :**

- Table `rate_audit_log` avec `old_value`, `new_value`, `changed_by`, `changed_at`, `source`
- Retention 2 ans minimum (exigence legale + Airbnb audit trail)

#### 1.4 Restrictions de reservation

**Schema :**

```sql
CREATE TABLE booking_restrictions (
    id BIGSERIAL PRIMARY KEY,
    unit_id BIGINT NOT NULL REFERENCES units(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    min_stay INTEGER,
    max_stay INTEGER,
    closed_to_arrival BOOLEAN DEFAULT FALSE,
    closed_to_departure BOOLEAN DEFAULT FALSE,
    gap_days INTEGER DEFAULT 0,
    advance_notice_days INTEGER,
    preparation_time_hours INTEGER,
    days_of_week INTEGER[],
    priority INTEGER DEFAULT 0,
    organization_id BIGINT NOT NULL
);
```

**Validation metier :**

- A chaque tentative de reservation, le moteur verifie TOUTES les restrictions applicables
- Ordre : restriction specifique date > restriction jour semaine > restriction globale unite
- Le `gap_days` bloque automatiquement N jours apres chaque checkout (pas de reservation possible)
- `advance_notice_days` : empeche reservation si `check_in - now() < advance_notice_days`

#### 1.5 Gestion reservations transactionnelle

**Schema reservation :**

```sql
CREATE TABLE reservations (
    id BIGSERIAL PRIMARY KEY,
    confirmation_code VARCHAR(20) NOT NULL UNIQUE,
    unit_id BIGINT NOT NULL REFERENCES units(id),
    guest_id BIGINT REFERENCES guests(id),
    channel VARCHAR(30) NOT NULL, -- DIRECT, AIRBNB, BOOKING, VRBO
    channel_reservation_id VARCHAR(100),
    status VARCHAR(30) NOT NULL,
    -- PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests_count INTEGER NOT NULL,
    adults INTEGER NOT NULL,
    children INTEGER DEFAULT 0,
    infants INTEGER DEFAULT 0,
    total_price_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    nightly_prices JSONB,
    cancellation_policy VARCHAR(50),
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    special_requests TEXT,
    internal_notes TEXT,
    source_ip VARCHAR(45),
    organization_id BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (check_out > check_in),
    CHECK (guests_count > 0),
    CHECK (total_price_cents >= 0)
);

CREATE INDEX idx_res_unit_dates ON reservations(unit_id, check_in, check_out)
    WHERE status NOT IN ('CANCELLED', 'NO_SHOW');
CREATE INDEX idx_res_channel ON reservations(channel, channel_reservation_id);
CREATE INDEX idx_res_org ON reservations(organization_id);
CREATE INDEX idx_res_status ON reservations(status);
```

**Machine a etats des reservations :**

```
PENDING --> CONFIRMED --> CHECKED_IN --> CHECKED_OUT
   |            |             |
   v            v             v
CANCELLED   CANCELLED      NO_SHOW
```

Transitions autorisees encodees dans un `ReservationStateMachine` :

- `PENDING -> CONFIRMED` : paiement valide ou confirmation manuelle
- `CONFIRMED -> CANCELLED` : annulation avant check-in (avec politique)
- `CONFIRMED -> CHECKED_IN` : arrivee effective du guest
- `CHECKED_IN -> CHECKED_OUT` : depart
- `CHECKED_IN -> NO_SHOW` : non-presentation (automatique J+1 si pas de check-in)
- Toute transition non listee leve `IllegalStateTransitionException`

**Atomicite anti-double reservation :**

```java
@Transactional(isolation = Isolation.SERIALIZABLE)
public Reservation createReservation(CreateReservationRequest req) {
    // 1. Verifier disponibilite avec SELECT FOR UPDATE
    List<CalendarDay> days = calendarRepository
        .findByUnitIdAndDateBetweenForUpdate(
            req.unitId, req.checkIn, req.checkOut.minusDays(1));

    boolean hasConflict = days.stream()
        .anyMatch(d -> d.getStatus() != CalendarStatus.AVAILABLE);
    if (hasConflict) {
        throw new UnitNotAvailableException(req.unitId, req.checkIn, req.checkOut);
    }

    // 2. Valider restrictions
    restrictionEngine.validate(
        req.unitId, req.checkIn, req.checkOut, req.guestsCount);

    // 3. Calculer prix
    PriceCalculation pricing = priceEngine.calculate(
        req.unitId, req.checkIn, req.checkOut);

    // 4. Creer reservation
    Reservation reservation = Reservation.builder()
        .confirmationCode(codeGenerator.generate())
        .unitId(req.unitId)
        .checkIn(req.checkIn)
        .checkOut(req.checkOut)
        .totalPriceCents(pricing.totalCents())
        .nightlyPrices(pricing.nightlyBreakdown())
        .status(ReservationStatus.PENDING)
        .build();
    reservationRepository.save(reservation);

    // 5. Bloquer calendrier atomiquement
    calendarService.blockRange(
        req.unitId, req.checkIn, req.checkOut,
        CalendarStatus.RESERVED, reservation.getId());

    // 6. Emettre evenement
    eventPublisher.publish(new ReservationCreatedEvent(reservation));

    return reservation;
}
```

Le `SELECT FOR UPDATE` sur `calendar_days` est le verrou critique : il empeche deux transactions concurrentes de reserver les memes dates. PostgreSQL avec `SERIALIZABLE` levera une `SerializationFailureException` si un conflit est detecte, declenchant un retry automatique (voir Niveau 3).

**Gestion clients (Guests) :**

```sql
CREATE TABLE guests (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255),
    phone VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    language VARCHAR(5) DEFAULT 'fr',
    country_code VARCHAR(2),
    channel_guest_id VARCHAR(100),
    channel VARCHAR(30),
    notes TEXT,
    total_stays INTEGER DEFAULT 0,
    total_spent_cents BIGINT DEFAULT 0,
    organization_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- Dedoublonnage par `(email, organization_id)` ou `(channel, channel_guest_id)`
- Donnees PII chiffrees au repos (AES-256 via Jasypt ou Vault Transit)

**Gestion paiements :**

```sql
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    reservation_id BIGINT NOT NULL REFERENCES reservations(id),
    type VARCHAR(30) NOT NULL, -- DEPOSIT, BALANCE, REFUND, SECURITY_DEPOSIT
    status VARCHAR(30) NOT NULL, -- PENDING, COMPLETED, FAILED, REFUNDED
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    provider VARCHAR(30), -- STRIPE, MANUAL, AIRBNB_COLLECT
    provider_payment_id VARCHAR(100),
    paid_at TIMESTAMP,
    organization_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- Pour Airbnb : les paiements sont geres par Airbnb (`AIRBNB_COLLECT`), le PMS ne touche pas a l'argent
- Pour les reservations directes : integration Stripe

### Criteres de validation

| Critere | Seuil | Methode de test |
|---------|-------|-----------------|
| Creation propriete + unite complete | < 2 min UX | Test E2E Playwright |
| Aucune reservation sans adresse valide | 0 exception | Test unitaire + contrainte DB |
| Anti-double reservation | 0 conflit non detecte | Test concurrent 50 threads |
| Modification prix bulk 1000 jours | < 3s | Test de charge |
| Calendrier 90 jours, 100 unites | < 200ms | Test perf avec index explain |
| Machine a etats reservation | 0 transition invalide | Test exhaustif toutes combinaisons |
| Historisation prix | 100% des changements traces | Audit log count vs change count |

### Risques si absent

- **Rejet immediat** de la candidature : Airbnb verifie que le PMS gere nativement les reservations, le calendrier, et les prix. Un PMS qui delegue tout au channel manager n'est pas un PMS.
- Double reservations = radiation definitive du programme partenaire.

### Livrables attendus

- [ ] Schema de donnees complet (DDL) pour properties, units, calendar_days, reservations, guests, payments
- [ ] API REST CRUD pour chaque entite avec pagination
- [ ] Moteur de validation des restrictions
- [ ] Moteur de calcul de prix avec resolution par priorite
- [ ] Machine a etats des reservations
- [ ] Tests unitaires couvrant 100% des transitions et validations

---

## Niveau 2 — Moteur calendrier transactionnel

### Objectifs

Garantir que le calendrier est la source de verite unique et transactionnellement coherente, capable de gerer des ecritures concurrentes multi-sources (UI utilisateur, API Airbnb, iCal import, pricing engine) sans jamais perdre ou corrompre de donnees.

### Architecture requise

**Pattern : Calendar as Write-Ahead Log**

Chaque modification du calendrier passe par un `CalendarCommand` persiste AVANT application :

```sql
CREATE TABLE calendar_commands (
    id BIGSERIAL PRIMARY KEY,
    command_type VARCHAR(30) NOT NULL,
    -- UPDATE_AVAILABILITY, UPDATE_PRICE, BLOCK_RANGE, UNBLOCK_RANGE, SYNC_FROM_CHANNEL
    unit_id BIGINT NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    payload JSONB NOT NULL,
    source VARCHAR(50) NOT NULL, -- UI, API, AIRBNB_SYNC, ICAL, SYSTEM
    actor_id BIGINT,
    idempotency_key VARCHAR(100) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING, APPLIED, FAILED, ROLLED_BACK
    applied_at TIMESTAMP,
    error_message TEXT,
    organization_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Mecanismes internes necessaires

#### Gestion de concurrence

```java
@Service
public class CalendarEngine {

    /**
     * Toute ecriture calendrier passe par cette methode.
     * Utilise un advisory lock PostgreSQL par unit_id pour serialiser
     * les ecritures sur la meme unite sans bloquer les autres.
     */
    @Transactional
    public CalendarCommandResult execute(CalendarCommand command) {
        // 1. Acquerir advisory lock sur l'unite (non bloquant entre unites)
        boolean locked = jdbcTemplate.queryForObject(
            "SELECT pg_try_advisory_xact_lock(?)",
            Boolean.class, command.getUnitId());
        if (!locked) {
            throw new CalendarConcurrencyException(
                "Unit " + command.getUnitId()
                + " is being modified by another transaction");
        }

        // 2. Persister la commande (write-ahead)
        CalendarCommand saved = commandRepository.save(command);

        // 3. Appliquer les changements
        try {
            switch (command.getType()) {
                case UPDATE_AVAILABILITY -> applyAvailabilityUpdate(command);
                case UPDATE_PRICE -> applyPriceUpdate(command);
                case BLOCK_RANGE -> applyBlockRange(command);
                case SYNC_FROM_CHANNEL -> applySyncFromChannel(command);
            }
            saved.setStatus(CommandStatus.APPLIED);
            saved.setAppliedAt(Instant.now());
        } catch (Exception e) {
            saved.setStatus(CommandStatus.FAILED);
            saved.setErrorMessage(e.getMessage());
            throw e;
        }

        // 4. Emettre evenement pour propagation
        eventPublisher.publish(new CalendarUpdatedEvent(
            command.getUnitId(),
            command.getDateFrom(),
            command.getDateTo(),
            command.getSource()));

        return new CalendarCommandResult(saved);
    }
}
```

**Pourquoi `pg_try_advisory_xact_lock` plutot que `SELECT FOR UPDATE` :**

- `SELECT FOR UPDATE` verrouille les lignes existantes mais ne protege pas contre les INSERTs concurrents
- Advisory lock sur `unit_id` serialise TOUTES les operations calendrier d'une unite
- Le lock est libere automatiquement en fin de transaction (pas de risque de lock orphelin)
- Les operations sur des unites differentes restent paralleles

#### Gestion fuseaux horaires

```java
public class CalendarDatePolicy {

    /**
     * Regle absolue : toutes les dates calendrier sont des LocalDate (sans timezone).
     * Le check-in/check-out est a une DATE, pas un TIMESTAMP.
     * Les heures de check-in/check-out sont definies au niveau de l'unite
     * (ex: check-in 15h, check-out 11h) et converties en UTC pour les evenements.
     */

    public Instant toUtcInstant(LocalDate date, LocalTime time, ZoneId propertyZone) {
        ZonedDateTime zoned = ZonedDateTime.of(date, time, propertyZone);
        return zoned.toInstant();
    }

    public int calculateNights(LocalDate checkIn, LocalDate checkOut) {
        return (int) ChronoUnit.DAYS.between(checkIn, checkOut);
    }
}
```

**Regle critique** : Airbnb envoie et attend des dates (pas des timestamps). Le PMS stocke `check_in` et `check_out` comme `DATE` PostgreSQL. La timezone de la propriete est stockee separement (`property.timezone = 'Europe/Paris'`). Toute conversion vers UTC se fait uniquement pour les logs, evenements et affichage.

#### Propagation instantanee

Quand le calendrier change, 3 actions doivent se produire en < 5 secondes :

1. Base de donnees mise a jour (synchrone, dans la transaction)
2. Cache Redis invalide (synchrone, apres commit via `@TransactionalEventListener(phase = AFTER_COMMIT)`)
3. Evenement Kafka emis pour propagation vers les channels connectes (asynchrone)

```java
@Component
public class CalendarEventListener {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCalendarUpdated(CalendarUpdatedEvent event) {
        // Invalider le cache
        String cacheKey = "calendar:" + event.getUnitId()
            + ":" + event.getDateFrom()
            + ":" + event.getDateTo();
        redisTemplate.delete(cacheKey);

        // Emettre sur Kafka pour les sync channels
        kafkaTemplate.send("calendar.updates",
            String.valueOf(event.getUnitId()),
            CalendarUpdateMessage.from(event));
    }
}
```

#### Historisation complete

```sql
CREATE TABLE calendar_audit (
    id BIGSERIAL PRIMARY KEY,
    unit_id BIGINT NOT NULL,
    date DATE NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    source VARCHAR(50) NOT NULL,
    actor_id BIGINT,
    command_id BIGINT REFERENCES calendar_commands(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cal_audit_unit_date
    ON calendar_audit(unit_id, date, created_at DESC);
```

Chaque champ modifie produit une ligne d'audit. Volume estime : ~10M lignes/an pour 500 unites actives. Partitionnement mensuel necessaire.

### Criteres de validation

| Critere | Seuil | Test |
|---------|-------|------|
| Concurrence 100 updates simultanes meme unite | 0 donnees corrompues | Test JMeter 100 threads |
| Latence advisory lock acquisition | < 10ms P99 | Benchmark PostgreSQL |
| Propagation cache invalidation | < 1s | Test end-to-end avec timer |
| Audit trail complet | 100% changements traces | Diff audit count vs command count |
| Timezone DST transition | Dates correctes | Test unitaire Mars/Octobre transitions |
| Command replay (rejeu idempotent) | Meme resultat | Test avec meme idempotency_key |

### Risques si absent

- Calendrier corrompu sous charge entrainant des double reservations
- Perte d'historique rendant impossible l'investigation des conflits
- Mauvaise gestion timezone entrainant des decalages de dates avec Airbnb (tres frequent, tres penalisant)

### Livrables attendus

- [ ] `CalendarEngine` avec advisory locks
- [ ] Table `calendar_commands` (write-ahead log)
- [ ] Table `calendar_audit` (historisation)
- [ ] `CalendarEventListener` (propagation post-commit)
- [ ] `CalendarDatePolicy` (gestion timezone)
- [ ] Tests de concurrence 100 threads
- [ ] Benchmark latence advisory lock

---

## Niveau 3 — Infrastructure synchronisation interne

### Objectifs

Construire un moteur evenementiel fiable qui garantit que chaque changement dans le PMS est propage vers tous les consommateurs (channels, notifications, analytics) avec des garanties de livraison exactly-once semantique.

### Architecture event-driven

```
+----------------+     +-------------+     +------------------------+
|   PMS Core     |---->|    Kafka    |---->|  Channel Sync Workers  |
|  (Commands)    |     |   Topics    |     |  (Airbnb, Booking...)  |
+----------------+     +-------------+     +------------------------+
       |                      |                        |
       |                      v                        |
       |                +----------+                   |
       |                |  Dead    |                   |
       |                |  Letter  |                   |
       |                |  Queue   |                   |
       |                +----------+                   |
       |                                               |
       v                                               v
+----------------+                          +------------------+
|  Outbox        |                          |  Sync Status     |
|  Table         |                          |  Table           |
|  (Polling)     |                          |  (per channel)   |
+----------------+                          +------------------+
```

### Mecanismes internes necessaires

#### Pattern Transactional Outbox

Le probleme classique : ecrire en DB ET publier sur Kafka de maniere atomique. Si Kafka est down, le message est perdu. Solution : ecrire le message dans une table `outbox` dans la meme transaction DB, puis un poller le publie sur Kafka.

```sql
CREATE TABLE outbox_events (
    id BIGSERIAL PRIMARY KEY,
    aggregate_type VARCHAR(50) NOT NULL, -- RESERVATION, CALENDAR, PROPERTY
    aggregate_id BIGINT NOT NULL,
    event_type VARCHAR(100) NOT NULL,    -- reservation.created, calendar.updated
    payload JSONB NOT NULL,
    metadata JSONB,                      -- headers, correlation_id, causation_id
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING, PUBLISHED, FAILED, DEAD_LETTER
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_pending
    ON outbox_events(status, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_outbox_retry
    ON outbox_events(status, next_retry_at)
    WHERE status = 'FAILED' AND retry_count < 10;
```

#### Outbox Poller

```java
@Component
@Scheduled(fixedDelay = 500) // toutes les 500ms
public class OutboxPoller {

    private static final int BATCH_SIZE = 100;
    private static final int MAX_RETRIES = 10;

    @Transactional
    public void pollAndPublish() {
        // 1. Recuperer batch avec lock SKIP LOCKED
        //    (pas de contention entre instances)
        List<OutboxEvent> events = outboxRepository.findPendingBatch(BATCH_SIZE);
        // SQL: SELECT * FROM outbox_events
        //      WHERE status = 'PENDING'
        //         OR (status = 'FAILED' AND next_retry_at <= NOW())
        //      ORDER BY created_at ASC
        //      LIMIT 100 FOR UPDATE SKIP LOCKED

        for (OutboxEvent event : events) {
            try {
                kafkaTemplate.send(
                    topicFor(event.getAggregateType()),
                    String.valueOf(event.getAggregateId()),
                    event.getPayload()
                ).get(5, TimeUnit.SECONDS);

                event.setStatus(EventStatus.PUBLISHED);
                event.setPublishedAt(Instant.now());
            } catch (Exception e) {
                event.setRetryCount(event.getRetryCount() + 1);
                if (event.getRetryCount() >= MAX_RETRIES) {
                    event.setStatus(EventStatus.DEAD_LETTER);
                    alertService.critical("Outbox event exhausted retries", event);
                } else {
                    event.setStatus(EventStatus.FAILED);
                    event.setNextRetryAt(
                        calculateNextRetry(event.getRetryCount()));
                }
            }
        }
    }

    /**
     * Retry exponentiel avec jitter :
     * Tentative 1 : 1s, 2 : 2s, 3 : 4s, 4 : 8s, ... 10 : 512s (~8.5 min)
     */
    private Instant calculateNextRetry(int retryCount) {
        long baseDelayMs = 1000L * (1L << Math.min(retryCount, 9));
        long jitterMs = ThreadLocalRandom.current().nextLong(baseDelayMs / 4);
        return Instant.now().plusMillis(baseDelayMs + jitterMs);
    }
}
```

#### Topics Kafka

| Topic | Partition Key | Consumers | Garantie |
|-------|--------------|-----------|----------|
| `calendar.updates` | `unit_id` | Channel sync workers | Ordre par unite |
| `reservation.events` | `reservation_id` | Notifications, Analytics, Channel sync | Ordre par reservation |
| `property.events` | `property_id` | Channel sync | Ordre par propriete |
| `sync.commands` | `unit_id` | Sync engine | Ordre par unite |
| `sync.results` | `unit_id` | Status tracker | Ordre par unite |
| `sync.dlq` | - | Alert system + manual replay | Non ordonne |

#### Configuration Kafka critique

```yaml
spring:
  kafka:
    producer:
      acks: all
      retries: 3
      enable-idempotence: true
    consumer:
      enable-auto-commit: false
      auto-offset-reset: earliest
      max-poll-records: 50
```

#### Idempotence cote consommateur

```java
@KafkaListener(topics = "calendar.updates", groupId = "airbnb-sync")
public void handleCalendarUpdate(
        ConsumerRecord<String, CalendarUpdateMessage> record) {

    String idempotencyKey = record.headers()
        .lastHeader("idempotency-key").value().toString();

    // Verifier si deja traite
    if (processedEventRepository.existsByKey(idempotencyKey)) {
        logger.debug("Event already processed: {}", idempotencyKey);
        return;
    }

    try {
        airbnbSyncService.pushCalendarUpdate(record.value());
        processedEventRepository.save(
            new ProcessedEvent(idempotencyKey, Instant.now()));
    } catch (RetryableException e) {
        // Ne pas committer l'offset -> Kafka re-livrera
        throw e;
    } catch (NonRetryableException e) {
        // Envoyer en DLQ, committer l'offset
        dlqProducer.send("sync.dlq", record.value());
        processedEventRepository.save(
            new ProcessedEvent(idempotencyKey, Instant.now()));
    }
}
```

#### Classification des erreurs

```java
public enum ErrorClassification {
    RETRYABLE(true),       // timeout reseau, 429, 503
    NON_RETRYABLE(false),  // 400 bad request, 404, donnees invalides
    CIRCUIT_BREAK(false);  // 5xx repetes -> ouvrir circuit breaker

    public static ErrorClassification classify(Exception e) {
        if (e instanceof SocketTimeoutException) return RETRYABLE;
        if (e instanceof HttpClientErrorException ex) {
            int status = ex.getStatusCode().value();
            if (status == 429) return RETRYABLE;
            if (status >= 400 && status < 500) return NON_RETRYABLE;
            if (status >= 500) return CIRCUIT_BREAK;
        }
        return RETRYABLE;
    }
}
```

#### Circuit Breaker (Resilience4j)

```java
@CircuitBreaker(name = "airbnb-api", fallbackMethod = "airbnbFallback")
@Retry(name = "airbnb-api")
@RateLimiter(name = "airbnb-api")
public AirbnbResponse pushUpdate(AirbnbRequest request) {
    return airbnbClient.send(request);
}

// Configuration resilience4j :
// failure-rate-threshold: 50%
// wait-duration-in-open-state: 30s
// sliding-window-size: 10
// permitted-number-of-calls-in-half-open-state: 3
```

### Criteres de validation

| Critere | Seuil | Test |
|---------|-------|------|
| Aucun evenement perdu | 0 perte sur 100K events | Test chaos: kill Kafka pendant emission |
| Idempotence | Meme event 3x = meme resultat | Replay intentionnel |
| Retry exponentiel | Conforme au schedule | Log analysis apres erreurs simulees |
| DLQ fonctionnelle | Events non traitables arrivent en DLQ | Test avec payload invalide |
| Latence event -> consumer | < 2s P95 | Mesure end-to-end |
| Outbox drain rate | 0 events pending > 30s | Monitoring dashboard |

### Risques si absent

- Perte d'evenements silencieuse entrainant un inventaire desynchronise
- Pas de retry automatique : une erreur reseau temporaire casse la sync definitivement
- Sans DLQ : les messages empoisonnes bloquent toute la file

### Livrables attendus

- [ ] Table `outbox_events` + `processed_events`
- [ ] `OutboxPoller` avec retry exponentiel et DLQ
- [ ] Topics Kafka configures avec replication
- [ ] `ErrorClassification` pour chaque type d'erreur
- [ ] Circuit breaker Resilience4j sur tous les appels channel
- [ ] Consumer idempotent avec deduplication
- [ ] Dashboard Grafana montrant le consumer lag et outbox depth

---

## Niveau 4 — Gestion conflits distribues

### Objectifs

Resoudre de maniere deterministe et auditable tout conflit pouvant survenir dans un systeme ou plusieurs sources (UI, API Airbnb, iCal, autre channel) modifient le meme inventaire simultanement.

### Mecanismes internes necessaires

#### Priorite des sources

```java
public enum SourcePriority {
    CHANNEL_RESERVATION(100),  // Reservation Airbnb/Booking = priorite max
    CHANNEL_CALENDAR(90),      // Blocage venant d'un channel
    PMS_RESERVATION(80),       // Reservation creee dans le PMS
    PMS_MANUAL(70),            // Modification manuelle utilisateur
    ICAL_IMPORT(60),           // Import iCal (moins fiable)
    DYNAMIC_PRICING(50),       // Moteur de pricing automatique
    BULK_UPDATE(40),           // Mise a jour massive
    SYSTEM_DEFAULT(10);        // Valeur par defaut systeme

    private final int weight;
}
```

#### Algorithme de resolution

```java
@Service
public class ConflictResolver {

    public CalendarCommand resolve(
            CalendarCommand existing, CalendarCommand incoming) {

        // 1. Une reservation confirmee GAGNE TOUJOURS
        if (existing.involvesConfirmedReservation()) {
            auditConflict(existing, incoming, "EXISTING_RESERVATION_WINS");
            throw new ConflictException(
                "Cannot override confirmed reservation", existing);
        }
        if (incoming.involvesConfirmedReservation()) {
            auditConflict(existing, incoming, "INCOMING_RESERVATION_WINS");
            return incoming;
        }

        // 2. Priorite source
        if (incoming.getSourcePriority() > existing.getSourcePriority()) {
            auditConflict(existing, incoming, "HIGHER_PRIORITY_SOURCE_WINS");
            return incoming;
        }
        if (incoming.getSourcePriority() < existing.getSourcePriority()) {
            auditConflict(existing, incoming, "LOWER_PRIORITY_SOURCE_REJECTED");
            throw new ConflictException(
                "Lower priority source cannot override", existing);
        }

        // 3. Meme priorite -> Last-Writer-Wins
        auditConflict(existing, incoming, "SAME_PRIORITY_LAST_WRITER_WINS");
        return incoming;
    }

    private void auditConflict(CalendarCommand existing,
            CalendarCommand incoming, String resolution) {
        conflictAuditRepository.save(ConflictAudit.builder()
            .unitId(existing.getUnitId())
            .existingCommandId(existing.getId())
            .incomingCommandId(incoming.getId())
            .resolution(resolution)
            .existingSource(existing.getSource())
            .incomingSource(incoming.getSource())
            .build());
    }
}
```

#### Reservations concurrentes (race condition critique)

Scenario : un guest reserve sur Airbnb en meme temps qu'un autre via le PMS pour les memes dates.

```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public ReservationResult tryCreateReservation(CreateReservationRequest req) {
    // 1. Pre-check rapide (sans lock, pour UX)
    if (!calendarService.isAvailableQuick(
            req.unitId(), req.checkIn(), req.checkOut())) {
        return ReservationResult.unavailable("Pre-check: dates not available");
    }

    // 2. Acquerir advisory lock (bloque les concurrents sur la meme unite)
    advisoryLockService.lockUnit(req.unitId());

    // 3. Re-check definitif (sous lock, donnees fraiches)
    List<CalendarDay> days = calendarRepository
        .findByUnitIdAndDateRange(
            req.unitId(), req.checkIn(), req.checkOut().minusDays(1));

    Optional<CalendarDay> conflict = days.stream()
        .filter(d -> d.getStatus() != CalendarStatus.AVAILABLE)
        .findFirst();

    if (conflict.isPresent()) {
        CalendarDay conflictDay = conflict.get();
        return ReservationResult.conflict(
            "Date " + conflictDay.getDate()
            + " is " + conflictDay.getStatus()
            + (conflictDay.getReservationId() != null
                ? " (reservation #" + conflictDay.getReservationId() + ")"
                : ""));
    }

    // 4. Creer la reservation
    Reservation reservation = createAndBlockCalendar(req);
    return ReservationResult.success(reservation);
}
```

#### Mises a jour prix simultanees

```java
@Transactional
public PriceUpdateResult updatePrice(PriceUpdateCommand command) {
    CalendarDay day = calendarRepository
        .findByUnitIdAndDate(command.unitId(), command.date())
        .orElseThrow();

    // Optimistic lock check
    if (day.getVersion() != command.expectedVersion()) {
        CalendarDay fresh = calendarRepository
            .findByUnitIdAndDate(command.unitId(), command.date()).get();

        if (command.sourcePriority()
                > SourcePriority.forSource(fresh.getLastModifiedSource())) {
            day = fresh; // notre priorite est plus haute, forcer
        } else {
            return PriceUpdateResult.conflict(
                "Price was updated by " + fresh.getLastModifiedSource()
                + " at " + fresh.getUpdatedAt());
        }
    }

    Long oldPrice = day.getPriceCents();
    day.setPriceCents(command.priceCents());
    day.setLastModifiedSource(command.source());
    calendarRepository.save(day);

    auditService.logPriceChange(
        day.getUnitId(), day.getDate(),
        oldPrice, command.priceCents(), command.source());

    return PriceUpdateResult.success(day);
}
```

#### Rollback securise

```java
@Transactional
public void rollbackCommand(Long commandId) {
    CalendarCommand command = commandRepository.findById(commandId)
        .orElseThrow();

    if (command.getStatus() != CommandStatus.APPLIED) {
        throw new IllegalStateException(
            "Can only rollback APPLIED commands, current: "
            + command.getStatus());
    }

    // Restaurer les valeurs precedentes depuis l'audit trail
    List<CalendarAudit> audits = auditRepository.findByCommandId(commandId);
    for (CalendarAudit audit : audits) {
        CalendarDay day = calendarRepository
            .findByUnitIdAndDate(audit.getUnitId(), audit.getDate())
            .orElseThrow();

        // Verifier que la valeur actuelle est bien celle qu'on a ecrite
        String currentValue = getFieldValue(day, audit.getFieldName());
        if (!Objects.equals(currentValue, audit.getNewValue())) {
            logger.warn("Rollback conflict: field {} was modified after "
                + "command {}. Expected={}, Current={}",
                audit.getFieldName(), commandId,
                audit.getNewValue(), currentValue);
        }

        setFieldValue(day, audit.getFieldName(), audit.getOldValue());
        calendarRepository.save(day);
    }

    command.setStatus(CommandStatus.ROLLED_BACK);
    commandRepository.save(command);
    eventPublisher.publish(new CommandRolledBackEvent(command));
}
```

### Criteres de validation

| Critere | Seuil | Test |
|---------|-------|------|
| 50 reservations concurrentes memes dates | Exactement 1 acceptee, 49 rejetees | Test concurrent |
| Conflit prix PMS vs Channel | Source prioritaire gagne, audit complet | Test scenario |
| Rollback d'une commande | Etat restaure identique | Test rollback + verification |
| Conflit detecte -> resolution | < 100ms P99 | Benchmark |
| 100% des conflits audites | 0 conflit non trace | Audit count check |

### Livrables attendus

- [ ] `ConflictResolver` avec algorithme source priority + last-writer-wins
- [ ] `SourcePriority` enum configurable
- [ ] Table `conflict_audit` avec historique complet
- [ ] Rollback engine base sur l'audit trail
- [ ] Tests de concurrence exhaustifs (50+ threads)
- [ ] Metriques Prometheus : conflits detectes, resolus, rejetes

---

## Niveau 5 — Moteur de mapping abstrait

### Objectifs

Permettre au PMS de connecter n'importe quelle unite a n'importe quel channel (Airbnb, Booking.com, Vrbo) via un systeme de mapping flexible, versionne et valide, sans modification de code.

### Architecture requise

```sql
CREATE TABLE channel_connections (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    channel VARCHAR(30) NOT NULL, -- AIRBNB, BOOKING, VRBO
    status VARCHAR(20) NOT NULL,  -- ACTIVE, PAUSED, DISCONNECTED, ERROR
    credentials_vault_key VARCHAR(100),
    webhook_url TEXT,
    sync_config JSONB,
    last_sync_at TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE channel_mappings (
    id BIGSERIAL PRIMARY KEY,
    connection_id BIGINT NOT NULL REFERENCES channel_connections(id),
    entity_type VARCHAR(30) NOT NULL,  -- PROPERTY, UNIT, RATE_PLAN, RESTRICTION
    internal_id BIGINT NOT NULL,
    external_id VARCHAR(200) NOT NULL,
    mapping_config JSONB,
    mapping_version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    validated_at TIMESTAMP,
    validation_errors JSONB,
    organization_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(connection_id, entity_type, internal_id),
    UNIQUE(connection_id, entity_type, external_id)
);

CREATE TABLE channel_mapping_versions (
    id BIGSERIAL PRIMARY KEY,
    mapping_id BIGINT NOT NULL REFERENCES channel_mappings(id),
    version INTEGER NOT NULL,
    old_config JSONB,
    new_config JSONB,
    changed_by BIGINT,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Mecanismes internes necessaires

#### Systeme de transformation

```java
public interface ChannelTransformer<I, O> {
    O transform(I pmsEntity, ChannelMapping mapping);
    I reverseTransform(O channelEntity, ChannelMapping mapping);
    ValidationResult validate(ChannelMapping mapping);
}

@Component("airbnb-property-transformer")
public class AirbnbPropertyTransformer
        implements ChannelTransformer<Property, AirbnbListing> {

    @Override
    public AirbnbListing transform(Property property, ChannelMapping mapping) {
        Unit unit = property.getUnits().get(0);
        return AirbnbListing.builder()
            .listingId(mapping.getExternalId())
            .name(unit.getName())
            .propertyType(mapPropertyType(unit.getType()))
            .roomType(mapRoomType(unit.getType()))
            .accommodates(unit.getMaxGuests())
            .bedrooms(unit.getBedroomsCount())
            .beds(unit.getBedsCount())
            .bathrooms(unit.getBathroomsCount())
            .amenities(mapAmenities(unit.getAmenities()))
            .location(AirbnbLocation.builder()
                .lat(unit.getAddress().getLatitude())
                .lng(unit.getAddress().getLongitude())
                .address(unit.getAddress().getStreet())
                .city(unit.getAddress().getCity())
                .country(unit.getAddress().getCountryCode())
                .build())
            .photos(mapPhotos(unit.getMedia()))
            .build();
    }

    @Override
    public ValidationResult validate(ChannelMapping mapping) {
        List<String> errors = new ArrayList<>();
        Unit unit = unitRepository.findById(mapping.getInternalId()).orElse(null);

        if (unit == null) {
            errors.add("Unit not found: " + mapping.getInternalId());
            return ValidationResult.failed(errors);
        }

        if (unit.getMedia().stream()
                .filter(m -> m.getType() == MediaType.PHOTO).count() < 5) {
            errors.add("Airbnb requires minimum 5 photos");
        }
        if (unit.getAddress() == null
                || unit.getAddress().getLatitude() == null) {
            errors.add("Geocoded address is required for Airbnb");
        }
        if (unit.getMaxGuests() == null || unit.getMaxGuests() < 1) {
            errors.add("Accommodates must be >= 1");
        }
        if (unit.getDescription() == null
                || unit.getDescription().length() < 50) {
            errors.add("Description must be at least 50 characters for Airbnb");
        }

        return errors.isEmpty()
            ? ValidationResult.valid()
            : ValidationResult.failed(errors);
    }
}
```

#### Mapping des tarifs

```java
@Component("airbnb-rate-transformer")
public class AirbnbRateTransformer
        implements ChannelTransformer<List<CalendarDay>, AirbnbCalendarUpdate> {

    @Override
    public AirbnbCalendarUpdate transform(
            List<CalendarDay> days, ChannelMapping mapping) {
        return AirbnbCalendarUpdate.builder()
            .listingId(mapping.getExternalId())
            .days(days.stream().map(day -> AirbnbCalendarDay.builder()
                .date(day.getDate())
                .available(day.getStatus() == CalendarStatus.AVAILABLE)
                .price(new AirbnbPrice(
                    day.getPriceCents() / 100.0, "EUR"))
                .minNights(day.getMinStay())
                .maxNights(day.getMaxStay())
                .closedToArrival(day.getClosedToArrival())
                .closedToDeparture(day.getClosedToDeparture())
                .build())
            .collect(Collectors.toList()))
            .build();
    }
}
```

#### Validation periodique des mappings

```java
@Scheduled(cron = "0 0 */6 * * *") // toutes les 6 heures
public void validateAllMappings() {
    List<ChannelMapping> activeMappings =
        mappingRepository.findByStatus(MappingStatus.ACTIVE);

    for (ChannelMapping mapping : activeMappings) {
        ChannelTransformer<?, ?> transformer = transformerRegistry.get(
            mapping.getConnection().getChannel(), mapping.getEntityType());

        ValidationResult result = transformer.validate(mapping);

        if (!result.isValid()) {
            mapping.setValidationErrors(result.getErrors());
            mapping.setStatus(MappingStatus.VALIDATION_ERROR);
            alertService.warn("Mapping validation failed", Map.of(
                "mapping_id", mapping.getId(),
                "channel", mapping.getConnection().getChannel(),
                "errors", result.getErrors()));
        } else {
            mapping.setValidatedAt(Instant.now());
            mapping.setValidationErrors(null);
        }
        mappingRepository.save(mapping);
    }
}
```

### Criteres de validation

| Critere | Seuil | Test |
|---------|-------|------|
| Mapping property PMS -> Airbnb listing | Tous les champs obligatoires mappes | Test unitaire exhaustif |
| Validation mapping detecte champ manquant | 100% des cas invalides detectes | Test avec donnees incompletes |
| Versioning mapping | Historique consultable, rollback possible | Test version + revert |
| Transformation bidirectionnelle | Round-trip sans perte | transform -> reverseTransform -> compare |

### Livrables attendus

- [ ] Tables `channel_connections`, `channel_mappings`, `channel_mapping_versions`
- [ ] Interface `ChannelTransformer<I, O>` avec implem Airbnb
- [ ] `TransformerRegistry` pour resolution dynamique
- [ ] Validation periodique des mappings (scheduler)
- [ ] UI admin pour gerer les mappings
- [ ] Tests unitaires pour chaque transformer

---

## Niveau 6 — Observabilite systeme complete

### Objectifs

Disposer d'une visibilite temps reel complete sur l'etat du systeme, la sante des synchronisations, et la capacite a diagnostiquer tout incident en moins de 5 minutes.

### Architecture observabilite

```
+---------------+    +--------------+    +-------------------+
|  Application  |--->|  Prometheus  |--->|    Grafana         |
|  (Micrometer) |    |  (scrape)    |    |  (dashboards)      |
+---------------+    +--------------+    +-------------------+
       |                                         |
       |             +--------------+             |
       +------------>|    Loki      |<------------+
       | (logs)      |  (log agg)   | (log queries)
       |             +--------------+             |
       |                                         |
       |             +--------------+             |
       +------------>| Alertmanager |-------------+
         (alerts)    | -> Slack/PD  |
                     +--------------+
```

### Fonctionnalites obligatoires

#### Metriques obligatoires (Micrometer + Prometheus)

```java
@Component
public class SyncMetrics {

    private final MeterRegistry registry;

    // Compteurs
    private final Counter syncSuccessCounter;
    private final Counter syncFailureCounter;
    private final Counter conflictsDetectedCounter;
    private final Counter conflictsResolvedCounter;
    private final Counter doubleBookingPreventedCounter;

    // Histogrammes (latence)
    private final Timer syncLatencyTimer;
    private final Timer calendarUpdateLatencyTimer;
    private final Timer reservationCreationTimer;

    // Gauges
    private final AtomicLong pendingOutboxEvents;
    private final AtomicLong activeSyncConnections;
    private final AtomicLong mappingValidationErrors;

    public SyncMetrics(MeterRegistry registry) {
        this.registry = registry;

        this.syncSuccessCounter = Counter.builder("pms.sync.success")
            .description("Successful channel synchronizations")
            .tag("channel", "all")
            .register(registry);

        this.syncFailureCounter = Counter.builder("pms.sync.failure")
            .description("Failed channel synchronizations")
            .tag("channel", "all")
            .tag("error_type", "unknown")
            .register(registry);

        this.syncLatencyTimer = Timer.builder("pms.sync.latency")
            .description("Channel sync latency")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(registry);

        this.calendarUpdateLatencyTimer = Timer.builder("pms.calendar.update.latency")
            .description("Calendar update processing time")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(registry);

        this.reservationCreationTimer = Timer.builder("pms.reservation.creation.latency")
            .description("Reservation creation time including availability check")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(registry);

        this.pendingOutboxEvents = registry.gauge(
            "pms.outbox.pending", new AtomicLong(0));
        this.activeSyncConnections = registry.gauge(
            "pms.sync.connections.active", new AtomicLong(0));
        this.mappingValidationErrors = registry.gauge(
            "pms.mapping.validation.errors", new AtomicLong(0));

        this.doubleBookingPreventedCounter = Counter.builder(
            "pms.reservation.double_booking.prevented")
            .description("Double bookings prevented by conflict detection")
            .register(registry);
    }

    public void recordSync(String channel, boolean success, long durationMs) {
        if (success) {
            Counter.builder("pms.sync.success")
                .tag("channel", channel).register(registry).increment();
        } else {
            Counter.builder("pms.sync.failure")
                .tag("channel", channel).register(registry).increment();
        }
        syncLatencyTimer.record(durationMs, TimeUnit.MILLISECONDS);
    }
}
```

#### Logs structures

Chaque log DOIT inclure dans le MDC :

- `requestId` : UUID unique par requete HTTP
- `orgId` : ID de l'organisation (tenant)
- `unitId` : ID de l'unite concernee (si applicable)
- `channel` : nom du channel (si sync)
- `syncId` : ID de la session de synchronisation

```yaml
# logback-spring.xml pattern
logging:
  pattern:
    console: >-
      %d{ISO8601} [%thread] [%X{requestId}] [%X{orgId}]
      [%X{unitId}] %-5level %logger{36} - %msg%n
```

#### Dashboards Grafana obligatoires

**1. Dashboard Sync Overview :**
- Sync success/failure rate par channel (graphe temps reel)
- Latence P50/P95/P99 par channel
- Outbox queue depth (doit rester proche de 0)
- Nombre de mappings en erreur

**2. Dashboard Calendar Health :**
- Conflits detectes / resolus par heure
- Double bookings prevented
- Calendar commands par type (graphe empile)
- Advisory lock wait time P99

**3. Dashboard Reservations :**
- Reservations creees/modifiees/annulees par heure
- Reservations par channel (pie chart)
- Temps de creation reservation P95
- Taux d'echec creation (conflit calendrier)

**4. Dashboard Infrastructure :**
- PostgreSQL connections / slow queries
- Redis hit rate / memory
- Kafka consumer lag par topic
- JVM heap / GC pause time

#### Alerting

| Alerte | Condition | Severite | Action |
|--------|-----------|----------|--------|
| Double booking detecte | counter > 0 en 5min | CRITICAL | Page on-call + freeze sync |
| Sync failure rate > 10% | 5min window | HIGH | Notification Slack |
| Outbox depth > 1000 | pendant 5min | HIGH | Verifier Kafka health |
| Calendar conflict rate > 50/h | 1h window | MEDIUM | Investiguer source |
| Sync latency P99 > 30s | 15min window | MEDIUM | Verifier API channel |
| Mapping validation errors > 0 | immediate | LOW | Review mapping |
| Consumer lag > 10000 | pendant 10min | HIGH | Scale consumers |

#### Tracabilite complete inventaire

Pour chaque unite, on doit pouvoir reconstruire l'etat du calendrier a n'importe quel moment dans le passe :

```sql
-- Reconstituer l'etat d'une unite a une date/heure donnee
SELECT ca.date, ca.field_name, ca.new_value, ca.source, ca.created_at
FROM calendar_audit ca
WHERE ca.unit_id = 123
  AND ca.date BETWEEN '2026-06-01' AND '2026-06-30'
  AND ca.created_at <= '2026-05-15 14:30:00'
ORDER BY ca.date, ca.created_at DESC;
```

### Criteres de validation

| Critere | Seuil | Test |
|---------|-------|------|
| Toutes metriques exposees sur /actuator/prometheus | 100% | Scrape test |
| Dashboard Grafana Sync Overview operationnel | Toutes visualisations fonctionnelles | Revue manuelle |
| Alertes declenchees correctement | 100% des scenarios testes | Test chaos inject |
| Correlation request -> logs -> metriques | < 30s pour un diagnostic | Test operationnel |

### Livrables attendus

- [ ] `SyncMetrics` bean avec tous les compteurs/timers/gauges
- [ ] Configuration logback MDC pour tous les contextes
- [ ] 4 dashboards Grafana (JSON exportables)
- [ ] Regles Alertmanager pour toutes les alertes listees
- [ ] Query SQL de reconstitution d'etat calendrier
- [ ] Runbook pour chaque alerte

---

## Niveau 7 — Securite niveau entreprise

### Objectifs

Satisfaire les exigences de securite d'Airbnb pour l'acces API partenaire, incluant la protection des donnees guests, l'isolation multi-tenant, et la conformite RGPD/PCI.

### Exigences techniques detaillees

#### Authentification forte

- Keycloak comme Identity Provider (deja en place dans Clenzy)
- JWT avec RS256 (asymetrique), duree de vie 15 minutes
- Refresh token : duree 7 jours, rotation a chaque usage
- MFA obligatoire pour les comptes SUPER_ADMIN et SUPER_MANAGER
- Brute force protection : lockout apres 5 tentatives, duree 15 minutes progressif

#### RBAC (systeme 3-couches Clenzy)

- Platform roles : `SUPER_ADMIN`, `SUPER_MANAGER`
- Organization roles : `OWNER`, `ADMIN`, `MANAGER`, `SUPERVISOR`
- Independent roles : `HOST`, `TECHNICIAN`, `HOUSEKEEPER`
- Chaque endpoint protege par `@PreAuthorize` (regle CLAUDE.md)
- Ownership validation sur chaque ressource (regle CLAUDE.md)

#### Isolation multi-tenant

- `TenantFilter` assure l'injection du `organizationId` dans le `TenantContext`
- Hibernate `@Filter("organizationFilter")` sur toutes les entites tenant-scoped
- Chaque requete SQL inclut implicitement `WHERE organization_id = ?`
- Tests de penetration : un utilisateur org A ne peut JAMAIS acceder aux donnees org B

#### Chiffrement au repos

- PostgreSQL : Transparent Data Encryption (TDE) ou chiffrement disk-level (LUKS sur les volumes EBS)
- Donnees PII guests : chiffrement applicatif AES-256-GCM (email, telephone, nom) via Jasypt ou Vault Transit
- Tokens OAuth channels : stockes dans HashiCorp Vault, jamais en base en clair
- Backups : chiffres avec une cle separee stockee dans KMS

#### Chiffrement en transit

- TLS 1.3 obligatoire sur tous les endpoints (nginx terminates TLS)
- Communication inter-services : mTLS ou reseau Docker interne isole
- Connexion PostgreSQL : SSL required (`sslmode=require`)
- Connexion Redis : TLS + AUTH

#### Gestion secrets

- Aucun secret en codebase, `.env`, ou `application.yml`
- Variables d'environnement injectees par l'orchestrateur (Docker Compose secrets, Kubernetes secrets)
- Rotation automatique des credentials Airbnb API tous les 90 jours
- Alerte si un secret n'a pas ete rotate depuis > 90 jours

#### Audit securite

```sql
CREATE TABLE security_audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    -- LOGIN_SUCCESS, LOGIN_FAILURE, PERMISSION_DENIED, DATA_ACCESS,
    -- ADMIN_ACTION, SECRET_ROTATION, SUSPICIOUS_ACTIVITY
    actor_id BIGINT,
    actor_email VARCHAR(255),
    actor_ip VARCHAR(45),
    resource_type VARCHAR(50),
    resource_id BIGINT,
    action VARCHAR(50),
    result VARCHAR(20), -- SUCCESS, DENIED, ERROR
    details JSONB,
    organization_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Retention : 1 an minimum, archivage S3 ensuite
```

#### Conformite RGPD

- Droit a l'effacement : endpoint `DELETE /api/guests/{id}/gdpr-erase` qui anonymise (ne supprime pas) les donnees
- Droit d'acces : endpoint `GET /api/guests/{id}/gdpr-export` (format JSON + PDF)
- Registre des traitements : documente
- Data Processing Agreement (DPA) avec chaque sous-traitant (Airbnb, Stripe, etc.)

### Criteres de validation

| Critere | Seuil |
|---------|-------|
| Pentest annuel par tiers | 0 vulnerabilite critique/haute |
| Isolation tenant | 0 fuite cross-tenant en 10 000 requetes aleatoires |
| Chiffrement PII | 100% champs sensibles chiffres au repos |
| Rotation secrets | < 90 jours pour tous les secrets |
| Audit log | 100% des actions admin/security tracees |

### Livrables attendus

- [ ] Configuration Keycloak MFA pour admins
- [ ] Table `security_audit_log` + listeners pour chaque event type
- [ ] Chiffrement PII avec Jasypt ou Vault Transit
- [ ] Endpoint RGPD (erase + export)
- [ ] Tests cross-tenant automatises (10 000 requetes)
- [ ] Rapport de pentest tiers

---

## Niveau 8 — Scalabilite et haute disponibilite

### Objectifs

Garantir que le systeme peut absorber la croissance du nombre de proprietes et de reservations sans degradation de performance, avec une tolerance aux pannes validee.

### Architecture requise

#### Stateless services

- Aucune session HTTP cote serveur (JWT pur)
- `TenantContext` est `@RequestScope` (recree a chaque requete)
- Cache applicatif uniquement dans Redis (jamais en memoire locale, sauf Caffeine L1 avec TTL 30s max)
- Toute instance PMS est interchangeable via scaling horizontal sans affinite

#### Base de donnees optimisee

- PostgreSQL avec pgBouncer (max 200 connexions poolees pour N instances)
- Read replicas pour les requetes de lecture (rapports, dashboards, listings)
- Write primary pour toutes les transactions (reservations, calendrier, prix)
- Partitionnement `calendar_days` par mois si > 10M lignes
- Vacuum agressif sur les tables a forte ecriture
- Monitoring `pg_stat_statements` pour les slow queries

#### Tolerance aux pannes

| Composant | Strategie | RTO | RPO |
|-----------|-----------|-----|-----|
| API instances | Auto-scaling group, min 2 | 0 (rolling) | 0 |
| PostgreSQL | Streaming replication + failover auto | < 30s | 0 |
| Redis | Redis Sentinel ou Cluster, 3 nodes | < 10s | < 1s |
| Kafka | 3 brokers, replication factor 3 | < 30s | 0 |
| Storage (S3) | Cross-region replication | 0 | 0 |

#### Tests de charge valides

| Scenario | Cible | Acceptable |
|----------|-------|------------|
| 1000 proprietes, recuperation calendrier 90j | < 200ms P95 | < 500ms P99 |
| 100 reservations concurrentes | 0 double booking, < 1s P95 | < 3s P99 |
| Sync push 500 unites vers Airbnb | < 5min total | < 10min |
| 1000 req/s mixed (read 80%, write 20%) | < 100ms P95 reads | < 500ms P95 writes |
| Crash d'une instance pendant charge | 0 requete perdue | < 5s failover |

### Criteres de validation

| Critere | Seuil |
|---------|-------|
| Scaling 1 -> 4 instances sans interruption | 0 downtime |
| Failover DB primary -> replica | < 30s |
| 1000 req/s soutenu 1h | 0 erreur, < 200ms P95 |
| Recovery apres crash instance | < 5s |

### Livrables attendus

- [ ] Configuration pgBouncer avec pool sizing
- [ ] Read replica routing (Spring `@Transactional(readOnly=true)`)
- [ ] Scripts de tests de charge (k6 ou Gatling)
- [ ] Resultats de tests de charge documentes
- [ ] Disaster recovery runbook teste
- [ ] Configuration auto-scaling (CPU > 70% -> scale out)

---

## Niveau 9 — Strategie tests automatises

### Objectifs

Garantir par des tests automatises que toutes les invariantes critiques du systeme sont respectees en permanence, avec une attention particuliere sur la concurrence et la coherence des donnees.

### Pyramide de tests

```
         +---------------------+
         |  E2E (Playwright)   |  5% - Parcours critiques
         |  10-20 tests        |
         +---------+-----------+
                   |
         +---------v-----------+
         | Integration Tests   |  25% - API + DB + Kafka
         | 100-200 tests       |
         +---------+-----------+
                   |
         +---------v-----------+
         |   Unit Tests        |  70% - Logique metier pure
         | 500-1000 tests      |
         +---------------------+
```

### Tests critiques pour la certification

#### Test anti-double reservation

```java
@Test
@RepeatedTest(10)
void shouldPreventDoubleBooking_WithConcurrentRequests() throws Exception {
    // Given: une unite disponible du 1er au 5 juin
    Unit unit = createAvailableUnit(
        LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 5));

    // When: 50 threads tentent de reserver simultanement
    int threads = 50;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch endLatch = new CountDownLatch(threads);
    AtomicInteger successCount = new AtomicInteger(0);
    AtomicInteger conflictCount = new AtomicInteger(0);

    for (int i = 0; i < threads; i++) {
        executor.submit(() -> {
            try {
                startLatch.await();
                ReservationResult result =
                    reservationService.tryCreateReservation(
                        CreateReservationRequest.builder()
                            .unitId(unit.getId())
                            .checkIn(LocalDate.of(2026, 6, 1))
                            .checkOut(LocalDate.of(2026, 6, 5))
                            .guestsCount(2)
                            .build());
                if (result.isSuccess()) successCount.incrementAndGet();
                else conflictCount.incrementAndGet();
            } catch (Exception e) {
                conflictCount.incrementAndGet();
            } finally {
                endLatch.countDown();
            }
        });
    }

    startLatch.countDown(); // GO!
    endLatch.await(30, TimeUnit.SECONDS);

    // Then: exactement 1 reservation acceptee
    assertThat(successCount.get()).isEqualTo(1);
    assertThat(conflictCount.get()).isEqualTo(threads - 1);

    // Et le calendrier est coherent
    List<CalendarDay> days = calendarRepository
        .findByUnitIdAndDateRange(unit.getId(),
            LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 4));
    assertThat(days).allMatch(
        d -> d.getStatus() == CalendarStatus.RESERVED);
    assertThat(days).allMatch(
        d -> d.getReservationId() != null);

    // Et une seule reservation en base
    long reservationCount = reservationRepository
        .countByUnitIdAndStatusNot(unit.getId(), ReservationStatus.CANCELLED);
    assertThat(reservationCount).isEqualTo(1);
}
```

#### Test coherence calendrier apres modification + sync

```java
@Test
void shouldMaintainCalendarConsistencyAfterBulkUpdateAndSync() {
    List<Unit> units = createUnits(100, 15000);

    CompletableFuture<Void> bulkUpdate = CompletableFuture.runAsync(() -> {
        rateService.bulkUpdatePrice(
            units.stream().map(Unit::getId).toList(),
            LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31),
            20000);
    });

    CompletableFuture<Void> channelSync = CompletableFuture.runAsync(() -> {
        for (Unit unit : units.subList(0, 50)) {
            airbnbSyncService.pullCalendarUpdates(unit.getId());
        }
    });

    CompletableFuture.allOf(bulkUpdate, channelSync).join();

    for (Unit unit : units) {
        List<CalendarDay> days = calendarRepository
            .findByUnitIdAndDateRange(unit.getId(),
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31));
        assertThat(days).hasSize(31);
        assertThat(days).allMatch(d -> d.getPriceCents() != null);
        assertThat(days).allMatch(d -> d.getStatus() != null);
    }
}
```

#### Test resilience Kafka down

```java
@Test
void shouldRecoverFromKafkaOutage() {
    calendarService.updatePrice(unitId, date, 15000);

    kafkaContainer.stop();

    calendarService.updatePrice(unitId, date, 20000);
    calendarService.updatePrice(unitId, date, 25000);

    assertThat(outboxRepository.countByStatus(EventStatus.PENDING))
        .isGreaterThan(0);

    kafkaContainer.start();

    await().atMost(Duration.ofSeconds(30)).until(
        () -> outboxRepository.countByStatus(EventStatus.PENDING) == 0);

    CalendarDay day = calendarRepository
        .findByUnitIdAndDate(unitId, date).get();
    assertThat(day.getPriceCents()).isEqualTo(25000);
}
```

### Couverture obligatoire

| Domaine | Couverture min | Tests critiques |
|---------|---------------|-----------------|
| Anti-double reservation | 100% | Concurrence, edge cases (meme seconde) |
| Machine a etats reservation | 100% transitions | Toutes transitions valides + invalides |
| Calcul prix | 100% scenarios | Saisons, promotions, overrides, weekends |
| Restrictions | 100% regles | min_stay, CTA, CTD, gap_days, advance_notice |
| Calendrier transactionnel | 100% commandes | Concurrence, rollback, replay |
| Mapping channels | 100% transformations | Round-trip, champs obligatoires, edge cases |
| Tenant isolation | 100% endpoints | Cross-tenant access attempts |

### Livrables attendus

- [ ] Suite de tests concurrence anti-double booking (50+ threads, repete 10x)
- [ ] Tests integration Kafka avec Testcontainers
- [ ] Tests resilience (chaos engineering basique)
- [ ] Tests de charge avec k6/Gatling + resultats documentes
- [ ] Coverage report > 80% sur le code critique
- [ ] CI/CD pipeline executant tous les tests a chaque PR

---

## Niveau 10 — Preuves d'usage production reel

### Objectifs

Demontrer a Airbnb que le PMS est utilise en production par de vrais clients gerant de vraies proprietes, avec un historique d'utilisation verifiable.

### Exigences business

#### Clients actifs reels

- Minimum **50 proprietes** gerees en production reelle (pas de test data)
- Minimum **10 organisations differentes** utilisant le PMS
- Au moins **6 mois d'historique** d'utilisation continue
- Taux de retention clients > 80% sur la periode

#### Proprietes reelles gerees

- Prouver que les proprietes sont reelles (verifiable sur des OTA existants)
- Demontrer la diversite : studios, appartements, maisons, multi-unites
- Couverture geographique : au moins 2 pays ou 5 villes

#### Historique d'utilisation

- Volume de reservations traitees : minimum **500 reservations** historiques
- Taux de problemes/incidents : < 1% des reservations
- Temps moyen de resolution incident : < 4 heures
- Aucune double reservation non resolue

#### Support operationnel existant

- Equipe support joignable (email, chat, telephone)
- Temps de reponse support < 4h en heures ouvrees
- Documentation utilisateur disponible
- Processus d'onboarding documente
- SLA publie et respecte

#### Metriques a fournir dans le dossier

```
Production Metrics (last 6 months):
- Active properties:                      127
- Active organizations:                    23
- Total reservations processed:         3,847
- Average daily calendar updates:      12,400
- System uptime:                        99.94%
- Double bookings:                           0
- Average API response time:             87ms
- Support tickets resolved < 4h:          96%
- Customer satisfaction (CSAT):          4.3/5
```

### Criteres de validation

| Critere | Seuil |
|---------|-------|
| Proprietes actives | >= 50 |
| Organisations differentes | >= 10 |
| Reservations traitees | >= 500 |
| Historique continu | >= 6 mois |
| Double bookings | 0 |
| Uptime | >= 99.9% |

### Livrables attendus

- [ ] Rapport production avec metriques reelles (anonymisees)
- [ ] Liste des clients references (avec leur accord)
- [ ] Historique d'uptime (via monitoring externe)
- [ ] Statistiques support client
- [ ] Temoignages clients (optionnel mais valorisant)

---

## Niveau 11 — Documentation technique complete

### Objectifs

Fournir une documentation technique exhaustive demontrant la maturite du systeme et facilitant l'evaluation par l'equipe partenaire Airbnb.

### Livrables documentaires obligatoires

#### 1. Architecture systeme (~30 pages)

- Diagramme C4 (Context, Container, Component, Code)
- Infrastructure diagram (AWS/GCP)
- Network topology
- Data flow diagrams
- Sequence diagrams pour les 5 flux critiques :
  1. Creation reservation PMS -> sync Airbnb
  2. Reservation recue d'Airbnb -> calendrier PMS
  3. Modification prix PMS -> propagation channels
  4. Conflit calendrier -> resolution
  5. Annulation -> mise a jour inventaire

#### 2. Modeles de donnees

- ERD complet avec toutes les relations
- Description de chaque table et champ
- Index strategy document
- Partitioning strategy
- Data retention policy

#### 3. Procedures d'erreur

- Runbook pour chaque alerte Prometheus
- Decision tree pour diagnostic sync failures
- Procedure de replay evenements outbox
- Procedure de correction mapping
- Procedure de rollback deploiement

#### 4. SLA disponibilite

| Metrique | Engagement | Mesure |
|----------|------------|--------|
| Uptime API | 99.9% (8.76h downtime/an max) | Monitoring externe |
| Latence API P95 | < 500ms | Prometheus |
| Propagation calendrier | < 30s | End-to-end timer |
| Resolution incident P1 | < 1h | Ticketing |
| Resolution incident P2 | < 4h | Ticketing |
| RPO (perte donnees) | 0 | Replication sync |
| RTO (temps restauration) | < 15 min | Disaster recovery drill |

### Livrables attendus

- [ ] Document architecture (PDF/Confluence)
- [ ] ERD complet genere depuis la base
- [ ] Sequence diagrams des 5 flux critiques (PlantUML/Mermaid)
- [ ] Runbooks operationnels pour chaque alerte
- [ ] SLA document publie

---

## Niveau 12 — Outils support et diagnostic

### Objectifs

Disposer d'outils internes permettant au support technique de diagnostiquer et resoudre tout probleme de synchronisation en moins de 15 minutes.

### Fonctionnalites support obligatoires

#### Admin panel interne (backoffice)

```
/admin/sync
|-- /connections                  Etat de chaque connexion channel
|-- /connections/{id}/logs        Logs de sync detailles
|-- /events                       Timeline des evenements (filtrable)
|-- /events/{id}/replay           Rejouer un evenement specifique
|-- /outbox                       Queue outbox (pending, failed, DLQ)
|-- /outbox/{id}/retry            Retry manuel
|-- /conflicts                    Conflits detectes (avec resolution)
|-- /mappings                     Etat des mappings (avec validation)
|-- /mappings/{id}/fix            Corriger un mapping
|-- /calendar/{unitId}            Vue calendrier avec historique complet
|-- /calendar/{unitId}/audit      Audit trail par jour
+-- /diagnostics                  Health checks, metriques, alertes actives
```

#### Inspection synchronisations

```java
@RestController
@RequestMapping("/admin/sync")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SyncAdminController {

    @GetMapping("/connections/{id}/health")
    public SyncHealthReport getConnectionHealth(@PathVariable Long id) {
        ChannelConnection conn = connectionRepository.findById(id)
            .orElseThrow();
        return SyncHealthReport.builder()
            .connectionId(conn.getId())
            .channel(conn.getChannel())
            .status(conn.getStatus())
            .lastSuccessfulSync(conn.getLastSyncAt())
            .pendingEvents(
                outboxRepository.countByConnectionId(id))
            .failedEventsLast24h(
                outboxRepository.countFailedSince(id,
                    Instant.now().minus(24, ChronoUnit.HOURS)))
            .averageLatencyMs(
                metricsService.getAverageLatency(
                    conn.getChannel(), Duration.ofHours(24)))
            .errorRate(
                metricsService.getErrorRate(
                    conn.getChannel(), Duration.ofHours(24)))
            .mappingErrors(
                mappingRepository.countValidationErrorsByConnection(id))
            .build();
    }

    @PostMapping("/events/{id}/replay")
    public ReplayResult replayEvent(@PathVariable Long id) {
        OutboxEvent event = outboxRepository.findById(id).orElseThrow();
        event.setStatus(EventStatus.PENDING);
        event.setRetryCount(0);
        event.setNextRetryAt(null);
        outboxRepository.save(event);
        return new ReplayResult(event.getId(), "Queued for replay");
    }
}
```

#### Outils de correction de mapping (UI)

- Interface permettant de relier une unite PMS a un listing Airbnb manuellement
- Validation en temps reel : verifier que tous les champs requis sont presents
- Dry-run : simuler un push sans reellement envoyer a Airbnb
- Comparateur : afficher cote-a-cote les donnees PMS vs donnees Airbnb pour detecter les ecarts

### Livrables attendus

- [ ] `SyncAdminController` avec tous les endpoints de diagnostic
- [ ] UI admin pour la gestion des connexions et mappings
- [ ] Fonctionnalite replay d'evenement
- [ ] Comparateur PMS vs Channel
- [ ] Documentation des procedures de diagnostic

---

## Niveau 13 — Integrite donnees et audit

### Objectifs

Garantir formellement que le systeme ne perd jamais de reservation, ne diverge jamais de l'inventaire channel, et maintient une tracabilite historique complete.

### Garanties exigees

#### Aucune perte de reservation

- Chaque reservation est persistee en base AVANT tout traitement asynchrone
- En cas de crash pendant la creation : la transaction PostgreSQL rollback sans reservation orpheline
- En cas de crash apres creation mais avant sync channel : l'outbox garantit la livraison ulterieure
- Test : kill -9 du process pendant 1000 creations avec 0 reservation perdue, 0 calendrier corrompu

#### Reconciliation automatique d'inventaire

```java
@Scheduled(cron = "0 0 * * * *") // chaque heure
public void reconcileInventory() {
    List<ChannelConnection> connections =
        connectionRepository.findByStatus(ConnectionStatus.ACTIVE);

    for (ChannelConnection conn : connections) {
        List<ChannelMapping> mappings =
            mappingRepository.findActiveByConnection(conn.getId());

        for (ChannelMapping mapping : mappings) {
            // 1. Recuperer etat PMS
            List<CalendarDay> pmsDays = calendarRepository
                .findByUnitIdAndDateRange(mapping.getInternalId(),
                    LocalDate.now(), LocalDate.now().plusDays(90));

            // 2. Recuperer etat channel (via API)
            List<ChannelCalendarDay> channelDays = channelClient
                .getCalendar(conn, mapping.getExternalId(),
                    LocalDate.now(), LocalDate.now().plusDays(90));

            // 3. Comparer
            List<CalendarDiscrepancy> discrepancies =
                comparator.compare(pmsDays, channelDays);

            if (!discrepancies.isEmpty()) {
                logger.warn("Inventory discrepancy for unit {} on {}: {} diffs",
                    mapping.getInternalId(), conn.getChannel(),
                    discrepancies.size());

                // 4. Auto-fix : PMS est le master
                for (CalendarDiscrepancy d : discrepancies) {
                    syncService.pushCorrection(conn, mapping, d);
                }

                // 5. Alerter si > 5% de divergence
                double divergenceRate =
                    (double) discrepancies.size() / pmsDays.size();
                if (divergenceRate > 0.05) {
                    alertService.warn("High inventory divergence", Map.of(
                        "unit_id", mapping.getInternalId(),
                        "channel", conn.getChannel(),
                        "divergence_rate", divergenceRate,
                        "discrepancies_count", discrepancies.size()));
                }

                // 6. Persister pour tracabilite
                reconciliationRepository.save(ReconciliationRun.builder()
                    .connectionId(conn.getId())
                    .mappingId(mapping.getId())
                    .totalDays(pmsDays.size())
                    .discrepancies(discrepancies.size())
                    .autoFixed(discrepancies.size())
                    .build());
            }
        }
    }
}
```

#### Tracabilite historique complete

- Toute action est tracee dans au moins une table d'audit
- Retention : 2 ans minimum en base, archivage S3 ensuite
- Chaque entree d'audit contient : `who`, `what`, `when`, `where` (IP), `why` (source/context)
- Recherche rapide : index composites sur `(entity_type, entity_id, created_at)`

### Criteres de validation

| Critere | Seuil |
|---------|-------|
| Zero perte reservation sous crash | Prouve par test kill -9 |
| Reconciliation divergence | < 0.5% |
| Auto-fix reussit | > 95% des divergences corrigees automatiquement |
| Audit trail couvre toutes les actions | 100% |

### Livrables attendus

- [ ] `ReconciliationService` avec schedule horaire
- [ ] Table `reconciliation_runs` avec historique
- [ ] Auto-fix engine (push PMS -> channel pour corriger les ecarts)
- [ ] Alerte Grafana sur divergence > 5%
- [ ] Tests de crash recovery (kill -9 pendant operations)
- [ ] Politique de retention et archivage audit trails

---

## Niveau 14 — KPI techniques cibles

### Objectifs

Definir et mesurer en continu les indicateurs de performance techniques minimaux requis pour la certification partenaire.

### KPI minimum

| KPI | Objectif | Critique si non atteint |
|-----|----------|------------------------|
| **Uptime** | >= 99.9% | Rejet candidature |
| **Latence propagation calendrier** | < 30s P95, < 60s P99 | Double bookings |
| **Taux erreur sync** | < 1% sur 24h glissant | Suspension partenariat |
| **Coherence inventaire** | > 99.5% (reconciliation) | Perte confiance |
| **Double bookings** | 0 absolu | Radiation immediate |
| **Latence API** | < 200ms P95, < 500ms P99 | UX degradee |
| **Disponibilite sync** | > 99.5% | Inventaire stale |
| **Temps resolution incident P1** | < 1h | Escalation Airbnb |
| **Kafka consumer lag** | < 1000 messages | Sync delay |
| **Outbox drain time** | < 10s en nominal | Event loss risk |
| **Reconciliation divergence** | < 0.5% | Inventory drift |
| **Test coverage** (critical paths) | > 90% | Regression risk |

### Calcul du score readiness

```
Readiness Score = Sum(KPI_weight x KPI_score) / Sum(KPI_weight)

Si un KPI critique (double booking, uptime) echoue -> score = 0 automatiquement
```

### Livrables attendus

- [ ] Dashboard Grafana "KPI Readiness" avec tous les indicateurs
- [ ] Historique des KPI sur 6 mois glissants
- [ ] Alerte automatique si un KPI passe sous le seuil
- [ ] Rapport mensuel KPI (export PDF)

---

## Niveau 15 — Environnement test et staging

### Objectifs

Disposer d'un environnement de staging isole reproduisant fidelement la production, permettant de tester les scenarios de synchronisation avec le sandbox Airbnb.

### Exigences techniques detaillees

#### Staging isole

- Environnement identique a la production (memes Docker images, meme config, meme infra)
- Base de donnees separee avec donnees anonymisees
- Airbnb Sandbox API pour les tests de sync (Airbnb fournit un environment sandbox pour les partenaires)
- Pas d'acces depuis le reseau public (VPN/bastion uniquement)

#### Donnees realistes

- Script de seed : genere 100+ proprietes avec calendrier, prix, restrictions sur 365 jours
- Donnees basees sur le schema reel (pas de `test123` mais des noms, adresses, prix realistes)
- Reservations historiques simulees sur 6 mois

#### Simulation erreurs reseau

Utiliser Toxiproxy pour simuler :

1. Latence +5s sur toutes les reponses Airbnb
2. Timeout 100% pendant 30s
3. Perte de paquets 50%
4. Connexion reset aleatoire 10%
5. Bande passante limitee a 10KB/s

#### Simulation de charge

- k6 ou Gatling script reproduisant le pattern de trafic production
- Profil : 70% lectures calendrier, 15% modifications prix, 10% reservations, 5% admin
- Montee en charge progressive : 10 -> 50 -> 100 -> 500 -> 1000 req/s
- Duree : minimum 1 heure a charge cible

#### Simulation de conflits

- Script dedie qui cree des reservations concurrentes sur les memes unites
- Verification post-run : 0 double booking, 0 calendrier incoherent
- Log de tous les conflits et leurs resolutions

### Livrables attendus

- [ ] Infrastructure staging (docker-compose ou Terraform)
- [ ] Script de seed donnees realistes
- [ ] Configuration Toxiproxy pour chaos testing
- [ ] Scripts k6/Gatling pour tests de charge
- [ ] Script de simulation conflits concurrents
- [ ] Connexion Airbnb Sandbox API configuree

---

## Niveau 16 — Checklist certification readiness

### Grille d'evaluation

Chaque item est note : PRET / PARTIEL / NON PRET

#### A. Fonctionnalites Metier

| # | Item | Poids | Statut |
|---|------|-------|--------|
| A1 | Gestion proprietes multi-unites complete | 5 | |
| A2 | Calendrier avec disponibilite temps reel | 10 | |
| A3 | Gestion prix par date, saisons, restrictions | 8 | |
| A4 | Creation/modification/annulation reservations | 10 | |
| A5 | Anti-double reservation prouve (tests concurrence) | 15 | |
| A6 | Machine a etats reservation complete | 5 | |
| A7 | Gestion guests avec dedoublonnage | 3 | |
| A8 | Gestion paiements (Stripe ou equivalent) | 3 | |

#### B. Architecture Technique

| # | Item | Poids | Statut |
|---|------|-------|--------|
| B1 | Moteur calendrier transactionnel (advisory locks) | 10 | |
| B2 | Event-driven architecture (Kafka + outbox) | 8 | |
| B3 | Idempotence + retry + DLQ | 8 | |
| B4 | Circuit breaker sur appels externes | 5 | |
| B5 | Resolution de conflits deterministe | 8 | |
| B6 | Moteur de mapping channels abstrait | 5 | |
| B7 | Reconciliation automatique inventaire | 8 | |

#### C. Infrastructure et Ops

| # | Item | Poids | Statut |
|---|------|-------|--------|
| C1 | Uptime > 99.9% prouve (6 mois) | 10 | |
| C2 | Monitoring complet (Prometheus + Grafana) | 5 | |
| C3 | Alerting automatique configure | 5 | |
| C4 | Logs structures centralises | 3 | |
| C5 | Horizontal scaling valide | 5 | |
| C6 | Disaster recovery teste | 5 | |
| C7 | CI/CD pipeline complet | 3 | |

#### D. Securite

| # | Item | Poids | Statut |
|---|------|-------|--------|
| D1 | Authentification JWT + MFA admin | 5 | |
| D2 | RBAC avec isolation multi-tenant | 8 | |
| D3 | Chiffrement donnees sensibles | 5 | |
| D4 | Pentest tiers passe | 5 | |
| D5 | RGPD conforme (DPA, droits exerces) | 3 | |
| D6 | Gestion secrets (pas de hardcode) | 3 | |

#### E. Tests et Qualite

| # | Item | Poids | Statut |
|---|------|-------|--------|
| E1 | Tests anti-double booking (concurrence) | 10 | |
| E2 | Tests integration sync channels | 5 | |
| E3 | Tests resilience (Kafka down, DB failover) | 5 | |
| E4 | Tests de charge valides | 5 | |
| E5 | Coverage > 80% sur le code critique | 3 | |

#### F. Production Reelle

| # | Item | Poids | Statut |
|---|------|-------|--------|
| F1 | > 50 proprietes actives | 10 | |
| F2 | > 500 reservations traitees | 8 | |
| F3 | > 6 mois d'historique | 8 | |
| F4 | Support operationnel avec SLA | 5 | |
| F5 | 0 double booking historique | 15 | |

#### G. Documentation

| # | Item | Poids | Statut |
|---|------|-------|--------|
| G1 | Architecture systeme documentee (C4) | 3 | |
| G2 | API documentation (OpenAPI) | 3 | |
| G3 | Runbooks operationnels | 3 | |
| G4 | SLA publie | 2 | |

### Calcul du score global

```
Score = Sum(item_weight x item_score) / Sum(item_weight) x 100

item_score : PRET = 1.0, PARTIEL = 0.5, NON PRET = 0.0

Seuils :
- Score >= 85% + AUCUN "NON PRET" sur les items poids >= 10  -> PRET A DEPOSER
- Score 70-85%                                                -> PRESQUE PRET
- Score < 70%                                                 -> PAS PRET

Bloquants absolus (score = 0 si NON PRET) :
- A5 : Anti-double reservation
- F5 : 0 double booking historique
- B1 : Moteur calendrier transactionnel
- D2 : Isolation multi-tenant
```

---

## Livrable final — Synthese

### Risques operationnels majeurs

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|-------------|------------|
| Double booking | Radiation partenaire | Faible si tests OK | Advisory lock + tests concurrence |
| Perte evenement sync | Inventaire stale | Moyenne | Outbox pattern + reconciliation |
| Crash DB sans backup | Perte donnees totale | Faible | Streaming replication + backup S3 |
| Fuite donnees cross-tenant | Perte clients + legal | Faible si tests OK | Hibernate Filter + pentest |
| API Airbnb change format | Sync cassee | Moyenne | Versioned transformers + monitoring |
| Rate limiting Airbnb API | Sync retardee | Haute | Batch + queue + backoff |
| Keycloak down | Login impossible | Faible | HA deployment + JWT cache grace period |

### Score global readiness (a evaluer)

```
+-----------------------------------------------------------+
|              PMS AIRBNB PARTNER READINESS                  |
|                                                            |
|  Fonctionnel       [########--]  80%                      |
|  Architecture      [######----]  60%                      |
|  Infrastructure    [########--]  80%                      |
|  Securite          [########--]  80%                      |
|  Tests             [####------]  40%                      |
|  Production reelle [######----]  60%                      |
|  Documentation     [####------]  40%                      |
|                                                            |
|  SCORE GLOBAL:  63%  -- PAS ENCORE PRET                   |
|                                                            |
|  Bloquants: Tests concurrence, Reconciliation engine,     |
|             Event-driven architecture, Documentation       |
+-----------------------------------------------------------+
```

### Prochaines etapes prioritaires

1. **Semaine 1-2** : Implementer le `CalendarEngine` avec advisory locks et le pattern write-ahead log
2. **Semaine 3-4** : Generaliser l'architecture event-driven avec Kafka outbox pattern
3. **Semaine 5-6** : Construire le `ConflictResolver` et les tests de concurrence anti-double booking
4. **Semaine 7-8** : Deployer le moteur de mapping abstrait et connecter au sandbox Airbnb
5. **Semaine 9-10** : Mettre en place l'observabilite complete (Prometheus/Grafana/Loki)
6. **Semaine 11-12** : Executer les tests de charge et valider la scalabilite
7. **Semaine 13-14** : Rediger la documentation technique et les runbooks
8. **Semaine 15-17** : Accumuler les preuves de production et preparer le dossier de candidature

---

> **Note** : Ce document est evolutif. Chaque niveau doit etre valide par une revue technique
> avant de passer au suivant. Le score global readiness doit etre recalcule apres chaque phase.
