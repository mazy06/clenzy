import { useState, useCallback, useEffect } from 'react';
import { addDays, subDays } from 'date-fns';
import { getParsedAccessToken } from '../../../keycloak';
import type { ZoomLevel, DensityMode } from '../types';
import { ZOOM_CONFIGS } from '../constants';

// ─── localStorage persistence (per-user) ────────────────────────────────────
//
// On persiste `zoom` et `density` (les preferences d'affichage), mais PAS
// `currentDate` (le planning revient toujours sur aujourd'hui au reload) ni
// `isFullscreen` (ephemere par session).

const STORAGE_KEY_PREFIX = 'clenzy.planning.nav';

interface PersistedNav {
  zoom: ZoomLevel;
  density: DensityMode;
}

function storageKey(): string {
  const sub = getParsedAccessToken()?.sub ?? 'anon';
  return `${STORAGE_KEY_PREFIX}.${sub}`;
}

const VALID_ZOOMS: ZoomLevel[] = ['day', 'week', 'month'];
const VALID_DENSITIES: DensityMode[] = ['normal', 'compact'];

function loadPersistedNav(): Partial<PersistedNav> {
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<PersistedNav> = {};
    if (VALID_ZOOMS.includes(parsed.zoom)) out.zoom = parsed.zoom;
    if (VALID_DENSITIES.includes(parsed.density)) out.density = parsed.density;
    return out;
  } catch {
    return {};
  }
}

function savePersistedNav(state: PersistedNav): void {
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch {
    // ignore (quota, private mode)
  }
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
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [zoom, setZoom] = useState<ZoomLevel>(() => loadPersistedNav().zoom ?? 'week');
  const [density, setDensity] = useState<DensityMode>(() => loadPersistedNav().density ?? 'normal');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Persiste zoom + density a chaque changement.
  useEffect(() => {
    savePersistedNav({ zoom, density });
  }, [zoom, density]);

  const config = ZOOM_CONFIGS[zoom];

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
    zoom,
    density,
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
