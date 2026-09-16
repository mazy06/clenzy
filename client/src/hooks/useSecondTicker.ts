import { useSyncExternalStore } from 'react';

/**
 * Horloge à la seconde, partagée par tous les décomptes affichés.
 *
 * <p>Chaque carte de proposition montre le temps qui lui reste. Un `setInterval`
 * par carte faisait battre vingt horloges pour une seule seconde de temps réel,
 * et vingt rendus par seconde sur une liste paginée. Ici l'intervalle est unique
 * et n'existe que tant qu'au moins un décompte est affiché.</p>
 *
 * <p>La valeur est lue dans une variable de module plutôt que recalculée à
 * chaque appel : `useSyncExternalStore` exige un instantané stable entre deux
 * notifications, sinon React re-rendrait en boucle.</p>
 */
let now = Date.now();
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(notify: () => void): () => void {
  if (timer === undefined) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      subscribers.forEach(fn => fn());
    }, 1000);
  }
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Aucun abonnement : un décompte inactif ne doit pas maintenir l'intervalle en vie. */
const idle = () => () => {};

const snapshot = () => now;

export function useSecondTicker(active = true): number {
  return useSyncExternalStore(active ? subscribe : idle, snapshot, snapshot);
}
