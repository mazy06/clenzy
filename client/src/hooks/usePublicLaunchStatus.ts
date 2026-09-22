import { useCallback, useEffect, useState } from 'react';
import {
  publicLaunchApi,
  type PublicLaunchStatus,
} from '../services/publicLaunchApi';

/** État serveur public. En cas d'indisponibilité, les inscriptions restent fermées. */
export function usePublicLaunchStatus() {
  const [status, setStatus] = useState<PublicLaunchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    const load = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const signal = request.signal;
      const timeout = window.setTimeout(() => request.abort(), 10000);
      try {
        const next = await publicLaunchApi.status(signal);
        if (active && !signal.aborted) {
          setStatus(next);
          setError(false);
        }
      } catch {
        if (active && controller === request) {
          setStatus(null);
          setError(true);
        }
      } finally {
        window.clearTimeout(timeout);
        if (active && controller === request) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [revision, refresh]);

  return {
    status,
    loading,
    error,
    refresh,
    paused: status?.registrationsPaused ?? true,
  };
}
