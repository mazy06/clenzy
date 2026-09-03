import type { QueryClient } from '@tanstack/react-query';

/**
 * Fenêtre de regroupement. Assez longue pour couvrir le montage de toutes les
 * cartes d'un écran, assez courte pour que les KPI se remettent à jour sans
 * attente perceptible.
 */
const WINDOW_MS = 400;

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: QueryClient | null = null;

/**
 * Demande un rafraîchissement du read-model `connected-objects`, au plus une
 * fois par fenêtre.
 *
 * <p>Chaque carte d'objet connecté rafraîchit son propre état au montage, puis
 * demande la mise à jour de la liste pour que les KPI d'en-tête restent
 * cohérents. Invalider directement depuis chaque carte ne se voit pas sur un
 * parc de trois appareils, mais devient une tempête sur un parc réel : une
 * organisation à 93 appareils déclenchait 93 invalidations, donc 93 rechargements
 * de liste valant chacun jusqu'à cinq appels HTTP — très au-delà des 300
 * requêtes/minute du limiteur.</p>
 *
 * <p>L'emballement était auto-aggravant : au premier 429, `fetchAll` retombe sur
 * l'agrégation historique en trois appels au lieu d'un seul. Plus l'écran
 * saturait, plus il demandait, jusqu'à ce que la requête de liste échoue et que
 * les appareils disparaissent de l'écran.</p>
 *
 * <p>On ne remonte volontairement PAS la promesse de l'invalidation : une carte
 * n'a pas besoin que la liste soit rechargée pour afficher son propre état.</p>
 */
export function scheduleConnectedObjectsInvalidation(queryClient: QueryClient): void {
  pending = queryClient;
  if (timer !== null) {
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    const client = pending;
    pending = null;
    void client?.invalidateQueries({ queryKey: ['connected-objects'] });
  }, WINDOW_MS);
}

/** Annule une invalidation en attente. Réservé aux tests. */
export function resetConnectedObjectsInvalidation(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  pending = null;
}
