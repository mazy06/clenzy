import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildApiUrl } from '../config/api';
import { getAccessToken } from '../keycloak';
import { invalidateMissionWorkflow } from './invalidateMissionWorkflow';

/** Une connexion par session ; le décompte local ne provoque aucune lecture périodique. */
export function useAssignmentEventStream(session: string | null): void {
  const client = useQueryClient();
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let stopped = false;
    let retry = 2_000;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      if (refresh !== undefined) return;
      refresh = setTimeout(() => {
        refresh = undefined;
        void invalidateMissionWorkflow(client);
      }, 250);
    };
    const connect = async () => {
      try {
        const token = getAccessToken();
        const response = await fetch(buildApiUrl('/service-assignments/stream'), {
          credentials: 'include', signal: controller.signal,
          headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!response.ok || !response.body) throw new Error('Flux indisponible');
        retry = 2_000;
        changed(); // Récupère aussi les décisions manquées pendant une déconnexion.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (!stopped) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary: number;
            while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
              const frame = buffer.slice(0, boundary);
              const delimiter = buffer.slice(boundary).match(/^\r?\n\r?\n/)![0];
              buffer = buffer.slice(boundary + delimiter.length);
              if (/^event:\s*assignment\s*$/m.test(frame)) changed();
            }
          }
        } finally { reader.releaseLock(); }
      } catch { /* Une coupure relance le flux, pas une boucle de lecture des demandes. */ }
      if (!stopped) {
        reconnect = setTimeout(() => { void connect(); }, retry);
        retry = Math.min(retry * 2, 60_000);
      }
    };
    void connect();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(reconnect);
      clearTimeout(refresh);
    };
  }, [session, client]);
}
