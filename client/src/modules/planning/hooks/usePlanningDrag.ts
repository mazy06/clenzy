import { useState, useCallback, useMemo } from 'react';
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../../services/api';
import type { PlanningIntervention } from '../../../services/api';
import type {
  PlanningEvent,
  PlanningProperty,
  BarLayout,
  DensityMode,
  DragType,
  DragBarData,
  PlanningDragState,
} from '../types';
import { addDaysToStr } from '../utils/dateUtils';
import { computeBarLayout } from '../utils/layoutUtils';
import { wouldConflict } from '../utils/conflictUtils';
import { planningKeys } from './usePlanningData';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UsePlanningDragConfig {
  events: PlanningEvent[];
  properties: PlanningProperty[];
  interventions: PlanningIntervention[];
  days: Date[];
  dayWidth: number;
  density: DensityMode;
}

export interface UsePlanningDragReturn {
  sensors: ReturnType<typeof useSensors>;
  modifiers: ((args: any) => any)[];
  state: PlanningDragState;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

// ─── Initial state ──────────────────────────────────────────────────────────

const INITIAL_STATE: PlanningDragState = {
  activeId: null,
  activeType: null,
  dragConflict: false,
  ghostLayout: null,
  isDragging: false,
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePlanningDrag({
  events,
  interventions,
  days,
  dayWidth,
  density,
}: UsePlanningDragConfig): UsePlanningDragReturn {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PlanningDragState>(INITIAL_STATE);

  // Sensors: 8px activation distance to distinguish click from drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // Modifiers: horizontal only
  const modifiers = useMemo(() => [restrictToHorizontalAxis], []);

  // ── Compute ghost layout from drag delta ──────────────────────────────────

  const computeGhost = useCallback(
    (originalEvent: PlanningEvent, deltaX: number, type: DragType): {
      ghost: BarLayout | null;
      conflict: boolean;
      newEvent: PlanningEvent;
    } => {
      const daysDelta = Math.round(deltaX / dayWidth);
      if (daysDelta === 0) {
        const ghost = computeBarLayout(originalEvent, days, dayWidth, density);
        return { ghost, conflict: false, newEvent: originalEvent };
      }

      const newEvent = { ...originalEvent };
      if (type === 'move') {
        newEvent.startDate = addDaysToStr(originalEvent.startDate, daysDelta);
        newEvent.endDate = addDaysToStr(originalEvent.endDate, daysDelta);
      } else {
        // Resize: only change endDate
        newEvent.endDate = addDaysToStr(originalEvent.endDate, daysDelta);
        // Minimum 1 night
        if (newEvent.endDate <= newEvent.startDate) {
          newEvent.endDate = addDaysToStr(newEvent.startDate, 1);
        }
      }

      const ghost = computeBarLayout(newEvent, days, dayWidth, density);
      const conflict = wouldConflict(newEvent, events, interventions);
      return { ghost, conflict, newEvent };
    },
    [dayWidth, days, density, events, interventions],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragBarData | undefined;
    if (!data) return;

    setState({
      activeId: String(event.active.id),
      activeType: data.type,
      dragConflict: false,
      ghostLayout: data.layout,
      isDragging: true,
    });
  }, []);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const data = event.active.data.current as DragBarData | undefined;
      if (!data) return;

      const deltaX = event.delta.x;
      const { ghost, conflict } = computeGhost(data.event, deltaX, data.type);

      setState((prev) => ({
        ...prev,
        ghostLayout: ghost,
        dragConflict: conflict,
      }));
    },
    [computeGhost],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const data = event.active.data.current as DragBarData | undefined;
      if (!data) {
        setState(INITIAL_STATE);
        return;
      }

      const deltaX = event.delta.x;
      const daysDelta = Math.round(deltaX / dayWidth);

      // No change
      if (daysDelta === 0) {
        setState(INITIAL_STATE);
        return;
      }

      const { conflict, newEvent } = computeGhost(data.event, deltaX, data.type);

      // Cancel if conflict
      if (conflict) {
        setState(INITIAL_STATE);
        return;
      }

      // Apply mutation
      const numericId = parseInt(data.event.id.replace('res-', ''), 10);
      const newDates: { checkIn?: string; checkOut?: string } = {};

      if (data.type === 'move') {
        newDates.checkIn = newEvent.startDate;
        newDates.checkOut = newEvent.endDate;
      } else {
        newDates.checkOut = newEvent.endDate;
      }

      try {
        if (reservationsApi.isMockMode()) {
          // Optimistic update for mock mode — do NOT invalidate
          // because invalidation refetches mock data which regenerates originals

          // 1. Update the reservation
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'reservations'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((r: any) =>
                r.id === numericId
                  ? {
                      ...r,
                      ...(newDates.checkIn && { checkIn: newDates.checkIn }),
                      ...(newDates.checkOut && { checkOut: newDates.checkOut }),
                    }
                  : r,
              );
            },
          );

          // 2. Update linked interventions (e.g. cleaning after checkout)
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'interventions'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((i: any) => {
                if (i.linkedReservationId !== numericId) return i;

                if (data.type === 'move') {
                  // Move: shift intervention dates by the same delta
                  return {
                    ...i,
                    startDate: addDaysToStr(i.startDate, daysDelta),
                    endDate: addDaysToStr(i.endDate, daysDelta),
                  };
                } else {
                  // Resize: intervention starts at new checkout date
                  const interventionDuration =
                    (new Date(i.endDate).getTime() - new Date(i.startDate).getTime()) /
                    (1000 * 60 * 60 * 24);
                  const newStartDate = newEvent.endDate;
                  const newEndDate = addDaysToStr(newStartDate, interventionDuration);
                  return {
                    ...i,
                    startDate: newStartDate,
                    endDate: newEndDate,
                  };
                }
              });
            },
          );
        } else {
          await reservationsApi.update(numericId, newDates);
          // Backend should handle linked interventions automatically
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }
      } catch {
        // Silently fail, data will re-fetch
      }

      setState(INITIAL_STATE);
    },
    [dayWidth, computeGhost, queryClient],
  );

  const handleDragCancel = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    sensors,
    modifiers,
    state,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
  };
}
