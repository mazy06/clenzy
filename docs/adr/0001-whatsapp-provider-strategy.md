# ADR 0001 — Provider Strategy WhatsApp (Meta Cloud API + OpenWA)

**Date** : 2026-05-28
**Statut** : Accepté
**Décideur** : Toufik (CTO/founder Clenzy)
**Contexte technique** : Java 21 / Spring Boot 3.2, multi-tenant (TenantContext ThreadLocal)

---

## Contexte

Clenzy doit pouvoir envoyer des messages WhatsApp aux voyageurs (briefings, confirmations check-in, code de porte, notifications check-out). Jusqu'à présent, le seul provider supporté était **Meta WhatsApp Cloud API** (graph.facebook.com v18.0), via un `WhatsAppApiService` qui appelait directement les endpoints Meta avec un Bearer token permanent par organisation.

Deux contraintes business ont émergé :

1. **Coût Meta** : facturation conversation-based (~$0.014–$0.07 par conversation), prohibitive pour les organisations en trial ou les hosts de petite taille (5-10 propriétés).
2. **Friction onboarding Meta** : la création d'un Meta Business Manager + vérification entreprise + soumission templates prend 1 à 3 jours et exige un numéro WhatsApp Business dédié.

Une alternative open-source existe : [OpenWA](https://github.com/rmyndharis/OpenWA), un wrapper NestJS autour de `whatsapp-web.js` (qui pilote Chromium headless via Puppeteer pour simuler WhatsApp Web). Setup en 5 minutes via scan QR, gratuit, mais **hors ToS Meta** (reverse-engineering du protocole Web).

## Décision

**Implémenter une "Provider Strategy"** qui permet à chaque organisation de choisir son provider WhatsApp via un champ `whatsapp_configs.provider` (`META` | `OPENWA`). Le code métier (`GuestMessagingService`, `BriefingDelivery`) reste agnostique : un `WhatsAppProviderResolver` route les envois vers la bonne implémentation au runtime.

**Meta reste le défaut** pour toutes les nouvelles organisations (back-compat + recommandation B2B). OpenWA est exposé en option avancée avec disclaimer fort dans l'UI.

### Architecture

```
WhatsAppChannel ──► WhatsAppProviderResolver ──► EnumMap<Provider, WhatsAppProvider>
                                                       │
                                          ┌────────────┼────────────┐
                                          ▼                         ▼
                              MetaWhatsAppProvider       OpenWaWhatsAppProvider
                              (Graph API v18.0)          (HTTP → openwa:2785)
```

**Interface commune** :
```java
public interface WhatsAppProvider {
    WhatsAppProviderType getProviderType();
    String sendTextMessage(WhatsAppConfig config, String phoneNumber, String text);
    String sendTemplateMessage(WhatsAppConfig config, String phoneNumber, String templateName, String language);
    void markAsRead(WhatsAppConfig config, String messageId);
}
```

`OpenWaWhatsAppProvider.sendTemplateMessage()` throw explicitement `UnsupportedOperationException` car whatsapp-web.js ne supporte pas les templates Meta-approuvés. Le code appelant (`BriefingDelivery`) catch et fallback sur `sendTextMessage()` avec le body brut.

## Alternatives considérées

### Option A — Swap brut Meta → OpenWA (rejetée)
Supprimer complètement Meta, tout passer par OpenWA.

- ✅ Stack simple, zéro coût messaging
- 🔴 **Risque ToS Meta** : si le compte WhatsApp est banni, **plus aucun message ne passe** pour aucune org
- 🔴 **Perte des features Meta** : pas de templates approuvés (impossible de contacter hors fenêtre 24h), pas de boutons interactifs, pas de WhatsApp Flows
- 🔴 **Compliance B2B** : impossible de garantir SLA, impossible de certifier ISO 27001/SOC 2 avec un canal hors ToS

### Option B — Provider Strategy (retenue) ✓
Coexistence Meta + OpenWA, choix par-org.

- ✅ Permet aux orgs régulées (B2B, France/EU) de rester sur Meta officiel
- ✅ Onboarding rapide / gratuit pour les petites orgs / trials via OpenWA
- ✅ Rollback granulaire si OpenWA casse (downgrade par-org sans coupure globale)
- 🟠 Plus de code à maintenir (2 implémentations + resolver)

### Option C — OpenWA comme fallback de Meta (rejetée)
OpenWA seulement si Meta est indisponible.

- 🔴 Complexité élevée pour un gain marginal (Meta a 99.95% uptime)
- 🔴 Mélange volume Meta/OpenWA sur un même numéro WhatsApp = ban garanti

## Conséquences

### Positives
- Onboarding 5 min pour les orgs en trial (scan QR vs vérif Meta 1-3 jours)
- Coût messaging réduit de ~$30-100/org/mois à 0€ (hors infra) pour les orgs sur OpenWA
- Différenciation commerciale vs Guesty/Hospitable (qui imposent Meta payant)

### Négatives
- **Code metier inchangé mais 3 fichiers ajoutés** : `WhatsAppProvider`, `WhatsAppProviderResolver`, `OpenWaWhatsAppProvider`
- **Migration DB obligatoire** : `0153__add_whatsapp_provider_strategy.sql` (colonne `provider` NOT NULL DEFAULT 'META' + colonnes openwa_*)
- **Infra OpenWA à maintenir** : 1 container Docker supplémentaire (~600 MB image Chromium + ~1.5 GB RAM par session active). En prod : opt-in via `--profile openwa`.
- **Compliance** : les orgs en OPENWA doivent signer un avenant CGV reconnaissant le risque ToS Meta (TODO Phase 5b)

### Mitigations risques OpenWA
- Disclaimer fort dans l'UI (Alert warning à chaque sélection OPENWA)
- Rate limiting per-org strict (20 msg/min, 200/h — alignés sur les safeguards natifs OpenWA)
- Monitoring : ban detection via webhook OpenWA `session.status=FAILED`
- Plan B documenté : si l'instance OpenWA tombe, swap des orgs vers META en SQL one-liner (`UPDATE whatsapp_configs SET provider='META' WHERE provider='OPENWA'`)

## Implémentation

| Phase | Périmètre | Statut |
|---|---|---|
| 1 | Backend interface + 2 providers + resolver + tests (4401 verts) | ✅ |
| 2 | Migration Liquibase 0153 + entity + DTOs | ✅ |
| 3 | Docker container `openwa` (profile opt-in) + setup-openwa.sh + auto-démarrage start-dev.sh | ✅ |
| 4a | UI Settings : toggle + form Meta/OpenWA + disclaimer | ✅ |
| 4b | QR scan flow : endpoints proxy backend + Dialog modal + polling status | ✅ |
| 5 | ADR + doc ops + JUnit Extension TenantContext (résout flaky tests) | ✅ |
| 6 (suivi) | docker-compose.prod.yml + avenant CGV + activation prod après staging validé | ⏳ |

## Références

- Repo OpenWA : https://github.com/rmyndharis/OpenWA
- Doc Meta WhatsApp Cloud API : https://developers.facebook.com/docs/whatsapp/cloud-api
- Migration : `server/src/main/resources/db/changelog/changes/0153__add_whatsapp_provider_strategy.sql`
- Code : `server/src/main/java/com/clenzy/service/messaging/whatsapp/`
- UI : `client/src/modules/settings/WhatsAppProviderConfigSection.tsx`
- Infra : `clenzy-infra/docker-compose.dev.yml` (service `openwa`) + `scripts/setup-openwa.sh`
