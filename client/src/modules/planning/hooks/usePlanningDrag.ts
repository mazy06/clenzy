import type { PlanningData } from '../../../services/api/planningDataApi';
import { updateBaitlyPlanningStay } from '../utils/baitlyPlanningCache';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { useTranslation } from 'react-i18next';
import { reservationsApi } from '../../../services/api/reservationsApi';
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
import { isRtlLanguage } from '../../../utils/localeDate';
import { computeBarLayout } from '../utils/layoutUtils';
import { validatePlanningEvent } from '../utils/conflictUtils';
import { planningKeys } from './usePlanningData';
import { useNotification } from '../../../hooks/useNotification';
import { saveBaitlyInterventionSchedule } from '../utils/baitlyInterventionSchedule';

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
  const { notify } = useNotification();
  // Sens de lecture de la frise. dnd-kit rend un delta de pixels PHYSIQUE : en
  // arabe, tirer une brique vers la gauche l'avance dans le temps. Sans ce
  // signe, glisser une reservation la reculerait d'autant de jours.
  const { i18n, t } = useTranslation();
  const timeDirection = isRtlLanguage(i18n.language) ? -1 : 1;
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
      const daysDelta = Math.round((deltaX * timeDirection) / dayWidth);
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
      const conflict = !validatePlanningEvent(newEvent, events, interventions).valid;
      return { ghost, conflict, newEvent };
    },
    [dayWidth, days, density, events, interventions, timeDirection],
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

  // ── Throttle rAF du drag move ─────────────────────────────────────────────
  // dnd-kit émet onDragMove à chaque mousemove ; un setState par événement
  // re-rendait toute la grille plusieurs fois par frame. On mémorise le
  // dernier delta et on n'applique qu'UN setState par frame d'animation.
  const moveRaf = useRef<number | null>(null);
  const pendingMove = useRef<{ event: PlanningEvent; deltaX: number; type: DragType } | null>(null);

  const cancelPendingMove = useCallback(() => {
    if (moveRaf.current !== null) {
      cancelAnimationFrame(moveRaf.current);
      moveRaf.current = null;
    }
    pendingMove.current = null;
  }, []);

  // Annule un rAF encore en vol si le composant se démonte en plein drag.
  useEffect(() => cancelPendingMove, [cancelPendingMove]);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const data = event.active.data.current as DragBarData | undefined;
      if (!data) return;

      pendingMove.current = { event: data.event, deltaX: event.delta.x, type: data.type };
      if (moveRaf.current !== null) return; // un rAF est déjà planifié pour cette frame

      moveRaf.current = requestAnimationFrame(() => {
        moveRaf.current = null;
        const pending = pendingMove.current;
        if (!pending) return;
        const { ghost, conflict } = computeGhost(pending.event, pending.deltaX, pending.type);
        setState((prev) => {
          // Drop/cancel déjà passé entre la planification et la frame : ne pas
          // réintroduire un ghost sur l'état réinitialisé.
          if (!prev.isDragging) return prev;
          return { ...prev, ghostLayout: ghost, dragConflict: conflict };
        });
      });
    },
    [computeGhost],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      // Un rAF de move encore planifié ne doit pas écraser l'état final.
      cancelPendingMove();

      const data = event.active.data.current as DragBarData | undefined;
      if (!data) {
        setState(INITIAL_STATE);
        return;
      }

      const deltaX = event.delta.x;
      const daysDelta = Math.round((deltaX * timeDirection) / dayWidth);

      // No change
      if (daysDelta === 0) {
        setState(INITIAL_STATE);
        return;
      }

      const { conflict, newEvent } = computeGhost(data.event, deltaX, data.type);

      // Cancel if conflict
      if (conflict) {
        const validation = validatePlanningEvent(newEvent, events, interventions);
        notify.warning(t(`planning.feedback.${validation.reason}`, validation.error ?? 'Ce créneau est indisponible.'));
        setState(INITIAL_STATE);
        return;
      }

      // Determine event type and apply appropriate mutation
      const isInterventionEvent =
        data.event.type === 'cleaning' || data.event.type === 'maintenance';

      const snapshots: { key: readonly unknown[]; before: PlanningData | undefined; optimistic: PlanningData | undefined }[] = [];
      try {
        if (isInterventionEvent) {
          const intervention = data.event.intervention ?? interventions.find((item) => `int-${item.id}` === data.event.id);
          if (!intervention) throw new Error('Intervention introuvable');
          await saveBaitlyInterventionSchedule(intervention, data.type === 'move'
            ? { startDate: newEvent.startDate }
            : { endDate: newEvent.endDate });
        } else {
          // ── Reservation mutation (existing logic) ─────────────────────────
          const numericId = parseInt(data.event.id.replace('res-', ''), 10);
          const newDates: { checkIn?: string; checkOut?: string } = {};

          if (data.type === 'move') {
            newDates.checkIn = newEvent.startDate;
            newDates.checkOut = newEvent.endDate;
          } else {
            newDates.checkOut = newEvent.endDate;
          }

          for (const [key, before] of queryClient.getQueriesData<PlanningData>({ queryKey: [...planningKeys.all, 'data'] })) {
            const optimistic = updateBaitlyPlanningStay(before, numericId, newDates, { type: data.type, daysDelta });
            queryClient.setQueryData(key, optimistic);
            snapshots.push({ key, before, optimistic: queryClient.getQueryData(key) });
          }

          await reservationsApi.update(numericId, newDates);
        }
      } catch (error) {
        // Ne pas écraser une modification concurrente avec un ancien snapshot.
        for (const snapshot of snapshots) {
          if (queryClient.getQueryData(snapshot.key) === snapshot.optimistic) queryClient.setQueryData(snapshot.key, snapshot.before);
        }
        notify.error(t('planning.feedback.saveError', 'Le déplacement n’a pas été enregistré. Les dates précédentes sont restaurées.')
          + (error instanceof Error ? ` ${error.message}` : ''));
      } finally {
        // Le serveur reste la source de vérité, après succès comme après échec.
        void queryClient.invalidateQueries({ queryKey: planningKeys.all });
        setState(INITIAL_STATE);
      }
    },
    [dayWidth, timeDirection, computeGhost, queryClient, cancelPendingMove, events, interventions, notify, t],
  );

  const handleDragCancel = useCallback(() => {
    cancelPendingMove();
    setState(INITIAL_STATE);
  }, [cancelPendingMove]);

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
