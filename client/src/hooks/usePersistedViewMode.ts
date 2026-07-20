import { useCallback, useEffect, useState } from 'react';
import { getParsedAccessToken } from '../keycloak';

const STORAGE_NAMESPACE = 'clenzy.viewMode';

function buildStorageKey(screen: string): string {
  const sub = getParsedAccessToken()?.sub ?? 'anon';
  return `${STORAGE_NAMESPACE}.${screen}.${sub}`;
}

function readUserChoice<T extends string>(
  screen: string,
  validValues: readonly T[],
): T | null {
  try {
    const stored = window.localStorage.getItem(buildStorageKey(screen));
    if (stored && (validValues as readonly string[]).includes(stored)) {
      return stored as T;
    }
  } catch {
    // localStorage may be unavailable (SSR, privacy mode)
  }
  return null;
}

/**
 * Persiste un mode d'affichage (grid / list / map / ...) en localStorage,
 * scope par utilisateur (sub Keycloak) et par ecran.
 *
 * Si l'utilisateur n'a pas encore fait de choix explicite et que `autoDefault`
 * est fourni (typiquement calcule a partir des donnees recues — par exemple
 * "map si au moins 1 point GPS, sinon list"), cet auto-default est applique
 * et reapplique chaque fois qu'il change. Des que l'utilisateur clique
 * lui-meme un mode, son choix devient persistant et `autoDefault` est ignore
 * pour de bon (sur cet utilisateur, sur cet ecran).
 *
 * @param screen        identifiant logique de l'ecran (ex: "properties")
 * @param fallback      valeur initiale a afficher tant que `autoDefault` n'est pas pret
 *                      (typiquement pendant le loading)
 * @param validValues   liste blanche pour rejeter les valeurs corrompues / obsoletes
 * @param autoDefault   optionnel — mode "intelligent" calcule par le composant.
 *                      Quand defini et != undefined, prend le pas sur `fallback`
 *                      tant qu'aucun choix utilisateur n'a ete enregistre.
 */
export function usePersistedViewMode<T extends string>(
  screen: string,
  fallback: T,
  validValues: readonly T[],
  autoDefault?: T,
): [T, (mode: T) => void] {
  // Seul le CHOIX UTILISATEUR est de l'etat ; la valeur affichee est derivee :
  // choix user > auto-default courant > fallback. Plus d'effet de sync, donc
  // plus de frame stale quand `autoDefault` change (l'auto-default s'applique
  // au meme render). Les appelants ne passent `undefined` que pendant le
  // chargement initial (react-query garde les donnees en cache ensuite).
  const [userValue, setUserValue] = useState<T | null>(
    () => readUserChoice(screen, validValues),
  );

  const value = userValue ?? autoDefault ?? fallback;

  const update = useCallback(
    (next: T) => {
      setUserValue(next);
      try {
        window.localStorage.setItem(buildStorageKey(screen), next);
      } catch {
        // ignore (quota, private mode)
      }
    },
    [screen],
  );

  return [value, update];
}
