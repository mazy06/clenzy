import { useCallback, useEffect, useState } from 'react';
import { assistantApi, type AssistantUsage } from '../../../services/api/assistantApi';

interface UseAssistantUsageOptions {
  /** Periode a interroger. Defaut "month" (badge principal). */
  period?: 'today' | 'month' | 'all';
  /** Si true, refetch a chaque changement de la valeur (cle externe ex: messageId). */
  refreshKey?: unknown;
  /** Polling interval en ms. Defaut 0 (pas de polling automatique). */
  pollMs?: number;
}

interface UseAssistantUsageResult {
  usage: AssistantUsage | null;
  loading: boolean;
  error: string | null;
  /** Refetch manuel — typiquement appele apres qu'un message assistant arrive. */
  refresh: () => void;
}

/**
 * Hook qui charge la consommation tokens + cout USD de l'organisation et
 * l'expose pour le badge header chat.
 *
 * <p>Pattern : fetch initial au mount + refetch on-demand via {@link refresh}
 * (declenche typiquement apres chaque event SSE "done" du chat). Polling
 * optionnel via {@link pollMs} pour les sessions ouvertes longtemps.</p>
 *
 * <p>Defensive : aucune exception ne propage. Les erreurs sont stockees dans
 * {@code error} et le badge peut afficher "—" ou se masquer.</p>
 */
export function useAssistantUsage(options: UseAssistantUsageOptions = {}): UseAssistantUsageResult {
  const { period = 'month', refreshKey, pollMs = 0 } = options;
  const [usage, setUsage] = useState<AssistantUsage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    assistantApi
      .getUsage(period)
      .then((data) => {
        if (cancelled) return;
        setUsage(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load usage';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, refreshKey, tick]);

  // Polling optionnel (pour sessions longues sans envoi de message)
  useEffect(() => {
    if (!pollMs || pollMs <= 0) return;
    const id = window.setInterval(() => refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  return { usage, loading, error, refresh };
}
