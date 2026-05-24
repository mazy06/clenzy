import { useCallback, useEffect, useState } from 'react';
import { amenityIconOverridesApi } from '../../../services/api/amenityIconOverridesApi';

/**
 * Persistance des overrides d'icones d'amenities, par organisation.
 *
 * <h2>Architecture</h2>
 * <p><b>Source de verite : backend</b> (table {@code organization_amenity_icon_overrides},
 * controller {@code AmenityIconOverrideController}, migration 0134). Permet
 * la synchro cross-devices et cross-users d'une meme organisation.</p>
 *
 * <p><b>Cache local : localStorage</b> sous {@code clenzy:amenity-icons:<orgId>}.
 * Sert a 2 choses :
 * <ul>
 *   <li>Render instantane : on hydrate le state initial depuis le cache sans
 *       attendre la requete reseau (zero flash).</li>
 *   <li>Resilience offline : si l'API echoue, le user continue de voir ses
 *       overrides locaux. Les ecritures echouees seront retentees au prochain
 *       changement (best-effort, pas de queue dedidee — acceptable car les
 *       changements d'icone sont rares).</li>
 * </ul></p>
 *
 * <p>API : {@code overrides} = Record code → iconName, {@code setIcon}, {@code resetIcon}.</p>
 */

const STORAGE_PREFIX = 'clenzy:amenity-icons:';

function storageKey(orgId: string | number | null | undefined): string {
  return `${STORAGE_PREFIX}${orgId ?? 'anon'}`;
}

function readCache(orgId: string | number | null | undefined): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(orgId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeCache(orgId: string | number | null | undefined, value: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(orgId), JSON.stringify(value));
  } catch {
    /* quota / privacy mode → silent fail */
  }
}

export interface AmenityIconOverridesApi {
  overrides: Record<string, string>;
  setIcon: (code: string, iconName: string) => void;
  resetIcon: (code: string) => void;
  resetAll: () => void;
}

export function useAmenityIconOverrides(orgId: string | number | null | undefined): AmenityIconOverridesApi {
  // Hydratation synchrone depuis le cache pour eviter un flash a la 1ere render.
  const [overrides, setOverrides] = useState<Record<string, string>>(() => readCache(orgId));

  // Au mount + a chaque changement d'org : fetch backend pour aligner la
  // source de verite. Si OK, on met a jour le cache local.
  useEffect(() => {
    if (orgId === null || orgId === undefined) {
      setOverrides({});
      return;
    }
    let cancelled = false;
    amenityIconOverridesApi.list()
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const r of rows) next[r.amenityCode] = r.iconName;
        setOverrides(next);
        writeCache(orgId, next);
      })
      .catch(() => {
        // Backend down / 401 : on garde le cache localStorage comme fallback.
        // L'utilisateur peut continuer a piloter ses icones en mode degrade.
      });
    return () => { cancelled = true; };
  }, [orgId]);

  const setIcon = useCallback(
    (code: string, iconName: string) => {
      // Optimistic update : on applique localement + cache, puis on persiste.
      // Si l'API echoue, on conserve l'etat local (best-effort, voir doc en-tete).
      setOverrides((prev) => {
        const next = { ...prev, [code]: iconName };
        writeCache(orgId, next);
        return next;
      });
      amenityIconOverridesApi.upsert(code, iconName).catch(() => {
        /* network error — le cache local conserve la valeur */
      });
    },
    [orgId],
  );

  const resetIcon = useCallback(
    (code: string) => {
      setOverrides((prev) => {
        if (!(code in prev)) return prev;
        const next = { ...prev };
        delete next[code];
        writeCache(orgId, next);
        return next;
      });
      amenityIconOverridesApi.delete(code).catch(() => {
        /* network error — le cache local conserve l'etat */
      });
    },
    [orgId],
  );

  const resetAll = useCallback(() => {
    const current = overrides;
    writeCache(orgId, {});
    setOverrides({});
    // Backend ne propose pas de "delete all" — on fire-and-forget les deletes
    // un par un. Acceptable car resetAll est rare (CTA admin explicit).
    Object.keys(current).forEach((code) => {
      amenityIconOverridesApi.delete(code).catch(() => { /* best-effort */ });
    });
  }, [orgId, overrides]);

  return { overrides, setIcon, resetIcon, resetAll };
}
