/* ============================================================
   Mapping moteur multi-agent → constellation Superviseur

   Le BACKEND emet l'activite par NOM RÉEL de specialist technique
   (data_analyst, communication, operations, ...). La constellation, elle,
   parle en 5 agents MÉTIER (com/rev/ops/fin/rep). Ce module est la couche
   d'adaptation, et elle vit CÔTÉ FRONT (le backend reste agnostique de l'UI).

   ── Décision de design (documentée) ──────────────────────────────────────
   8 specialists techniques → 5 agents constellation :

     communication  → com   (messagerie voyageur)
     data_analyst   → rev   (KPIs, occupation, tendances — hors finance)
     finance        → fin   (facturation, revenus/dépenses, versements, rentabilité)
     operations     → ops   (actions : interventions, blocage, statuts, tarifs)
     monitoring     → ops   (surveillance : ménages, sync, bruit, risques, KPI système)
     workflow       → ops   (exécution de workflows opérationnels)
     insights       → rep   (avis, réputation, business insights)
     context        → ∅     (technique : résolution de contexte — masqué)
     memory         → ∅     (technique : mémoire long-terme — masqué)
     navigation     → ∅     (technique : aide à la navigation UI — masqué)

   Notes :
   - `fin` est désormais alimenté par le `FinanceSpecialist` (cluster « argent »
     issu du découpage de data_analyst). Avant, fin restait en veille.
   - Un specialist masqué (∅) ne produit AUCUN StreamEvent constellation : son
     activité technique ne pollue pas la vue métier.
   - L'orchestrateur lui-même ("orchestrator") n'est pas un satellite : son
     état est porté par le cœur de la constellation, pas mappé ici.
   ============================================================ */

import type { AgentId } from '../types';

/** Specialists rattachés à un agent constellation. Absents = masqués. */
const SPECIALIST_TO_AGENT: Record<string, AgentId> = {
  communication: 'com',
  data_analyst: 'rev',
  operations: 'ops',
  monitoring: 'ops',
  workflow: 'ops',
  insights: 'rep',
  finance: 'fin',
};

/**
 * Mappe un nom de specialist backend vers l'agent constellation correspondant.
 * Retourne `null` pour les specialists techniques masqués (context/memory/
 * navigation) ou inconnus → l'appelant n'émet alors aucun StreamEvent.
 */
export function mapSpecialistToAgent(specialist: string | null | undefined): AgentId | null {
  if (!specialist) return null;
  return SPECIALIST_TO_AGENT[specialist] ?? null;
}
