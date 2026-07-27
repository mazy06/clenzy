import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { interventionsApi } from '../../../services/api/interventionsApi';
import type { PlanningIntervention } from '../../../services/api';
import type { PlanningEvent } from '../types';
import { planningKeys } from './usePlanningData';

interface ActionResult {
  success: boolean;
  error: string | null;
}

let localIdCounter = 9000;

/**
 * Hook for creating and managing planning interventions.
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
        id: ++localIdCounter,
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
        // TODO: call real API when available
        insertInterventionInCache(newIntervention);
        queryClient.invalidateQueries({ queryKey: planningKeys.all });
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
        id: ++localIdCounter,
        ...data,
        status: 'scheduled',
      };

      try {
        insertInterventionInCache(newIntervention);
        queryClient.invalidateQueries({ queryKey: planningKeys.all });
        return { success: true, error: null };
      } catch {
        return { success: false, error: "Erreur lors de la creation de l'intervention" };
      }
    },
    [queryClient, insertInterventionInCache],
  );

  // ── 3. Assigner intervention ────────────────────────────────────────────
  const assignIntervention = useCallback(
    async (
      interventionId: number,
      assigneeName: string,
      options?: { userId?: number; teamId?: number },
    ): Promise<ActionResult> => {
      try {
        // Call the real API to assign the intervention
        await interventionsApi.assign(interventionId, options?.userId, options?.teamId);
        queryClient.invalidateQueries({ queryKey: planningKeys.all });
        return { success: true, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur lors de l'assignation";
        return { success: false, error: msg };
      }
    },
    [queryClient],
  );

  // ── 4. Definir priorite ────────────────────────────────────────────────
  const setPriority = useCallback(
    async (interventionId: number, priority: 'normale' | 'haute' | 'urgente'): Promise<ActionResult> => {
      try {
        queryClient.invalidateQueries({ queryKey: planningKeys.all });
        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors du changement de priorite' };
      }
    },
    [queryClient],
  );

  // ── 5. Mettre a jour les dates/heures d'une intervention ───────────────
  const updateInterventionDates = useCallback(
    async (
      interventionId: number,
      updates: {
        startDate?: string;
        endDate?: string;
        startTime?: string;
        endTime?: string;
      },
    ): Promise<ActionResult> => {
      const intervention = interventions.find((i) => i.id === interventionId);
      if (!intervention) {
        return { success: false, error: 'Intervention introuvable' };
      }

      try {
        // TODO: call real API when available
        queryClient.invalidateQueries({ queryKey: planningKeys.all });
        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors de la mise a jour des dates' };
      }
    },
    [queryClient, interventions],
  );

  // ── 6. Mettre a jour les notes d'une intervention ──────────────────────
  const updateInterventionNotes = useCallback(
    async (interventionId: number, notes: string): Promise<ActionResult> => {
      try {
        queryClient.invalidateQueries({ queryKey: planningKeys.all });
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
    updateInterventionDates,
    updateInterventionNotes,
  };
}
