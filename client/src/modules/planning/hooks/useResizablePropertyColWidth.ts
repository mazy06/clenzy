import { useCallback, useEffect, useState } from 'react';
import { usePropertyColWidth } from './usePropertyColWidth';

const STORAGE_KEY = 'planning.propertyColWidth';

/** Min : carousel rowHeight (50-72) + marge texte minimale. */
export const PROPERTY_COL_MIN_WIDTH = 140;
/** Max : evite que la colonne ne mange tout le viewport. */
export const PROPERTY_COL_MAX_WIDTH = 480;

function readStoredWidth(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return null;
    if (n < PROPERTY_COL_MIN_WIDTH || n > PROPERTY_COL_MAX_WIDTH) return null;
    return n;
  } catch {
    return null;
  }
}

/**
 * Largeur de la colonne logements, redimensionnable par l'utilisateur.
 *
 * - Defaut : valeur breakpoint-based (usePropertyColWidth)
 * - Override : valeur persistee dans localStorage si l'user a deja resize
 * - Clamp : [PROPERTY_COL_MIN_WIDTH, PROPERTY_COL_MAX_WIDTH]
 *
 * Retourne `setWidth` pour brancher sur un drag handle.
 */
export function useResizablePropertyColWidth() {
  const breakpointDefault = usePropertyColWidth();
  const [width, setWidthState] = useState<number>(() => {
    return readStoredWidth() ?? breakpointDefault;
  });

  // Si l'utilisateur n'a JAMAIS resize manuellement, suivre le breakpoint
  // (pour qu'un changement de viewport applique la nouvelle valeur defaut).
  useEffect(() => {
    if (readStoredWidth() == null) {
      setWidthState(breakpointDefault);
    }
  }, [breakpointDefault]);

  const setWidth = useCallback((next: number) => {
    const clamped = Math.max(
      PROPERTY_COL_MIN_WIDTH,
      Math.min(PROPERTY_COL_MAX_WIDTH, Math.round(next)),
    );
    setWidthState(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // Stockage indisponible (mode prive Safari, quota) — on ignore,
      // la valeur reste appliquee pour la session.
    }
  }, []);

  return { width, setWidth };
}
