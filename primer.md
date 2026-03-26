# Clenzy — Primer

> Contexte projet persistant. Lu automatiquement en debut de session Claude Code.
> Derniere mise a jour : 2026-03-22

## Identite

**Clenzy** est un PMS (Property Management System) SaaS multi-tenant pour la location courte duree.
Il permet aux proprietaires et gestionnaires de gerer leurs logements, reservations, calendriers, tarifs, guests, interventions, facturation et communication.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | Java 21, Spring Boot 3.2, JPA/Hibernate |
| Frontend | React 18, TypeScript, MUI (Material UI) |
| Auth | Keycloak 24 (realm `clenzy` pour PMS, realm `clenzy-guests` pour booking engine) |
| Base de donnees | PostgreSQL 16 |
| Cache | Redis 7 |
| Messaging | Apache Kafka (KRaft mode) |
| Migrations | Liquibase (YAML + SQL changesets) |
| Infra | Docker Compose (dev), Nginx reverse proxy (prod) |
| Monitoring | Prometheus + Grafana |
| Paiement | Stripe (Connect + Checkout) |
| Email | Brevo (transactionnel), Postal (auto-heberge) |
| Telephonie | Twilio (SMS + WhatsApp) |
| Capteurs IoT | Minut (bruit, temperature) |
| Serrures | Nuki, KeyNest |
| Channels | Airbnb API, iCal (Booking.com, Vrbo, etc.) |

## Architecture multi-tenant

- Chaque organisation a un `organization_id`
- Hibernate `@Filter` sur toutes les entites metier
- `TenantFilter` dans la security chain extrait l'org du JWT
- Le `TenantContext` (ThreadLocal) est injecte partout
- Les platform staff (SUPER_ADMIN, SUPER_MANAGER) peuvent acceder a toutes les orgs

## Roles utilisateur

| Role | Perimetre | Acces |
|------|-----------|-------|
| SUPER_ADMIN | Plateforme | Tout |
| SUPER_MANAGER | Plateforme | Lecture cross-org + gestion |
| HOST | Organisation | Gestion complete de ses biens |
| TECHNICIAN | Organisation | Interventions uniquement |
| HOUSEKEEPER | Organisation | Menage + inventaire |
| SUPERVISOR | Organisation | Supervision equipes |
| BOOKING_GUEST | Booking Engine | Reservation + compte guest |

## Modules principaux

### PMS (app.clenzy.fr)
- Dashboard KPI, calendrier multi-proprietes
- Reservations (CRUD, iCal sync, channel sync)
- Tarification dynamique (PriceEngine 6 niveaux)
- Guests + messaging (email, SMS, WhatsApp)
- Interventions (menage, maintenance, check-in/out)
- Facturation (Stripe Connect, NF compliance)
- Notifications (in-app, email, push)
- Administration (users, orgs, permissions, audit)

### Booking Engine (SDK embarquable)
- Widget JS integrable sur n'importe quel site
- Recherche par dates, types, voyageurs
- Calendrier 2 mois avec prix dynamiques
- Panier multi-sejours
- Auth guest (Keycloak realm separe)
- Paiement Stripe Checkout
- Multi-langue (fr, en, ar) + RTL

### CalendarEngine
- Source de verite pour les disponibilites
- `CalendarDay` table : (property_id, date) → status
- Absence de ligne = disponible (convention Clenzy)
- Outbox pattern → Kafka → ChannelSyncService

### PriceEngine
- Resolution 6 niveaux : RateOverride → Promotional → Seasonal → LastMinute → Base → nightlyPrice
- YieldRules pour ajustements automatiques

## Structure du code

```
server/src/main/java/com/clenzy/
  booking/       # Booking Engine (controllers, services, DTOs)
  config/        # Spring Security, Keycloak, CORS, filters
  controller/    # REST endpoints PMS
  dto/           # Data Transfer Objects
  exception/     # Exceptions metier + handler global
  integration/   # Airbnb, Kafka, Minut, Nuki, Stripe
  model/         # Entities JPA
  repository/    # Spring Data interfaces
  scheduler/     # Taches planifiees (iCal, noise, pricing)
  service/       # Logique metier
  tenant/        # Multi-tenancy (TenantFilter, TenantContext)
  util/          # Utilitaires (StringUtils, etc.)

client/src/
  components/    # Composants partages UI
  config/        # API, Keycloak config
  hooks/         # Custom hooks
  i18n/          # Traductions (fr, en, ar)
  modules/       # Features (admin, booking-engine, dashboard, etc.)
  services/api/  # Couche API fetch + types
  theme/         # Theme MUI (dark/light)
```

## Conventions critiques

1. **Migrations** : Liquibase `NNNN__description.sql`, jamais Flyway
2. **Docker** : Ne jamais restart sans demander a l'utilisateur
3. **Preview** : Ne jamais lancer sauf demande explicite
4. **Securite** : `@PreAuthorize` obligatoire sur chaque controller
5. **Ownership** : Valider que le requester est proprietaire ou ADMIN
6. **HTML** : Toujours echapper les inputs user (StringUtils.escapeHtml)
7. **Tokens** : Jamais dans localStorage, cookies HttpOnly uniquement
8. **Commits** : Pas de "Generated with Claude Code"
9. **RTK** : Toujours prefixer les commandes avec `rtk`

## Fichiers sensibles (ne pas modifier sans review)

- `SecurityConfigProd.java` — regles d'autorisation globales
- `SecurityConfig.java` — config dev (plus permissive)
- `nginx.conf.template` — headers HTTP securite prod
- `application.yml` — config Spring globale
- `db.changelog-master.yaml` — orchestration migrations

## Environnement dev

- Backend : `http://localhost:8084` (via Docker)
- Frontend : `http://localhost:3000` (Vite dev server)
- Keycloak : `http://localhost:8086`
- PostgreSQL : port 5434
- Redis : port 6380
- Kafka : port 9093
