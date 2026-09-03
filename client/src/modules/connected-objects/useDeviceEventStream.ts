import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildApiUrl } from '../../config/api';
import { getAccessToken } from '../../keycloak';
import { scheduleConnectedObjectsInvalidation } from './invalidateConnectedObjects';

/** Attente avant reconnexion, doublée à chaque échec, plafonnée. */
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

/**
 * Abonne le hub aux changements d'objets connectés poussés par le serveur.
 *
 * <p>Renverse le sens de la fraîcheur. Auparavant chaque carte interrogeait le
 * fabricant à son montage : sur un parc de quatre-vingt-treize appareils, cela
 * revenait à poser quatre-vingt-treize questions à chaque affichage pour apprendre,
 * presque toujours, que rien n'avait changé — et à saturer le limiteur, jusqu'à ce
 * que la liste échoue et que les objets disparaissent de l'écran.</p>
 *
 * <p>Désormais le serveur sait : par webhook quand le fabricant en émet (Nuki,
 * Minut), par son propre scheduler sinon (Tuya). Il annonce le changement ici, et
 * seulement alors. Un écran au repos ne coûte plus rien.</p>
 *
 * <p>Reconnexion : à chaque coupure on a forcément manqué des événements, donc on
 * demande une resynchronisation complète en même temps qu'on rouvre le flux. C'est
 * la seule requête périodique qui subsiste, et uniquement quand le réseau tombe.</p>
 *
 * <p>On ne consomme pas `EventSource` : il ne sait pas porter d'en-tête
 * `Authorization`. Même approche que le flux de supervision — `fetch` +
 * `ReadableStream`.</p>
 */
export function useDeviceEventStream(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const controller = new AbortController();
    let stopped = false;
    let retryMs = RETRY_BASE_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const consume = async (): Promise<void> => {
      const token = getAccessToken();
      const response = await fetch(buildApiUrl('/devices/stream'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`flux indisponible (${response.status})`);
      }
      // Connexion établie : on repart d'une attente courte pour la prochaine coupure.
      retryMs = RETRY_BASE_MS;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done || stopped) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          handleFrame(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
        }
      }
    };

    const handleFrame = (frame: string): void => {
      const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
      if (!dataLine) {
        return;
      }
      const raw = dataLine.slice(5).trim();
      if (!raw || raw === '{}') {
        return; // amorce « ready »
      }
      try {
        const event = JSON.parse(raw) as { type?: string };
        if (event?.type === 'device.changed') {
          // Regroupé : plusieurs appareils peuvent changer d'un coup (une coupure
          // de courant fait tomber tout un logement) sans multiplier les requêtes.
          scheduleConnectedObjectsInvalidation(queryClient);
        }
      } catch {
        /* trame malformée → ignorée */
      }
    };

    const loop = async (): Promise<void> => {
      while (!stopped) {
        try {
          await consume();
        } catch {
          if (stopped) {
            return;
          }
        }
        if (stopped) {
          return;
        }
        // On a manqué ce qui s'est passé pendant la coupure : on se resynchronise.
        scheduleConnectedObjectsInvalidation(queryClient);
        await new Promise<void>((resolve) => {
          retryTimer = setTimeout(resolve, retryMs);
        });
        retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
      }
    };

    void loop();

    return () => {
      stopped = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
      }
      controller.abort();
    };
  }, [enabled, queryClient]);
}
