# Inventaire interne — Domaine 2 : Moteur de réservation & site direct

> Vérité terrain adossée au code Clenzy (`server/`, `client/`, `booking-sdk/`).
> Grille : 0 Absent · 1 Basique · 2 Standard · 3 Avancé.
> Date : 2026-06-13. Lot B2.

## Tableau de couverture

| Fonctionnalité | Statut | Preuve code | Score |
|----------------|--------|-------------|:-----:|
| Moteur de réservation public par organisation (slug + API key) | Implémenté | `server/.../booking/service/PublicBookingService.java` (1242 l.), tests `PublicBookingServiceTest.java` (1574 l.) | 3 |
| Disponibilité temps réel synchronisée au calendrier | Implémenté | `booking/service/BookingEngineCalendarService.java`, `booking/controller/BookingEngineCalendarController.java`, DTO `CalendarAvailabilityResponseDto` | 3 |
| Paiement direct Stripe Checkout (session + webhook signé) | Implémenté | Flux Stripe Checkout côté booking + webhook signé, circuit breaker (cf. `payment/`) | 3 |
| Codes promo / vouchers avec scope et limites | Implémenté | `VoucherEngine`, `model/BookingVoucher.java`, `VoucherPropertyScope`, `VoucherUsage` ; scopes ALL/BOOKING_ENGINE/DIRECT_LINK/WHATSAPP/EMAIL, min/max stay, limites d'usage | 3 |
| Auth guest dédiée (realm séparé) | Implémenté | Keycloak realm `clenzy-guests` (cf. primer + `config/SecurityConfig`) | 2 |
| Multi-devise (EUR/MAD/SAR/USD/GBP) | Implémenté | `ExchangeRate`, support multi-devise booking | 2 |
| SDK JS embarquable (widget headless, events) | Implémenté (partiel) | `booking-sdk/src/` : `index.ts`, `api-client.ts`, `events.ts`, `types.ts` ; build Vite ; **pas d'i18n embarqué dans le SDK** | 2 |
| Panier multi-séjours (plusieurs séjours / propriétés) | Implémenté (partiel) | `client/.../booking-engine/components/BookingCartPage.tsx` (410 l.) | 2 |
| Site web / builder inclus (design, CSS/JS, design tokens) | Implémenté (partiel) | `BookingEnginePage.tsx`, `BookingEngineCssEditor.tsx`, `BookingEngineJsEditor.tsx`, `DesignTokenEditor.tsx`, `AiDesignMatcher.tsx`, `BookingEnginePreview.tsx`, `ComponentVisibilityConfig.tsx` — éditeur de design/tokens + CSS/JS, **pas un builder de pages drag-and-drop type Lodgify** | 2 |
| Politiques d'annulation | Implémenté (côté channel) | `model/CancellationPolicyType.java` (FLEXIBLE/MODERATE/FIRM/STRICT/SUPER_STRICT/NON_REFUNDABLE/CUSTOM), `ChannelCancellationPolicy`, `ChannelCancellationPolicyService` — orienté OTA, exposition au booking direct à confirmer | 2 |
| Multi-langue interface (FR/EN/AR) | Implémenté (PMS) / partiel (booking) | `client/src/i18n/locales/{fr,en,ar}.json` côté PMS ; portée AR sur le booking engine public à confirmer | 2 |
| RTL (arabe droite-à-gauche) | Absent | Aucune trace `dir="rtl"` / direction RTL dans `modules/booking-engine/` | 0 |
| Email de confirmation de réservation (booking direct) | À confirmer | Pas de `sendBookingConfirmation` / `EmailService` repéré dans `booking/service/PublicBookingService.java` ; pattern email présent ailleurs (`EmailService`) mais branchement booking direct non prouvé | 1 |
| SEO du site direct (meta, schema, sitemap, blog) | Non documenté | Aucun module SEO/blog/sitemap repéré dans `booking-engine/` | 0 |

## Synthèse interne

- **Forces** : booking engine public robuste et testé (`PublicBookingService` 1242 l. + 1574 l. de tests), moteur de vouchers riche et scopé, paiement Stripe Checkout direct, **panier multi-séjours** (rare sur le marché), éditeur de design avec design tokens + assistant IA de matching de design.
- **Faiblesses** : SDK sans i18n embarqué ni RTL ; **pas de website builder de pages** (templates/drag-and-drop) comparable à Lodgify/Guesty/Hostaway ; **SEO/blog absents** ; email de confirmation booking direct non prouvé dans le code ; RTL absent.
- **Score interne domaine 2 = 2 / 3** (cohérent avec le cadrage §7). Le booking engine + paiement + vouchers sont au niveau « avancé », mais l'absence de builder de site et de SEO tire la moyenne vers « standard ».
