import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../services/api/usersApi';
import { useIsAuthenticated } from './useIsAuthenticated';

/**
 * Centre Baitly : position du navigateur, puis ville du profil en cas de refus.
 *
 * <p>`undefined` tant que la reponse n'est pas la, et durablement quand le
 * compte n'a pas de ville exploitable. Aucun repli vers Paris. La position
 * reste en mémoire dans le cache de session, jamais en stockage persistant.</p>
 *
 * <p>La ville d'un compte ne bouge pas d'une session a l'autre, et le
 * geocodage est deja mis en cache cote serveur : une seule requete par
 * session suffit, d'ou `staleTime: Infinity` et l'absence de retry.</p>
 */
export function useHomeMapCenter(): [number, number] | undefined {
  const isAuthed = useIsAuthenticated();
  const browser = useQuery({
    queryKey: ['home-location', 'browser'],
    queryFn: browserPosition,
    enabled: isAuthed,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  const { data } = useQuery({
    queryKey: ['home-location', 'me'],
    queryFn: usersApi.getMyHomeLocation,
    enabled: isAuthed,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  // Le profil est chargé en parallèle, mais ne prend pas la priorité pendant
  // que le navigateur attend la décision de l'utilisateur.
  return useMemo(
    () => {
      if (browser.isPending) return undefined;
      if (browser.data) return browser.data;
      return data && validPosition(data.longitude, data.latitude) ? [data.longitude, data.latitude] as [number, number] : undefined;
    },
    [browser.isPending, browser.data, data],
  );
}

export function browserPosition(): Promise<[number, number] | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { longitude, latitude } = coords;
        resolve(validPosition(longitude, latitude) ? [longitude, latitude] : null);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 5 * 60_000 },
    );
  });
}

function validPosition(longitude: number, latitude: number): boolean {
  return Number.isFinite(longitude) && Number.isFinite(latitude) && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90;
}
