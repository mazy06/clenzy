import { useCallback, useEffect, useState } from 'react';

/**
 * Persistance des overrides d'icones d'amenities, par organisation.
 *
 * <p><b>Stockage</b> : localStorage, cle {@code clenzy:amenity-icons:<orgId>}.
 * Choix MVP : pas de table DB pour l'instant — l'override est browser-scope. Pour
 * partager entre devices/users il faudra une table {@code amenity_icon_override}
 * (orgId, amenityCode, iconName) cote backend. Ticket de suivi a creer.</p>
 *
 * <p>API : {@code overrides} = Record code → iconName, {@code setIcon}, {@code resetIcon}.</p>
 */

const STORAGE_PREFIX = 'clenzy:amenity-icons:';

function storageKey(orgId: string | number | null | undefined): string {
  return `${STORAGE_PREFIX}${orgId ?? 'anon'}`;
}

function readStorage(orgId: string | number | null | undefined): Record<string, string> {
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

function writeStorage(orgId: string | number | null | undefined, value: Record<string, string>): void {
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
  const [overrides, setOverrides] = useState<Record<string, string>>(() => readStorage(orgId));

  // Re-load quand l'org change (changement de tenant via SUPER_ADMIN par ex.)
  useEffect(() => {
    setOverrides(readStorage(orgId));
  }, [orgId]);

  const setIcon = useCallback(
    (code: string, iconName: string) => {
      setOverrides((prev) => {
        const next = { ...prev, [code]: iconName };
        writeStorage(orgId, next);
        return next;
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
        writeStorage(orgId, next);
        return next;
      });
    },
    [orgId],
  );

  const resetAll = useCallback(() => {
    writeStorage(orgId, {});
    setOverrides({});
  }, [orgId]);

  return { overrides, setIcon, resetIcon, resetAll };
}
