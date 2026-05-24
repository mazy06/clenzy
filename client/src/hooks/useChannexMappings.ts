/**
 * useChannexMappings — Quick Win #4 (health badge).
 *
 * <p>Hook qui fetche une fois la liste des mappings Channex de l'organisation
 * et expose une lookup map {@code propertyId → ChannexMappingDto} pour permettre
 * a chaque PropertyCard de connaitre son etat de sync sans dupliquer l'appel API.</p>
 *
 * <p><b>Gating</b> : l'endpoint backend est restreint aux SUPER_ADMIN / SUPER_MANAGER.
 * Le hook detecte le role via {@link useAuth} et skip silencieusement l'appel
 * pour les autres roles (evite 403 dans la console + appel inutile).</p>
 *
 * <p>Le hook expose un {@code refresh()} pour re-fetcher manuellement (utile
 * apres une (de)connexion).</p>
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { channexApi, type ChannexMappingDto } from '../services/api/channexApi';
import { useAuth } from './useAuth';

interface UseChannexMappingsResult {
  /** Map<clenzyPropertyId, ChannexMappingDto>. Vide si role insuffisant ou pas encore charge. */
  mappings: Map<number, ChannexMappingDto>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** true si le user a le role pour voir les mappings (SUPER_ADMIN / SUPER_MANAGER). */
  enabled: boolean;
}

const CHANNEX_ROLES = new Set(['SUPER_ADMIN', 'SUPER_MANAGER']);

export function useChannexMappings(): UseChannexMappingsResult {
  const { user } = useAuth();
  const enabled = useMemo(() => {
    if (!user) return false;
    // Le platformRole est la source de verite cote front pour le gating Channex.
    // Fallback sur user.roles[] si platformRole pas encore propage.
    if (user.platformRole && CHANNEX_ROLES.has(user.platformRole)) return true;
    return user.roles?.some((r) => CHANNEX_ROLES.has(r)) ?? false;
  }, [user]);

  const [mappings, setMappings] = useState<Map<number, ChannexMappingDto>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setMappings(new Map());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await channexApi.listMappings();
      const map = new Map<number, ChannexMappingDto>();
      for (const m of list) map.set(m.clenzyPropertyId, m);
      setMappings(map);
    } catch (err) {
      // 403/401 = role manquant ou auth expiree → on log discretement et
      // on n'affiche pas d'erreur dans l'UI (le badge sera juste absent).
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        setMappings(new Map());
      } else {
        setError(err instanceof Error ? err.message : 'Erreur de chargement Channex');
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { mappings, loading, error, refresh, enabled };
}
