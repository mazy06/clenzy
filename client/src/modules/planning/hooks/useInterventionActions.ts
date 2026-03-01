import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../../services/api';
import type { PlanningIntervention } from '../../../services/api';
import type { PlanningEvent } from '../types';
import { planningKeys } from './usePlanningData';

interface ActionResult {
  success: boolean;
  error: string | null;
}

let mockIdCounter = 9000;

/**
 * Hook for creating and managing planning interventions.
 * Handles both mock mode (cache updates) and real API mode.
 */
export function useInterventionActions(
  events: PlanningEvent[],
  interventions: PlanningIntervention[],
) {
  const queryClient = useQueryClient();

  // ── Helper: insert intervention into cache ──────────────────────────────
  const insertInterventionInCache = useCallback(
    (intervention: PlanningIntervention) => {
      queryClient.setQueriesData(
        { queryKey: [...planningKeys.all, 'interventions'] },
        (old: unknown) => {
          if (!Array.isArray(old)) return [intervention];
          return [...old, intervention];
        },
      );
    },
    [queryClient],
  );

  // ── 1. Planifier menage automatique ─────────────────────────────────────
  const createAutoCleaning = useCallback(
    async (reservationId: number): Promise<ActionResult> => {
      const event = events.find((e) => e.id === `res-${reservationId}`);
      if (!event?.reservation) {
        return { success: false, error: 'Reservation introuvable' };
      }

      // Check if a cleaning already exists for this reservation
      const existingCleaning = interventions.find(
        (i) => i.linkedReservationId === reservationId && i.type === 'cleaning' && i.status !== 'cancelled',
      );
      if (existingCleaning) {
        return { success: false, error: 'Un menage est deja planifie pour cette reservation' };
      }

      const res = event.reservation;
      const guestCount = res.guestCount;
      const estHours = guestCount >= 5 ? 6 : 3;
      const durationDays = guestCount >= 5 ? 2 : 1;
      const startHour = guestCount >= 5 ? 11 : 12;
      const endHour = Math.min(startHour + estHours, 23);

      const endDate = new Date(res.checkOut);
      endDate.setDate(endDate.getDate() + durationDays);
      const endDateStr = endDate.toISOString().split('T')[0];

      const staff = ['Fatou Diallo', 'Carmen Lopez', 'Nathalie Blanc', 'Amina Keita', 'Lucie Moreau'];
      const assignee = staff[reservationId % staff.length];

      const newIntervention: PlanningIntervention = {
        id: ++mockIdCounter,
        propertyId: res.propertyId,
        propertyName: res.propertyName,
        type: 'cleaning',
        title: `Menage apres sejour ${res.guestName}`,
        assigneeName: assignee,
        startDate: res.checkOut,
        endDate: endDateStr,
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(endHour).padStart(2, '0')}:00`,
        status: 'scheduled',
        linkedReservationId: reservationId,
        estimatedDurationHours: estHours,
        notes: guestCount >= 5 ? 'Grand menage complet' : undefined,
      };

      try {
        if (reservationsApi.isMockMode()) {
          insertInterventionInCache(newIntervention);
        } else {
          // TODO: call real API when available
          insertInterventionInCache(newIntervention);
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }
        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors de la creation du menage' };
      }
    },
    [queryClient, events, interventions, insertInterventionInCache],
  );

  // ── 2. Creer intervention (maintenance / custom) ────────────────────────
  const createIntervention = useCallback(
    async (data: {
      propertyId: number;
      propertyName: string;
      type: 'cleaning' | 'maintenance';
      title: string;
      assigneeName: string;
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      estimatedDurationHours: number;
      notes?: string;
      linkedReservationId?: number;
    }): Promise<ActionResult> => {
      const newIntervention: PlanningIntervention = {
        id: ++mockIdCounter,
        ...data,
        status: 'scheduled',
      };

      try {
        if (reservationsApi.isMockMode()) {
          insertInterventionInCache(newIntervention);
        } else {
          insertInterventionInCache(newIntervention);
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }
        return { success: true, error: null };
      } catch {
        return { success: false, error: "Erreur lors de la creation de l'intervention" };
      }
    },
    [queryClient, insertInterventionInCache],
  );

  // ── 3. Assigner intervention ────────────────────────────────────────────
  const assignIntervention = useCallback(
    async (interventionId: number, assigneeName: string): Promise<ActionResult> => {
      try {
        if (reservationsApi.isMockMode()) {
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'interventions'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((i: any) => {
                if (i.id !== interventionId) return i;
                return { ...i, assigneeName };
              });
            },
          );
        } else {
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }
        return { success: true, error: null };
      } catch {
        return { success: false, error: "Erreur lors de l'assignation" };
      }
    },
    [queryClient],
  );

  // ── 4. Definir priorite (via notes prefix) ─────────────────────────────
  const setPriority = useCallback(
    async (interventionId: number, priority: 'normale' | 'haute' | 'urgente'): Promise<ActionResult> => {
      try {
        if (reservationsApi.isMockMode()) {
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'interventions'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((i: any) => {
                if (i.id !== interventionId) return i;
                const cleanedNotes = (i.notes || '').replace(/^\[PRIORITE: \w+\] ?/, '');
                const prefix = priority !== 'normale' ? `[PRIORITE: ${priority.toUpperCase()}] ` : '';
                return { ...i, notes: prefix + cleanedNotes };
              });
            },
          );
        } else {
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }
        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors du changement de priorite' };
      }
    },
    [queryClient],
  );

  // ── 5. Mettre a jour les notes d'une intervention ──────────────────────
  const updateInterventionNotes = useCallback(
    async (interventionId: number, notes: string): Promise<ActionResult> => {
      try {
        if (reservationsApi.isMockMode()) {
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'interventions'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((i: any) => {
                if (i.id !== interventionId) return i;
                return { ...i, notes };
              });
            },
          );
        } else {
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }
        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors de la sauvegarde' };
      }
    },
    [queryClient],
  );

  return {
    createAutoCleaning,
    createIntervention,
    assignIntervention,
    setPriority,
    updateInterventionNotes,
  };
}
