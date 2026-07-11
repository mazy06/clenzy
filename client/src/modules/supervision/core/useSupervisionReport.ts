/* ============================================================
   useSupervisionReport — bilan de valeur (30 j) de la constellation

   Récupère GET /api/ai/supervision/report (org-scopé) : ROI estimé,
   taux d'acceptation, volumes. Best-effort : tout échec → report null
   (la carte de bilan ne s'affiche simplement pas).
   ============================================================ */

import { useEffect, useState } from 'react';
import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';

/** Acceptation par type d'action (Vague 1 autonomie) — aide à l'activation des toggles. */
export interface SupervisionTypeAcceptance {
  moduleKey: string;
  actionType: string;
  applied: number;
  dismissed: number;
  pending: number;
  acceptanceRate: number; // 0..1 (0 si aucune décision)
}

export interface SupervisionReport {
  windowDays: number;
  autoActions: number;
  suggestionsApplied: number;
  suggestionsDismissed: number;
  suggestionsPending: number;
  acceptanceRate: number; // 0..1
  estimatedTimeSavedMinutes: number;
  estimatedTimeSaved: string; // "≈ 4 h 30"
  acceptanceByType: SupervisionTypeAcceptance[];
}

/**
 * @param windowDays fenêtre glissante (jours) — la constellation l'aligne sur le
 *   zoom du planning : Semaine 7 / Quinzaine 15 / Mois 30. Défaut 30.
 */
export function useSupervisionReport(windowDays = 30): { report: SupervisionReport | null; loading: boolean } {
  const [report, setReport] = useState<SupervisionReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = getAccessToken();
        const res = await fetch(buildApiUrl(`/ai/supervision/report?windowDays=${windowDays}`), {
          credentials: 'include',
          headers: { accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!res.ok) throw new Error(`report ${res.status}`);
        const data = (await res.json()) as SupervisionReport;
        if (!cancelled) setReport(data);
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  return { report, loading };
}
