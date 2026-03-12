# Booking Engine — Architecture & Plan d'implementation

## Vue d'ensemble

Le Booking Engine Clenzy est un **moteur de reservation headless** qui s'integre sur n'importe quel site client via un SDK JavaScript leger. L'integrateur controle 100% du design ; le SDK fournit la logique metier (disponibilite, tarification, paiement Stripe).

### Principes fondamentaux

| Principe | Description |
|----------|-------------|
| **Headless-first** | Le SDK fournit donnees + logique, l'integrateur cree son propre UI |
| **Technology-agnostic** | Fonctionne sur WordPress, Wix, Squarespace, React, Vue, Angular, HTML statique |
| **Leger** | SDK core ~8KB gzip (vanilla JS, zero dependance framework) |
| **Securise** | API Key par org + CORS par domaine + rate limiting + Turnstile CAPTCHA |
| **Sync automatique** | Une resa via le widget bloque les dates sur Airbnb/Booking/Expedia via le pipeline Kafka existant |

---

## Architecture

```
Integrator's Website (any technology)
+------------------------------------------------------+
|                                                      |
|   Custom HTML/CSS/React/Vue/...   <-- Design libre   |
|        |                                             |
|        v                                             |
|   clenzy-booking-sdk.js  (headless core)             |
|   - ClenzyBooking class                              |
|   - State management (events)                        |
|   - API client (fetch)                               |
|   - Stripe redirect                                  |
|   - TypeScript types fournis                         |
|        |                                             |
+--------+---------------------------------------------+
         | HTTPS (fetch, JSON)
         v
+------------------------------------------------------+
|          Clenzy Backend - Public Booking API          |
|                                                      |
|  /api/public/booking/{orgSlug}/...                   |
|  - Auth: API Key (header X-Booking-Key)              |
|  - CORS: domaines autorises par organization         |
|  - Rate limit: 60 req/min IP (mutations: 10/min)    |
|                                                      |
|  Services reutilises:                                |
|  CalendarEngine -> PriceEngine -> StripeService      |
|  GuestService -> GuestMessagingService               |
|  ChannelSyncService (outbound vers OTAs)             |
+------------------------------------------------------+
```

---

## SDK JavaScript — API Headless

### Installation

```html
<!-- CDN -->
<script src="https://cdn.clenzy.fr/booking-sdk/v1/clenzy-booking.min.js"></script>

<!-- ou NPM -->
<!-- npm install @clenzy/booking-sdk -->
```

### Utilisation par l'integrateur

```js
// 1. Initialiser
const booking = new ClenzyBooking({
  org: 'hotel-paris',         // slug de l'organisation
  apiKey: 'bk_live_xxxxxx',   // cle API publique
});

// 2. Charger la config (theme, devise, langues)
const config = await booking.getConfig();
// { primaryColor, logoUrl, currency, languages, cancellationPolicy, ... }

// 3. Lister les proprietes
const properties = await booking.getProperties();
// [{ id, name, type, mainPhotoUrl, priceFrom, maxGuests, bedroomCount, ... }]

// 4. Detail d'une propriete
const property = await booking.getProperty(42);
// { id, name, description, photos[], amenities[], nightlyPrice, minNights, ... }

// 5. Verifier disponibilite + calculer prix
const availability = await booking.checkAvailability({
  propertyId: 42,
  checkIn: '2026-04-01',
  checkOut: '2026-04-04',
  guests: 2,
});
// {
//   available: true,
//   nights: 3,
//   breakdown: [{ date, price, rateType }],
//   subtotal: 390.00,
//   cleaningFee: 50.00,
//   touristTax: 6.00,
//   total: 446.00,
//   currency: 'EUR',
//   checkInTime: '15:00',
//   checkOutTime: '11:00'
// }

// 6. Creer la reservation (PENDING)
const reservation = await booking.reserve({
  propertyId: 42,
  checkIn: '2026-04-01',
  checkOut: '2026-04-04',
  guests: 2,
  guest: {
    name: 'Jean Dupont',
    email: 'jean@example.com',
    phone: '+33612345678',  // optionnel
  },
  notes: 'Arrivee tardive vers 20h',
});
// { reservationCode: 'RES-ABC123', status: 'PENDING', expiresAt: '...' }

// 7. Rediriger vers Stripe Checkout
await booking.checkout(reservation.reservationCode);
// -> redirect navigateur vers Stripe, puis retour sur successUrl

// 8. Page de confirmation (apres paiement)
const confirmation = await booking.getConfirmation(reservation.reservationCode);
// { status: 'PAID', propertyName, checkIn, checkOut, total, guestName, ... }
```

