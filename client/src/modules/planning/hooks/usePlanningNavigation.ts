import { useCallback, useMemo, useState } from 'react';
import { addDays, subDays } from 'date-fns';
import { useUserPreference } from '../../../hooks/useUserPreference';
import type { ZoomLevel, DensityMode } from '../types';
import { ZOOM_CONFIGS } from '../constants';

// ─── Backend-persisted prefs (cf. UserUiPreferencesProvider) ────────────────
//
// On persiste `zoom` et `density` (preferences d'affichage). `currentDate`
// reste ephemere (le planning revient toujours sur aujourd'hui au reload)
// et `isFullscreen` reste session-scoped.

const PREF_KEY = 'planning.nav';

interface PersistedNav {
  zoom: ZoomLevel;
  density: DensityMode;
}

const DEFAULT_NAV: PersistedNav = { zoom: 'week', density: 'normal' };

const VALID_ZOOMS: ZoomLevel[] = ['day', 'week', 'month'];
const VALID_DENSITIES: DensityMode[] = ['normal', 'compact'];

function sanitize(raw: unknown): PersistedNav {
  if (!raw || typeof raw !== 'object') return DEFAULT_NAV;
  const r = raw as Record<string, unknown>;
  return {
    zoom: VALID_ZOOMS.includes(r.zoom as ZoomLevel) ? (r.zoom as ZoomLevel) : DEFAULT_NAV.zoom,
    density: VALID_DENSITIES.includes(r.density as DensityMode)
      ? (r.density as DensityMode)
      : DEFAULT_NAV.density,
  };
}

export interface UsePlanningNavigationReturn {
  currentDate: Date;
  zoom: ZoomLevel;
  density: DensityMode;
  isFullscreen: boolean;
  dayWidth: number;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  setZoom: (zoom: ZoomLevel) => void;
  setDensity: (density: DensityMode) => void;
  setCurrentDate: (date: Date) => void;
  toggleFullscreen: () => void;
}

export function usePlanningNavigation(): UsePlanningNavigationReturn {
  const [persisted, setPersisted] = useUserPreference<PersistedNav>(PREF_KEY, DEFAULT_NAV);
  const safe = useMemo(() => sanitize(persisted), [persisted]);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const config = ZOOM_CONFIGS[safe.zoom];

  const setZoom = useCallback(
    (zoom: ZoomLevel) => setPersisted({ ...safe, zoom }),
    [safe, setPersisted],
  );

  const setDensity = useCallback(
    (density: DensityMode) => setPersisted({ ...safe, density }),
    [safe, setPersisted],
  );

  const goToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goPrev = useCallback(() => {
    setCurrentDate((prev) => subDays(prev, config.navStep));
  }, [config.navStep]);

  const goNext = useCallback(() => {
    setCurrentDate((prev) => addDays(prev, config.navStep));
  }, [config.navStep]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  return {
    currentDate,
    zoom: safe.zoom,
    density: safe.density,
    isFullscreen,
    dayWidth: config.dayWidth,
    goToday,
    goPrev,
    goNext,
    setZoom,
    setDensity,
    setCurrentDate,
    toggleFullscreen,
  };
}
