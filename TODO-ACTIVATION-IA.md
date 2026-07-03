# TODO — Activation du chantier IA (campagne multi-agent)

> Actions à faire QUAND le chantier sera terminé, pour allumer ce qui a été livré.
> Tout est commité sur main, RIEN n'est déployé en prod ni activé. Détail par ticket : `campagne/JOURNAL.md`.

## 1. Dashboard Stripe (une seule action, ~2 min)

- [ ] Ajouter l'événement **`invoice.paid`** à la liste des événements du webhook endpoint existant
      (Dashboard Stripe → Developers → Webhooks → endpoint `/api/webhooks/stripe`).
      Sans lui : pas de dotation mensuelle de crédits. (Le top-up, lui, marche déjà via `checkout.session.completed`.)

## 2. Flags applicatifs (application.yml / env vars clenzy-infra — PAS Stripe)

- [x] **Routage court-circuit** (T-02, levier -30/-45 %) :
      `clenzy.assistant.routing.enabled=true`
      (optionnel : `clenzy.assistant.routing.model=<modele-tier-petit>` — non posé :
      sans override le classifieur retombe sur le tier SMALL du tiering)
      → **posé dans `application-dev.yml` le 2026-07-02 (dev)** ; prod = env vars clenzy-infra au déploiement.
- [ ] **Tiering de modèles par rôle** (T-03, levier -25/-40 % multi-agent) — **PLUS un flag yml
      depuis le 2026-07-02 (décision : config dynamique en base uniquement)** : dans
      Paramètres > IA > Modèles, assigner un modèle plateforme aux features **ASSISTANT_SMALL**
      (ex. claude-haiku-4-5) et **ASSISTANT_STRONG** (ex. claude-opus-4-1). Non assignées =
      tiering inactif. Garde même-provider : le tier ne s'applique que si son provider = celui
      du modèle résolu (BYOK/NVIDIA inchangés sinon).
- [ ] **Enforcement crédits** (T-06b) — ⚠️ UNIQUEMENT après les premières dotations en base
      (1er `invoice.paid` reçu, ou INSERT manuel de poche pour tester) :
      `clenzy.ai.credits.enforcement.enabled=true`
      (défauts : floor 2000 mc, chunk 5000 mc, byok-factor 0.30)

## 3. Rebuild & déploiement

- [ ] Rebuild `pms-server` en dev pour activer tout le lot (migrations 0294→0304 s'appliquent au boot).
- [ ] Prod : PR main→production quand décidé (les migrations s'appliqueront au boot du container, flux normal).

## 4. Mesure & suivi (après activation)

- [ ] Comparer 30 j avant/après dans Grafana : `assistant.tokens{agent}`, `assistant.cost.usd`,
      `assistant.routing.decision{route}` (cible : ≥50 % de requêtes court-circuitées, coût/interaction ÷2).
- [ ] Surveiller `assistant.pricing.unknown_model` (grille `ai_credit_rate_card`/`LlmPricingService` à compléter si > 0).
- [ ] Dashboard Grafana dédié : JSON à créer côté `clenzy-infra` (panels tokens/coût/routing/crédits).

## 5. Backlog restant (feuille de route `campagne/07-feuille-de-route.md`)

- FAITS : X1→X8, X10, **X5 grille forfaits (+9/+29/+79 €, migration 0301, 2026-07-02)** —
  ⚠️ dès déploiement, toute NOUVELLE inscription/upgrade paie le supplément IA (abonnements Stripe
  existants inchangés) — et **X9 v1 Constellation Propriétaire (lien public /owner-view/:token,
  migration 0302, 2026-07-02)**, **X9-b branding white-label (0303)** et **X8-b v1 (scan autonome
  = comportement premium `supervision_scan` gated)**. **Quota embeddings org FAIT**
  (EmbeddingOrgQuota, défaut 20 000/org/mois, `clenzy.ai.embeddings.org-monthly-quota`) et le
  consumer Kafka « nouvelle résa » EXISTAIT déjà (SupervisionCalendarTriggerListener) — chaîne X8
  complète.
- **LATER FAIT (2026-07-02)** : L1 blackboard de run (`clenzy.assistant.blackboard.enabled`, OFF),
  L2 specialists Marketing + Screening (outils existants, roster 15 métier), L3 what-if replay
  (migration 0304, section « Et si… ? » du replay), L4 compteur
  `assistant.outcome.guest_auto_reply` (benchmark du pilote per-outcome). L5 Stripe Meters = non
  déclenché (conditionnel), L6 = décision produit. **NOW + NEXT + LATER : 100 % couverts.**
- Restent uniquement des chantiers à DÉCISIONS PRODUIT : sous-flux déterministes métier,
  outils V2-b + services Conformité/Stocks (écarts L2-b), STOMP (si multi-client avéré),
  pilote pricing per-outcome (arbitrage).
- FAIT aussi (2026-07-02) : **panneaux UI autonomie** (Règles de Confiance + budget premium,
  Paramètres > IA > Supervision — AiAutonomySection.tsx).
- Raffinements tracés au journal : propagation BYOK aux points de metering, tarif plein strict (décomposition
  brute des tokens), buckets SOCLE/PREMIUM_AUTO au ledger, jauge crédits dans la Constellation,
  alertes 80/95/100 %, `estimatedCredits` dans les ToolDescriptors (estimation pré-action).