### Evenements (pour UI reactive)

```js
booking.on('loading', (isLoading) => { /* spinner */ });
booking.on('error', (error) => { /* afficher erreur */ });
booking.on('availability:checked', (result) => { /* mettre a jour UI */ });
booking.on('reservation:created', (reservation) => { /* confirmation */ });
```

### TypeScript

```ts
import { ClenzyBooking, type Property, type AvailabilityResult } from '@clenzy/booking-sdk';
```

---

## Backend — Public Booking API

### Endpoints

| Endpoint | Methode | Description | Rate limit |
|----------|---------|-------------|------------|
| `/{slug}/config` | GET | Theme, logo, devise, politiques | 120/min/IP |
| `/{slug}/properties` | GET | Liste proprietes publiees (pagine) | 120/min/IP |
| `/{slug}/properties/{id}` | GET | Detail + photos + amenities | 120/min/IP |
| `/{slug}/availability` | POST | Dispo + prix detaille par nuit | 60/min/IP |
| `/{slug}/reserve` | POST | Creer reservation PENDING | 10/min/IP |
| `/{slug}/checkout` | POST | Creer Stripe Checkout Session | 10/min/IP |
| `/{slug}/booking/{code}` | GET | Confirmation post-paiement | 30/min/IP |

**Base path** : `/api/public/booking`

### Securite

- **API Key** : header `X-Booking-Key` obligatoire sur toutes les requetes
- **CORS** : seuls les domaines configures par l'organisation dans `BookingEngineConfig.allowedOrigins`
- **Rate limiting** : par IP, plus strict sur mutations (reserve/checkout)
- **Turnstile** : CAPTCHA invisible Cloudflare sur reserve/checkout (optionnel, configurable)
- **Expiration** : reservations PENDING expirent apres 30 min si non payees

### Reponse Availability (detail)

```json
{
  "available": true,
  "propertyId": 42,
  "propertyName": "Studio Marais",
  "checkIn": "2026-04-01",
  "checkOut": "2026-04-04",
  "guests": 2,
  "nights": 3,
  "breakdown": [
    { "date": "2026-04-01", "price": 120.00, "rateType": "SEASONAL" },
    { "date": "2026-04-02", "price": 120.00, "rateType": "SEASONAL" },
    { "date": "2026-04-03", "price": 150.00, "rateType": "PROMOTIONAL" }
  ],
  "subtotal": 390.00,
  "cleaningFee": 50.00,
  "touristTax": 6.00,
  "total": 446.00,
  "currency": "EUR",
  "minStay": 2,
  "maxGuests": 4,
  "checkInTime": "15:00",
  "checkOutTime": "11:00"
}
```

### Reponse Reserve

```json
{
  "reservationCode": "RES-A7B3C9",
  "status": "PENDING",
  "propertyName": "Studio Marais",
  "checkIn": "2026-04-01",
  "checkOut": "2026-04-04",
  "total": 446.00,
  "currency": "EUR",
  "expiresAt": "2026-03-11T15:30:00Z"
}
```

---

## Modele de donnees

### BookingEngineConfig (nouvelle entite)

