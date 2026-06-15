# Inventaire interne — Domaine 10 : Intégrations & API / Écosystème

> **Source de vérité :** code `server/src/main/java/com/clenzy/`. Statut + preuve fichier.
> **Date :** 2026-06-13 · **Lot :** B9
> Grille 0–3 (0 absent · 1 basique/contournement · 2 standard marché · 3 avancé/différenciant).

---

## 1. Périmètre du domaine

Capteurs & objets connectés (serrures, bruit, caméras), catalogue/marketplace d'intégrations, API publique + webhooks pour développeurs tiers, connecteurs OTA partenaires (non-channel), connecteurs comptables et automatisation (Zapier/Make).

---

## 2. Constats code (vérité terrain)

### 2.1 IoT / objets connectés — **Implémenté, mature**

| Brique | Preuve code | Statut |
|--------|-------------|--------|
| Serrures Nuki (verrou + codes d'accès dynamiques, auto-rotation) | `integration/nuki/`, migration `0220` (auto-rotate) | ✅ Implémenté |
| KeyNest (réseau d'échange de clés) | `integration/keynest/`, `controller/KeyExchangePublicController.java` | ✅ Implémenté |
| Minut (capteur bruit/température, API v8) | `integration/minut/` | ✅ Implémenté |
| Tuya (caméras) | `integration/tuya/` | ✅ Implémenté |
| Netatmo (capteurs) | `integration/netatmo/` | ✅ Présent |
| Streaming caméra go2rtc (WebRTC/RTSP/HLS) | infra `clenzy-go2rtc-prod`, CSP nginx | ✅ Déployé (prod) |
| Agrégation multi-devices + capteurs environnement | `service` (DeviceAggregationService, EnvironmentSensorService — cf. inventaire) | ✅ Implémenté |

**Constat :** couverture IoT large et réellement câblée (pas des stubs). Nuki avec rotation automatique des codes = niveau au-dessus du simple « code statique ».

### 2.2 Marketplace / catalogue d'intégrations — **Implémenté, mais vitrine**

- `service/MarketplaceService.java` + `controller/MarketplaceController.java` : catalogue **codé en dur de 12 partenaires** (`CATALOG`), org-scopé, statuts CONNECTED/DISCONNECTED, clés API chiffrées (`ApiKeyEncryptionService`).
- Catalogue : PriceLabs, Beyond Pricing, Wheelhouse (pricing) · KeyNest, Igloohome (clés) · Turno, Properly (ménage) · Pennylane, QuickBooks (compta) · Autohost (screening) · Minut, Nuki (domotique).
- **Réserve :** une partie de ce catalogue est une **vitrine** (entrées d'affichage). Les intégrations réellement câblées de bout en bout sont Nuki, Minut, KeyNest, Tuya, Pennylane (+ Channex/OTA côté channel, hors périmètre d10). Beyond Pricing = stub ; QuickBooks/Xero/Sage = OAuth sans synchro effective.

### 2.3 API publique + webhooks — **Implémenté, niveau standard**

- `controller/PublicApiController.java` sur `/api/developer` : gestion de **clés API** (création/révocation, clé en clair affichée une seule fois) + **webhooks** sortants.
- `service/WebhookDispatchService.java` : abonnement par type d'événement (wildcard `*` supporté), en-tête `X-Clenzy-Event`, dispatch org-scopé.
- `service/ApiKeyService.java` : clés scopées et révocables.
- `controller/PublicApiController.java` protégé `@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")`.
- **Réserve :** API « développeur » fonctionnelle mais à maturer (pas de portail dev public documenté repéré, pas de SDK officiel, catalogue d'événements webhook non normalisé/limité). Pas de connecteur **Zapier/Make** natif repéré.

### 2.4 OTA partenaires (hors channel manager) — **Absents**

- HomeToGo / GetYourGuide / Klook : **absents** (handoffs/stubs uniquement, cf. `HANDOFF_HOMETOGO.md`). Pas d'adapter opérationnel.
- À distinguer du channel management (Channex/Airbnb/Booking) traité au domaine 1.

### 2.5 Autres connecteurs présents

- `integration/openmeteo/` (météo/géocoding, sans clé), `integration/holidays/`, `integration/overpass/` (POI OSM), `integration/google/`, `integration/brevo/` (email), `integration/activities/` (livret).

---

## 3. Score interne justifié

| Fonctionnalité (d10) | Score | Justification (preuve) |
|----------------------|:-----:|------------------------|
| Serrures connectées | **3** | Nuki + KeyNest + Igloohome (catalogue) ; rotation auto codes (0220) |
| Capteurs bruit/environnement | **2** | Minut v8 + Netatmo ; standard (pas de NoiseAware/multi-fournisseurs) |
| Caméras / streaming | **2** | Tuya + go2rtc déployé ; niche, peu de PMS l'ont |
| Marketplace / app-store | **1** | 12 entrées en dur, plusieurs vitrines ; pas de self-service partenaire |
| API publique développeur | **2** | Clés API + endpoints `/api/developer` ; à maturer (portail/SDK absents) |
| Webhooks sortants | **2** | Abonnement par événement + signature `X-Clenzy-Event` |
| Zapier / Make | **0** | Non repéré |
| OTA partenaires (HomeToGo/GYG/Klook) | **0** | Absents (handoffs) |
| Connecteurs compta | **2** | Pennylane câblé ; QB/Xero/Sage = OAuth sans synchro |

**Score domaine 10 « nous » ≈ 1,6 → arrondi pondéré retenu : 2** (cohérent avec le cadrage Phase 0). La force = IoT/serrures (différenciant) ; la faiblesse = marketplace mince, pas de Zapier, OTA partenaires absents, API non « ouverte » au sens grand public.

---

## 4. Écarts « marketing vs code »

| Claim | Réalité code | Verdict |
|-------|--------------|---------|
| « MarketplaceService = ~12 partenaires » | 12 entrées dont plusieurs vitrines / stubs | ⚠️ Vitrine partielle |
| « API publique ouverte » | API développeur (clés+webhooks) fonctionnelle mais non-publique/non-documentée extérieurement | ⚠️ Interne plutôt qu'« ouverte » |
| OTA partenaires activables | Absents (handoffs) | ❌ |
