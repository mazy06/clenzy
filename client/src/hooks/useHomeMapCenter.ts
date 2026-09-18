import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../services/api/usersApi';
import { useIsAuthenticated } from './useIsAuthenticated';

/**
 * Ou les cartes s'ouvrent : la ville du compte Baitly, en `[lng, lat]`.
 *
 * <p>`undefined` tant que la reponse n'est pas la, et durablement quand le
 * compte n'a pas de ville exploitable — l'appelant garde alors le defaut de
 * la carte. Centrer est un CONFORT : ce hook ne rend jamais d'erreur et ne
 * doit jamais retarder un ecran.</p>
 *
 * <p>La ville d'un compte ne bouge pas d'une session a l'autre, et le
 * geocodage est deja mis en cache cote serveur : une seule requete par
 * session suffit, d'ou `staleTime: Infinity` et l'absence de retry.</p>
 */
export function useHomeMapCenter(): [number, number] | undefined {
  const isAuthed = useIsAuthenticated();
  const { data } = useQuery({
    queryKey: ['home-location', 'me'],
    queryFn: usersApi.getMyHomeLocation,
    enabled: isAuthed,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  // Reference STABLE : `center` alimente la creation de la carte Mapbox ; un
  // tableau recree a chaque render la ferait reconstruire en boucle.
  return useMemo(
    () => (data ? ([data.longitude, data.latitude] as [number, number]) : undefined),
    [data],
  );
}
