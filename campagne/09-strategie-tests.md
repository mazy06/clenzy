# Stratégie tests d'intégration & bout-en-bout (chantier post-flux)

> Demandé par l'utilisateur le 2026-07-02 : garantir que les éléments communiquent (intégration)
> et que chaque fonctionnalité marche de bout en bout — Constellation multi-agent, registre
> central des flux déterministes, et leurs interactions mutuelles.

## Constat de départ

- Un socle IT existe (`AbstractIntegrationTest` : Postgres 15 + Redis 7 Testcontainers singletons,
  contexte Spring complet, KafkaTemplate mocké) **mais tous les ITs sont `@Disabled`** — ils ne
  tournent jamais. C'est l'angle mort qui a laissé passer le crash de boot `@Autowired` (2026-07-02)
  et les migrations cassées 0249/0251 : `mvn package` ne monte pas le contexte et n'exécute pas Liquibase.

## Principes

1. **Les ITs doivent TOURNER** : remplacer `@Disabled` par un gate d'environnement
   (`@EnabledIfEnvironmentVariable(CLENZY_IT=true)` ou tag JUnit `integration` + profil Maven) —
   exécutés localement quand Docker est là, et en nightly/pré-PR-production.
2. **Zéro token réel** : `ScriptedChatLLMProvider` de test (réponses déterministes par pattern,
   tool_calls scriptables) — LA brique qui rend la Constellation testable.
3. **Clock injectable** pour tous les tests temporels (J-X/J+X/+4 h) — jamais de sleep.
4. **Idempotence = assertion systématique** : chaque scénario rejoue son événement déclencheur.
5. **Anti-fuite** : chaque scénario E2E avec 2 organisations ; **anti-timezone-bug** : une
   propriété en fuseau exotique (Pacific/Auckland).
6. Pannes Redis testées dans les deux sémantiques voulues : fail-closed (quotas scan) vs
   fail-open (embeddings, claims bruit).

## Vague T1 — Socle + registre central (agent 1)

- Réactivation de l'infra IT (gate env, plus de `@Disabled`).
- `ApplicationBootIT` : le contexte Spring COMPLET démarre (attrape les beans multi-constructeurs).
- `LiquibaseMigrationIT` : `db.changelog-master.yaml` intégral sur Postgres vierge + validation
  schéma/entités (attrape les tables au singulier et les changesets non joués).
- `AutomationEngineIT` : règles en base réelle → `fireTrigger` → exécuteurs réels → effets en base
  (SR ménage, AutomationExecution EXECUTED/SKIPPED) ; redelivery = zéro doublon ; dédup one-shot
  vs récurrent ; conditions numériques.
- `KafkaFlowIT` (Testcontainers Kafka) : `calendar.updates` BOOKED réel → DeterministicFlowListener
  → moteur → effets ; re-publication = une seule exécution ; consumer group dédié vérifié.

## Vague T2 — Constellation + scénarios métier (agent 2)

- `ScriptedChatLLMProvider` réutilisable (support/testkit).
- `MultiAgentOrchestrationIT` : orchestration scriptée → délégations → tools réels sur base
  Testcontainers → `agent_run`/steps, ledger, métriques routage/tiering.
- Scénarios golden-path (niveau service/API, 2 orgs, fuseau exotique, Clock) :
  S1 cycle de vie résa complet (BOOKED → ménage auto → J-1 → livret → checkout → révocation code
  +4 h → avis → relance → suggestion caution J+2 → apply remboursement recalculé) ;
  S2 incident bruit (3 alertes → 1 message guest → escalade → suggestion blocage → apply) ;
  S3 facturation (OVERDUE → J+3/J+7 → jamais de 3e) ;
  S4 assistant (routage court-circuit + multi-agent tiering + crédits + replay + what-if) ;
  S5 autonomie premium (behavior + cap → PREMIUM_AUTO → dégradé au plafond) ;
  S6 Constellation Propriétaire (lien → vue brandée → révocation → 404).
- Interactions mutuelles : flux déterministe → markDirty → scan supervision → suggestion → apply.

## Vague T3 (après T1/T2 verts) — durcissement

- Test de complétude SPI (chaque AutomationAction a un exécuteur — fail au boot de test).
- Pannes Redis (2 sémantiques), double webhook Stripe signé, concurrence (2 événements simultanés).
- CI : profil Failsafe séparé + nightly ; gate avant PR main→production.
