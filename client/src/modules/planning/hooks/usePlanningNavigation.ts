import { useState, useCallback } from 'react';
import { addDays, subDays } from 'date-fns';
import type { ZoomLevel, DensityMode } from '../types';
import { ZOOM_CONFIGS } from '../constants';

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
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [density, setDensity] = useState<DensityMode>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);

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