```sql
CREATE TABLE booking_engine_configs (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL UNIQUE REFERENCES organizations(id),
    enabled         BOOLEAN NOT NULL DEFAULT false,
    api_key         VARCHAR(64) NOT NULL UNIQUE,

    -- Theming
    primary_color   VARCHAR(7) DEFAULT '#2563eb',
    accent_color    VARCHAR(7),
    logo_url        VARCHAR(500),
    font_family     VARCHAR(100),

    -- Comportement
    default_language VARCHAR(5) DEFAULT 'fr',
    default_currency VARCHAR(3) DEFAULT 'EUR',
    min_advance_days INTEGER DEFAULT 1,
    max_advance_days INTEGER DEFAULT 365,

    -- Politiques
    cancellation_policy TEXT,   -- JSON
    terms_url           VARCHAR(500),
    privacy_url         VARCHAR(500),

    -- Securite
    allowed_origins TEXT,       -- CSV: "https://example.com,https://www.example.com"

    -- Options
    collect_payment_on_booking BOOLEAN DEFAULT true,
    auto_confirm               BOOLEAN DEFAULT true,
    show_cleaning_fee          BOOLEAN DEFAULT true,
    show_tourist_tax           BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_bec_api_key ON booking_engine_configs(api_key);
CREATE INDEX idx_bec_org     ON booking_engine_configs(organization_id);
```

### Property — champ ajoute

```sql
ALTER TABLE properties ADD COLUMN booking_engine_visible BOOLEAN DEFAULT false;
```

Ce flag controle quelles proprietes sont exposees via le Booking Engine public.

---

## Flux de reservation complet

```
1. Guest arrive sur le site client
   |
2. SDK charge config + properties
   | GET /config, GET /properties
   |
3. Guest selectionne dates + propriete
   |
4. SDK verifie disponibilite + calcule prix
   | POST /availability
   | -> CalendarEngine.checkAvailability()
   | -> PriceEngine.resolveRange()
   | -> RestrictionEngine.validate()
   |
5. Guest remplit ses infos (nom, email)
   |
6. SDK cree reservation PENDING
   | POST /reserve
   | -> CalendarEngine.book() [advisory lock, dates bloquees]
   | -> GuestService.findOrCreate()
   | -> Reservation(source="direct", sourceName="Booking Engine")
   | -> Timer: expiration 30 min si non paye
   |
7. SDK redirige vers Stripe Checkout
   | POST /checkout -> Stripe Session URL
   | -> redirect navigateur
   |
8. Guest paie sur Stripe
   |
9. Webhook Stripe -> confirmReservationPayment()
   | -> PaymentStatus.PAID
   | -> AutoInvoiceService (facture auto)
   | -> GuestMessagingService (email confirmation)
   | -> OutboxPublisher -> Kafka -> ChannelSyncService
   |     -> Airbnb: dates bloquees
   |     -> Booking.com: dates bloquees
   |     -> Expedia: dates bloquees
   |
10. Guest voit page de confirmation
    | GET /booking/{code}
```

---

## Approche Headless vs Pre-built

| | Headless SDK | Pre-built Web Component (futur) |
|---|---|---|
| **Public cible** | Integrateurs, agences web, devs | Clients sans dev, plug & play |
| **Design** | 100% libre (integrateur) | Preset avec theming CSS vars |
| **Complexite** | Necessite du code JS | Copier-coller 2 lignes HTML |
| **Taille** | ~8KB (SDK seul) | ~30KB (SDK + UI + styles) |
| **Priorite** | **Phase 1 (maintenant)** | Phase 2 (futur, optionnel) |

On commence par le SDK headless. Le Web Component pre-built pourra etre construit PAR-DESSUS le SDK plus tard comme couche de convenance.

---

## Structure des fichiers (cible)

### Backend
```
server/src/main/java/com/clenzy/
  booking/
    model/
      BookingEngineConfig.java
    repository/
      BookingEngineConfigRepository.java
    dto/
      PublicPropertyDto.java
      PublicPropertyDetailDto.java
      AvailabilityRequestDto.java
      AvailabilityResponseDto.java
      BookingReserveRequestDto.java
      BookingReserveResponseDto.java
      BookingCheckoutRequestDto.java
      BookingConfirmationDto.java
      BookingEngineConfigDto.java
    service/
      PublicBookingService.java
    controller/
      PublicBookingController.java
    security/
      BookingApiKeyFilter.java
      BookingCorsFilter.java
```

