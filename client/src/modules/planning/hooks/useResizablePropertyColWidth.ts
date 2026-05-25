import { useCallback, useEffect, useState } from 'react';
import { useUserPreference } from '../../../hooks/useUserPreference';
import { usePropertyColWidth } from './usePropertyColWidth';

// ─── Backend-persisted prefs (cf. UserUiPreferencesProvider) ────────────────
//
// La largeur de colonne logements est persistee cote backend pour traverser
// les devices. Si l'utilisateur n'a jamais resize manuellement, on suit
// la valeur breakpoint-based de usePropertyColWidth.

const PREF_KEY = 'planning.propertyColWidth';

/** Min : carousel rowHeight (50-72) + marge texte minimale. */
export const PROPERTY_COL_MIN_WIDTH = 140;
/** Max : evite que la colonne ne mange tout le viewport. */
export const PROPERTY_COL_MAX_WIDTH = 480;

function clampWidth(n: number): number {
  return Math.max(PROPERTY_COL_MIN_WIDTH, Math.min(PROPERTY_COL_MAX_WIDTH, Math.round(n)));
}

/** Retourne null si la valeur persistee est invalide / hors borne. */
function sanitize(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (raw < PROPERTY_COL_MIN_WIDTH || raw > PROPERTY_COL_MAX_WIDTH) return null;
  return raw;
}

/**
 * Largeur de la colonne logements, redimensionnable par l'utilisateur.
 *
 * - Defaut : valeur breakpoint-based (usePropertyColWidth)
 * - Override : valeur persistee cote backend si l'user a deja resize
 * - Clamp : [PROPERTY_COL_MIN_WIDTH, PROPERTY_COL_MAX_WIDTH]
 *
 * Retourne `setWidth` pour brancher sur un drag handle.
 */
export function useResizablePropertyColWidth() {
  const breakpointDefault = usePropertyColWidth();
  // null = "user n'a jamais resize manuellement, suivre le breakpoint"
  const [persistedWidth, setPersistedWidth] = useUserPreference<number | null>(PREF_KEY, null);
  const sanitized = sanitize(persistedWidth);

  // Si l'utilisateur a deja resize, on garde sa valeur (sanitize).
  // Sinon, on suit le breakpoint courant.
  const [width, setWidthState] = useState<number>(() => sanitized ?? breakpointDefault);

  // Si la pref serveur arrive plus tard (chargement async), la synchroniser.
  useEffect(() => {
    setWidthState(sanitized ?? breakpointDefault);
  }, [sanitized, breakpointDefault]);

  const setWidth = useCallback(
    (next: number) => {
      const clamped = clampWidth(next);
      setWidthState(clamped);
      setPersistedWidth(clamped);
    },
    [setPersistedWidth],
  );

  return { width, setWidth };
}
