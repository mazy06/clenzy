# Inventaire interne — Domaine 3 : Calendrier & multi-logements / multi-tenant

> Vérité terrain adossée au code Clenzy (`server/`, `client/`).
> Grille : 0 Absent · 1 Basique · 2 Standard · 3 Avancé.
> Date : 2026-06-13. Lot B2.

## Tableau de couverture

| Fonctionnalité | Statut | Preuve code | Score |
|----------------|--------|-------------|:-----:|
| Moteur de calendrier transactionnel anti-overbooking | Implémenté | `service/CalendarEngine.java` : verrou `pg_advisory_xact_lock(property_id)` + write-ahead log `calendar_commands` ; exceptions `CalendarLockException`, `CalendarConflictException` ; tests `CalendarEngineConcurrencyTest`, `CalendarEngineIntegrationTest` | 3 |
| Modèle de jour calendrier riche (statut + prix + contraintes) | Implémenté | `model/CalendarDay.java`, `CalendarDayStatus` (AVAILABLE/BOOKED/BLOCKED/MAINTENANCE), prix, min/max stay, changeover ; `CalendarDayRepository` | 3 |
| Propagation des changements (outbox → Kafka → channels) | Implémenté | Outbox `calendar_commands` → topic `calendar.updates` → `ChannexSyncService` (Outbox pattern, cf. cadrage §1) | 3 |
| Partitionnement / scalabilité du calendrier | Implémenté | `config/CalendarPartitionManager.java` + test `CalendarPartitionManagerTest` | 3 |
| Planning visuel multi-propriété (drag & drop) | Implémenté | `client/src/modules/planning/` (19 fichiers) : `PlanningPage.tsx`, `PlanningBar.tsx` (drag), `PlanningRow.tsx`, `PlanningPropertyColumn.tsx`, `PlanningTimeline.tsx`, `PlanningQuickCreateDialog.tsx`, `BlockPeriodDialog.tsx`, `PlanningFilterButton.tsx` | 3 |
| Création / modification rapide depuis le planning | Implémenté | `PlanningQuickCreateDialog.tsx` (61 KB), `PlanningActionPanel.tsx`, `ReservationPopover.tsx`, `PlanningBarGhost.tsx` (preview de drag) | 3 |
| Blocage de périodes (maintenance, ménage) | Implémenté | `BlockPeriodDialog.tsx`, statut BLOCKED/MAINTENANCE | 3 |
| Multi-tenant (isolation par organisation) | Implémenté | `@Filter organizationFilter` Hibernate sur entités métier, `tenant/TenantFilter.java` post-JWT *fail-closed* (403 si org non résolue), `TenantContext` ThreadLocal | 3 |
| Mode agence / cross-org (platform staff) | Implémenté | SUPER_ADMIN / SUPER_MANAGER accès cross-org (cadrage §1) | 3 |
| Gestion de portefeuille (regroupement de biens) | Implémenté | `client/src/modules/portfolios/` ; détecteurs de patterns portefeuille `service/agent/portfolio/` (PortfolioPatternDetector, HighCancellationRateDetector, CitySatisfactionLowDetector) | 2 |
| Vue multi-propriété filtrable / paginée | Implémenté | `PlanningPaginationBar.tsx`, `PlanningFilterButton.tsx`, `PropertyPopover.tsx` | 3 |
| Indicateurs d'urgence / statuts visuels | Implémenté | `planningUrgency.css`, `hooks/` du module planning | 2 |
| Vue calendrier mobile | À confirmer | App RN (85 écrans, cadrage) ; vue calendrier multi-unités mobile à vérifier | 2 |

## Synthèse interne

- **Forces** : `CalendarEngine` à robustesse anti-overbooking de niveau ingénierie (verrou advisory PostgreSQL par propriété + write-ahead log `calendar_commands` + outbox transactionnel → Kafka), couverte par des tests de concurrence dédiés. Planning UI riche (drag & drop, quick-create, blocage, filtres, pagination, popovers). Multi-tenant strict (`@Filter` + `TenantFilter` fail-closed) avec mode cross-org pour le staff plateforme.
- **Faiblesses** : la gestion de portefeuille est présente mais plus orientée détection de patterns (IA) que regroupements visuels riches façon « groupes de listings » Guesty ; pas de réserve majeure dans le cadrage (§7 : score 3).
- **Score interne domaine 3 = 3 / 3** (cadrage §7). La combinaison robustesse transactionnelle + planning drag&drop + multi-tenant fail-closed place Clenzy au niveau « avancé / différenciant », notamment sur l'anti-overbooking et l'isolation multi-tenant native.