### SDK (nouveau sous-projet)
```
booking-sdk/
  src/
    index.ts              # Entry point + ClenzyBooking class
    api-client.ts         # HTTP fetch wrapper
    types.ts              # TypeScript interfaces
    events.ts             # EventEmitter leger
    stripe.ts             # Stripe redirect helper
  package.json
  tsconfig.json
  vite.config.ts          # Build CDN + ESM + CJS
  README.md
```

---

## Phases d'implementation

### Phase 1 : Modele + Migration (backend)
- `BookingEngineConfig` entity + repository
- Migration V102
- `Property.bookingEngineVisible` flag
- **Fichiers** : model, repository, migration

### Phase 2 : API publique read-only (backend)
- `PublicBookingController` : config, properties, property detail, availability
- `PublicBookingService` : logique metier (reutilise CalendarEngine, PriceEngine)
- DTOs publics (pas d'info sensible)
- **Fichiers** : controller, service, DTOs

### Phase 3 : API publique mutations (backend)
- Reserve : cree reservation PENDING avec expiration
- Checkout : cree Stripe Checkout Session
- Confirmation : retourne donnees post-paiement
- Integration avec StripeService, GuestService, ChannelSyncService existants
- **Fichiers** : controller (suite), service (suite)

### Phase 4 : Securite (backend)
- `BookingApiKeyFilter` : valide X-Booking-Key, resout l'org
- CORS dynamique par org (allowedOrigins de BookingEngineConfig)
- Rate limiting renforce pour /api/public/booking/**
- **Fichiers** : filter, config CORS

### Phase 5 : SDK JavaScript headless
- Classe `ClenzyBooking` : init, getConfig, getProperties, checkAvailability, reserve, checkout
- EventEmitter pour loading/error/success
- Types TypeScript
- Build Vite : CDN (IIFE) + ESM + CJS
- **Fichiers** : booking-sdk/*

### Phase 6 : PMS UI
- Page configuration Booking Engine dans les parametres
- Generateur de snippet (copier-coller pour le client)
- Toggle par propriete (bookingEngineVisible)
- **Fichiers** : client/src/modules/settings/BookingEngineSettings.tsx

---

## Services existants reutilises

| Service | Role dans le Booking Engine |
|---------|---------------------------|
| CalendarEngine | Verification dispo + reservation des dates (advisory lock) |
| PriceEngine | Resolution tarif par nuit (override > promo > seasonal > base) |
| RestrictionEngine | Validation min/max stay, regles de booking |
| StripeService | Creation Checkout Session pour reservation |
| GuestService | Creation/deduplication guest par email |
| GuestMessagingService | Email de confirmation avec template |
| AutoInvoiceService | Generation facture auto au paiement |
| ChannelSyncService | Sync dispo vers Airbnb/Booking/Expedia post-reservation |
| OutboxPublisher | Publication evenement Kafka (meme transaction) |

---

## Securite — Detail

### API Key
- Format : `bk_live_` + 32 chars aleatoires (UUID sans tirets)
- Stockee hashee en base (SHA-256), seule la version en clair est donnee une fois
- Revocable depuis le PMS
- Une seule cle active par organisation

### CORS dynamique
- Chaque org configure ses domaines autorises
- Le filtre CORS lit `BookingEngineConfig.allowedOrigins` pour l'org resolue
- Requetes depuis un domaine non autorise → bloquees (pas de header CORS)

### Rate limiting
- Redis-based (existant, etendu)
- Key : `booking:ip:{ip}` et `booking:ip:{ip}:mutations`
- Lectures : 120 req/min
- Mutations (reserve, checkout) : 10 req/min
- Reponse 429 avec Retry-After

### Expiration des reservations
- Reservation PENDING creee avec `expiresAt = now() + 30 min`
- Scheduler (cron toutes les 5 min) : annule les PENDING expirees
- Libere les dates via `CalendarEngine.cancel()`
