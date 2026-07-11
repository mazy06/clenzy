# Chantier — Autonomie déterministe de la constellation

> Décision du 2026-07-11 (analyse des cartes HITL / feed). Source de vérité du chantier.
> Statuts : ⬜ à faire · 🔶 en cours · ✅ fait+vérifié · ⏸ différé

## Constat fondateur (audit 2026-07-11)

Le cadre d'autonomie à 3 niveaux (`SUGGEST/NOTIFY/FULL` par module, `SupervisionModuleSettings.autonomyLevel`) est **persisté mais jamais lu par les scanners** : toutes les cartes partent en HITL. Seuls chemins auto réels : yield mode AUTO (bascule HITL > `autoHitlImpactPct` 12 %) et Règles de Confiance (outils de chat). Toutes les cartes actionnables sauf le scan LLM ont un **déclencheur calculé**. Le taux d'acceptation existe mais org-wide (pas par type).

## Décisions actées

1. **Sémantique des niveaux** : SUGGEST = carte HITL · NOTIFY = **N1** (auto sous enveloppe + notification annulable, HITL hors enveloppe) · FULL = **N2** (auto silencieux + feed/digest).
2. **Hiérarchie de commande** : kill-switch global (existant) → niveau module = **plafond** par agent → **toggle par type** (nouveau, menu Automatisation) + enveloppe éditable. Défaut : tout OFF (opt-in).
3. **Le chemin auto RÉUTILISE le pipeline d'apply existant** (carte créée puis appliquée par un acteur système) : conserve CAS, compensation hors-tx, dédup, journal, re-résolution des montants — zéro second chemin d'exécution.
4. **Invariant argent inchangé** : `MONEY_TOOLS` (débits réels) jamais auto. Les cautions auto = libérations de hold uniquement, conditionnées à « aucune Issue ouverte ».
5. **Activation pilotée par la donnée** : taux d'acceptation PAR TYPE (à construire) ; cible d'activation ≥ ~95 % sur ≥ 20 décisions ; Règles de Confiance étendues aux cartes en Vague 3.

## Matrice cible

| Carte | Niveau cible | Enveloppe d'auto |
|---|---|---|
| `CLEANING_REQUEST` | N2 | `AFTER_EACH_STAY` + idempotence (existants) |
| `REVIEW_DRAFT_REPLY` | N2 | budget premium OK ; publication reste HITL |
| `PRICE_DROP` | N1 via cadre yield | \|%\| ≤ autoHitlImpactPct (12 %) par segment, cooldown, protections yield |
| `CALENDAR_BLOCK` | N1 | days ≤ 7, refus BOOKED (existant), 1/bien/semaine |
| `DEPOSIT_RELEASE` | N1 | **aucune Issue ouverte** sur le séjour/logement + J+N config + statut re-lu |
| `DEPOSIT_REFUND` | N1 | annulation confirmée + aucun débit + aucune Issue |
| `PAYMENT_REMINDER` | N1 borné | 1ʳᵉ relance seulement, 1/résa/72h ; relances suivantes HITL |
| Cartes scan LLM | N0 (HITL) | — |

## Vagues

| # | Contenu | Statut |
|---|---|---|
| V1 | **LIVRÉ** : migration 0341 (`supervision_auto_rules` unique(org,type) sans seed + `applied_by` sur les cartes) · `AutoApplyGate` 5 étages (global → plafond module → règle type min() → enveloppe fail-safe → budget premium), journalisé · `SupervisionAutoApplyService` = **pipeline d'apply humain réutilisé** (CAS, compensation, échec → PENDING = repli HITL ; feed systématique ; notif `SUPERVISION_AUTO_APPLIED` en NOTIFY) · PRICE_DROP sous **double cadre** (YieldMode AUTO + segments ≤12 % + cap 1/bien/jour partagé via journal yield_adjustments + toggle) · mesure d'acceptation PAR TYPE (group-by, SupervisionReportStrip + chips dans la section Automatisation) · UI `ConstellationAutoRulesSection` dans AutomationRulesPage (toggle/niveau/enveloppe/plafond module affiché/taux, V2-V3 masqués) · types actifs : CLEANING_REQUEST, REVIEW_DRAFT_REPLY (gate budget), PRICE_DROP. ~75 tests ciblés + arbre entier vert (mvn 0, tsc client+mobile 0). Écarts documentés : cap journalier en jour serveur, journal cap post-apply best-effort, AUTO_NOTIFY sans bouton annuler dédié. | ✅ |
| V2 | `CALENDAR_BLOCK` + `DEPOSIT_RELEASE`/`DEPOSIT_REFUND` en N1 (condition « aucune Issue ouverte » — synergie P10 moteur ménage). | ⬜ |
| V3 | `PAYMENT_REMINDER` 1ʳᵉ relance + **Règles de Confiance étendues aux cartes** (N approbations consécutives d'un type → proposition « Automatiser ce type ? » → toggle). | ⬜ |

## Garde-fous transverses (toutes vagues)

- Kill-switch par type (toggle OFF = retour HITL immédiat) + global existant.
- Quota d'actions auto/jour par module (réutilise le pattern budget).
- Chaque auto-application = entrée de feed + journal `SupervisionSuggestion` APPLIED (traçabilité identique à l'HITL).
- Hors enveloppe → JAMAIS silencieux : carte HITL normale.
