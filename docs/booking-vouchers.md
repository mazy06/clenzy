# Booking Vouchers — Promos sur les nuitées

## Vue d'ensemble

Système de codes promo / campagnes auto appliqués au prix des nuitées dans
le booking engine. **Distinct** du `PlatformPromoCode` (admin Baitly, codes
pour abonnements PMS via Stripe).

## Architecture

```
PriceEngine (9 niveaux)
  RateOverride → Promotional → Event → Weekend → Seasonal
  → EarlyBird → LastMinute → Base → nightlyPrice
                 ↓
              prix publié (ex: 167 €/nuit × 3 = 501 €)
                 ↓
VoucherEngine.apply(voucher, quote)
                 ↓
            discount appliqué (ex: -20 % = 100 €)
                 ↓
   Quote final = 401 € → Reservation + audit row dans voucher_usage
```

## Tables (migration 0157)

| Table | Rôle |
|---|---|
| `booking_voucher` | Voucher principal (org-scopé) avec discount, validité, plafonds, scope canal/status/creator |
| `voucher_property_scope` | M2M voucher ↔ properties. Vide = applicable à toutes les properties de l'org |
| `voucher_usage` | Audit ledger : 1 row par application (CA brut, discount, CA net, guest_email) |

**Colonnes ajoutées** :
- `organization.has_voucher_contract` : booléen flag-plateforme (contrat conciergerie signé)
- `property.org_can_create_vouchers` : consentement host par-property
- `reservation.{original_total, discount_amount, voucher_code, booking_voucher_id}` : trace de l'application

## Permissions

| Créateur | Condition |
|---|---|
| **HOST** | `property.owner_id == requester.userId` ET `property.organization_id == requester.orgId` |
| **MANAGEMENT_ORG** | `organization.has_voucher_contract = true` ET `property.org_can_create_vouchers = true` pour CHAQUE property cible |

Auto-detection dans `BookingVoucherController` : si toutes les properties cibles
sont owned par le requester, type = HOST. Sinon = MANAGEMENT_ORG (le service
applique alors les checks supplémentaires).

## Endpoints REST

### Admin (PMS, `@PreAuthorize("isAuthenticated()")`)
| Méthode | Path | Description |
|---|---|---|
| GET | `/api/vouchers?status=` | Liste org (filtre optionnel par statut) |
| GET | `/api/vouchers/{id}` | Détail |
| POST | `/api/vouchers` | Créer |
| PUT | `/api/vouchers/{id}` | Modifier |
| DELETE | `/api/vouchers/{id}` | Supprimer (refusé si `usage_count > 0`) |
| POST | `/api/vouchers/{id}/pause` | Pause rapide |
| POST | `/api/vouchers/{id}/resume` | Resume rapide |
| GET | `/api/vouchers/analytics?from=&to=` | Aggregation org-level + top 5 (default 30 derniers jours) |
| GET | `/api/vouchers/{id}/analytics` | Stats per-voucher (avgDiscountPct) |

### Public (booking engine, `@PreAuthorize("permitAll()")`)
| Méthode | Path | Description |
|---|---|---|
| POST | `/api/public/vouchers/validate` | Preview discount pour le widget guest |

## Booking flow intégration

```typescript
// 1. Vérifier disponibilité
const availability = await booking.checkAvailability({...});

// 2. Pré-valider le code (UX critique)
const v = await booking.validateVoucher({
  organizationId: 42,
  code: 'WELCOME20',
  propertyId: 100,
  stayNights: 3,
  subtotal: availability.total,
  guestEmail: 'jane@example.com',
});
if (!v.valid) showError(i18n(`voucher.error.${v.errorCode}`));

// 3. Réserver avec le code
await booking.reserve({
  ...,
  voucherCode: 'WELCOME20', // null si pas de voucher
});
```

Côté backend (`PublicBookingService.reserve`) :
1. Calcul `availability.total` via PriceEngine
2. Si `voucherCode` présent, `VoucherEngine.validate` + `apply`
3. Save Reservation avec `original_total` + `discount_amount` + `voucher_code` + `booking_voucher_id`
4. `recordUsage` atomique (CAS sur `max_uses_total`)
5. Race condition → rollback les champs voucher + resave (booking conservé, sans discount)

## Codes d'erreur validation

12 codes traduisibles i18n (`vouchers.error.NOT_FOUND`, etc.) :

| Code | Cas |
|---|---|
| `NOT_FOUND` | Code introuvable / faute de frappe |
| `DRAFT_NOT_ACTIVE` | Voucher en draft |
| `PAUSED` | Voucher temporairement pause |
| `EXPIRED` | Statut EXPIRED OU `valid_until` passé |
| `NOT_YET_ACTIVE` | `valid_from` futur |
| `PROPERTY_NOT_IN_SCOPE` | Property pas dans le scope |
| `MIN_STAY_NOT_MET` / `MAX_STAY_EXCEEDED` | Contrainte sejour |
| `MIN_TOTAL_NOT_MET` | Sous-total < `min_total_amount` |
| `USAGE_LIMIT_REACHED` | `max_uses_total` atteint |
| `GUEST_LIMIT_REACHED` | Guest a déjà utilisé `max_uses_per_guest` fois |
| `CHANNEL_NOT_ALLOWED` | Channel mismatch (non ALL) |
| `INVALID_INPUT` | Inputs malformés |

## Concurrence

`tryIncrementUsage` (`UPDATE WHERE max_uses_total IS NULL OR usage_count < max_uses_total`)
protège contre la race sur le plafond global. Retourne 0 rows si la dernière
place a été consommée par un autre booking simultané → `recordUsage` renvoie
`Optional.empty()` et le caller (PublicBookingService) rollback les champs
voucher sur la reservation.

`max_uses_per_guest` est vérifié au moment de `validate` (non atomique sur ce
plafond — race théorique mais l'impact est limité : 2 bookings simultanés
pourraient bypass cette limite, ce qui est acceptable pour V1).

## V1 → V2

Pas implémenté en V1 :
- `FREE_NIGHTS` discount type (nécessite per-night breakdown du quote)
- Rate limiting sur `/api/public/vouchers/validate` (anti brute-force)
- Auto-pré-fill URL `?voucher=X` côté booking widget (le SDK expose
  `validateVoucher()`, le consumer gère le query param)
- Graph chronologique dans analytics (KPI + top 5 suffisent pour V1)

## Phases du chantier

| Phase | Commit | Livrable |
|---|---|---|
| P1 | `d7c60eb9` | Data model : migration 0157 + entités + repos |
| P2 | `f458488c` | `VoucherEngine` + `BookingVoucherService` + 26 tests unit |
| P3 | `49c4d31f` | Controllers REST + intégration `PublicBookingService.reserve` |
| P4 | `1bc07052` | UI host `/vouchers` (tab + dialog) |
| P5 | `4ebbc2e7` | Booking SDK voucherCode + toggle `orgCanCreateVouchers` |
| P6 | `a7935518` | Endpoint analytics + KPI panel UI |
| P7 | (this) | Sidebar nav + i18n EN/AR + doc |
