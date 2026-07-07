/* ============================================================
   useSupervisionReport — bilan de valeur (30 j) de la constellation

   Récupère GET /api/ai/supervision/report (org-scopé) : ROI estimé,
   taux d'acceptation, volumes. Best-effort : tout échec → report null
   (la carte de bilan ne s'affiche simplement pas).
   ============================================================ */

import { useEffect, useState } from 'react';
import { buildApiUrl } from '../../../config/api';
import { getAccessToken } from '../../../keycloak';

export interface SupervisionReport {
  windowDays: number;
  autoActions: number;
  suggestionsApplied: number;
  suggestionsDismissed: number;
  suggestionsPending: number;
  acceptanceRate: number; // 0..1
  estimatedTimeSavedMinutes: number;
  estimatedTimeSaved: string; // "≈ 4 h 30"
}

export function useSupervisionReport(): { report: SupervisionReport | null; loading: boolean } {
  const [report, setReport] = useState<SupervisionReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(buildApiUrl('/ai/supervision/report'), {
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
  }, []);

  return { report, loading };
}
