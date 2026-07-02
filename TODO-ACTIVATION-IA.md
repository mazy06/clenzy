# TODO — Activation du chantier IA (campagne multi-agent)

> Actions à faire QUAND le chantier sera terminé, pour allumer ce qui a été livré.
> Tout est commité sur main, RIEN n'est déployé en prod ni activé. Détail par ticket : `campagne/JOURNAL.md`.

## 1. Dashboard Stripe (une seule action, ~2 min)

- [ ] Ajouter l'événement **`invoice.paid`** à la liste des événements du webhook endpoint existant
      (Dashboard Stripe → Developers → Webhooks → endpoint `/api/webhooks/stripe`).
      Sans lui : pas de dotation mensuelle de crédits. (Le top-up, lui, marche déjà via `checkout.session.completed`.)

## 2. Flags applicatifs (application.yml / env vars clenzy-infra — PAS Stripe)

- [ ] **Routage court-circuit** (T-02, levier -30/-45 %) :
      `clenzy.assistant.routing.enabled=true`
      (optionnel : `clenzy.assistant.routing.model=<modele-tier-petit>`)
- [ ] **Tiering de modèles par rôle** (T-03, levier -25/-40 % multi-agent) :
      ```yaml
      clenzy.assistant.tiering:
        enabled: true
        small:  { anthropic: claude-haiku-4-5, openai: gpt-5-mini }
        strong: { anthropic: claude-opus-4-1 }
      ```
- [ ] **Enforcement crédits** (T-06b) — ⚠️ UNIQUEMENT après les premières dotations en base
      (1er `invoice.paid` reçu, ou INSERT manuel de poche pour tester) :
      `clenzy.ai.credits.enforcement.enabled=true`
      (défauts : floor 2000 mc, chunk 5000 mc, byok-factor 0.30)

## 3. Rebuild & déploiement

- [ ] Rebuild `pms-server` en dev pour activer tout le lot (migrations 0294→0298 s'appliquent au boot).
- [ ] Prod : PR main→production quand décidé (les migrations s'appliqueront au boot du container, flux normal).

## 4. Mesure & suivi (après activation)

- [ ] Comparer 30 j avant/après dans Grafana : `assistant.tokens{agent}`, `assistant.cost.usd`,
      `assistant.routing.decision{route}` (cible : ≥50 % de requêtes court-circuitées, coût/interaction ÷2).
- [ ] Surveiller `assistant.pricing.unknown_model` (grille `ai_credit_rate_card`/`LlmPricingService` à compléter si > 0).
- [ ] Dashboard Grafana dédié : JSON à créer côté `clenzy-infra` (panels tokens/coût/routing/crédits).

## 5. Backlog restant (feuille de route `campagne/07-feuille-de-route.md`)

- En cours : X2 Règles de Confiance. Puis : X3 Grand Livre UI (replay), X4 sous-budget autonomie premium,
  X5 grille forfaits prod (+9/+29/+79 €), X6 rolling summary, X7 agents V2 (Distribution, Maintenance),
  X8 déclencheurs Kafka, X9 Constellation Propriétaire, X10 réconciliation double + quota embeddings.
- Raffinements tracés au journal : propagation BYOK aux points de metering, tarif plein strict (décomposition
  brute des tokens), buckets SOCLE/PREMIUM_AUTO au ledger, jauge crédits dans la Constellation,
  alertes 80/95/100 %, `estimatedCredits` dans les ToolDescriptors (estimation pré-action).
