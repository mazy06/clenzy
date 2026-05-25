import { useCallback, useEffect, useState } from 'react';
import { amenityIconOverridesApi } from '../../../services/api/amenityIconOverridesApi';
import { idbCache } from '../../../services/indexedDbCache';

/**
 * Persistance des overrides d'icones d'amenities, par organisation.
 *
 * <h2>Architecture</h2>
 * <p><b>Source de verite : backend</b> (table {@code organization_amenity_icon_overrides},
 * controller {@code AmenityIconOverrideController}, migration 0134). Permet
 * la synchro cross-devices et cross-users d'une meme organisation.</p>
 *
 * <p><b>Cache local : IndexedDB</b> sous la cle {@code amenity-icons:<orgId>}
 * (wrapper {@link idbCache}). Choix d'IndexedDB plutot que localStorage :
 * <ul>
 *   <li>Quota plus large (>50 MB vs ~5 MB) — permet de stocker des centaines
 *       d'overrides par org sans pression sur le quota partage.</li>
 *   <li>Pas de pollution de l'espace localStorage (qui doit rester reserve
 *       aux preferences UI synchrones critiques : theme, sidebar, currency).</li>
 *   <li>Async par nature, donc on accepte un tres bref "flash" au mount
 *       (overrides vides → puis populated apres ~5-10ms IDB lookup) mais
 *       l'utilisateur ne le voit quasi jamais en pratique car les icones
 *       par defaut s'affichent en attendant.</li>
 * </ul>
 * Resilience offline : si l'API echoue, le user continue de voir ses
 * overrides locaux. Best-effort, pas de queue dediee — acceptable car
 * les changements d'icone sont rares.</p>
 *
 * <p>API : {@code overrides} = Record code → iconName, {@code setIcon}, {@code resetIcon}.</p>
 */

function cacheKey(orgId: string | number | null | undefined): string {
  return `amenity-icons:${orgId ?? 'anon'}`;
}

function isValidPayload(raw: unknown): raw is Record<string, string> {
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw));
}

export interface AmenityIconOverridesApi {
  overrides: Record<string, string>;
  setIcon: (code: string, iconName: string) => void;
  resetIcon: (code: string) => void;
  resetAll: () => void;
}

export function useAmenityIconOverrides(orgId: string | number | null | undefined): AmenityIconOverridesApi {
  // IDB est async → pas d'hydratation synchrone possible comme avec
  // localStorage. On part avec un objet vide, et on hydrate des que l'IDB
  // lookup + l'API repondent. En pratique l'IDB resout en ~5-10ms.
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Au mount + a chaque changement d'org :
  //   1. Hydrate immediatement depuis IDB (cache local rapide)
  //   2. En parallele : fetch backend pour aligner la source de verite
  //   3. Si backend OK : sync IDB
  useEffect(() => {
    if (orgId === null || orgId === undefined) {
      setOverrides({});
      return;
    }
    let cancelled = false;

    // 1. IDB hydration (rapide, ~5-10ms)
    idbCache.get<Record<string, string>>(cacheKey(orgId)).then((cached) => {
      if (cancelled) return;
      if (isValidPayload(cached)) {
        setOverrides(cached);
      }
    });

    // 2. Backend sync (source de verite)
    amenityIconOverridesApi.list()
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const r of rows) next[r.amenityCode] = r.iconName;
        setOverrides(next);
        idbCache.set(cacheKey(orgId), next).catch(() => { /* best-effort */ });
      })
      .catch(() => {
        // Backend down / 401 : on garde le cache IDB comme fallback.
        // L'utilisateur peut continuer a piloter ses icones en mode degrade.
      });

    return () => { cancelled = true; };
  }, [orgId]);

  const setIcon = useCallback(
    (code: string, iconName: string) => {
      // Optimistic update : on applique localement + cache, puis on persiste.
      setOverrides((prev) => {
        const next = { ...prev, [code]: iconName };
        idbCache.set(cacheKey(orgId), next).catch(() => { /* best-effort */ });
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
        idbCache.set(cacheKey(orgId), next).catch(() => { /* best-effort */ });
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
    idbCache.set(cacheKey(orgId), {}).catch(() => { /* best-effort */ });
    setOverrides({});
    // Backend ne propose pas de "delete all" — on fire-and-forget les deletes
    // un par un. Acceptable car resetAll est rare (CTA admin explicit).
    Object.keys(current).forEach((code) => {
      amenityIconOverridesApi.delete(code).catch(() => { /* best-effort */ });
    });
  }, [orgId, overrides]);

  return { overrides, setIcon, resetIcon, resetAll };
}
