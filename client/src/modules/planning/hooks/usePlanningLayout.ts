import { useCallback, useMemo } from 'react';
import type { PlanningEvent, BarLayout, DensityMode } from '../types';
import { computePropertyBarLayouts } from '../utils/layoutUtils';

export interface UsePlanningLayoutReturn {
  getBarLayouts: (propertyId: number) => BarLayout[];
  totalGridWidth: number;
}

export function usePlanningLayout(
  events: PlanningEvent[],
  days: Date[],
  dayWidth: number,
  density: DensityMode,
): UsePlanningLayoutReturn {
  // Group events by property
  const eventsByProperty = useMemo(() => {
    const map = new Map<number, PlanningEvent[]>();
    for (const event of events) {
      const list = map.get(event.propertyId);
      if (list) {
        list.push(event);
      } else {
        map.set(event.propertyId, [event]);
      }
    }
    return map;
  }, [events]);

  // Compute all bar layouts (memoized by property)
  const layoutsByProperty = useMemo(() => {
    const map = new Map<number, BarLayout[]>();
    for (const [propertyId, propertyEvents] of eventsByProperty) {
      map.set(propertyId, computePropertyBarLayouts(propertyEvents, days, dayWidth, density));
    }
    return map;
  }, [eventsByProperty, days, dayWidth, density]);

  // Référence stable : cette fonction est passée en prop à PlanningTimeline
  // (React.memo) — une identité recréée à chaque render cassait la barrière de memo.
  const getBarLayouts = useCallback(
    (propertyId: number): BarLayout[] => layoutsByProperty.get(propertyId) ?? [],
    [layoutsByProperty],
  );

  const totalGridWidth = days.length * dayWidth;

  return {
    getBarLayouts,
    totalGridWidth,
  };
}
