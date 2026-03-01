import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../../services/api';
import type { PlanningIntervention } from '../../../services/api';
import type { PlanningEvent } from '../types';
import { planningKeys } from './usePlanningData';
import { addDaysToStr } from '../utils/dateUtils';
import { validateReservationUpdate } from '../utils/conflictUtils';

interface ReservationTimeUpdate {
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
}

interface UpdateResult {
  success: boolean;
  error: string | null;
}

/**
 * Hook to update a reservation and its linked interventions.
 * Validates conflicts and intervention timing before applying.
 */
export function useReservationUpdate(
  events: PlanningEvent[],
  interventions: PlanningIntervention[],
) {
  const queryClient = useQueryClient();

  const updateReservation = useCallback(
    async (reservationId: number, updates: ReservationTimeUpdate): Promise<UpdateResult> => {
      // Find current reservation to merge with updates
      const currentEvent = events.find((e) => e.id === `res-${reservationId}`);
      if (!currentEvent || !currentEvent.reservation) {
        return { success: false, error: 'Reservation introuvable' };
      }

      const res = currentEvent.reservation;
      const newCheckIn = updates.checkIn ?? res.checkIn;
      const newCheckOut = updates.checkOut ?? res.checkOut;
      const newCheckInTime = updates.checkInTime ?? res.checkInTime;
      const newCheckOutTime = updates.checkOutTime ?? res.checkOutTime;

      // Validate: no conflicts + enough time for interventions
      const validation = validateReservationUpdate(
        reservationId,
        res.propertyId,
        newCheckIn,
        newCheckOut,
        newCheckInTime,
        newCheckOutTime,
        events,
        interventions,
      );

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      try {
        if (reservationsApi.isMockMode()) {
          // 1. Update reservation in cache
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'reservations'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((r: any) => {
                if (r.id !== reservationId) return r;
                return {
                  ...r,
                  ...(updates.checkIn !== undefined && { checkIn: updates.checkIn }),
                  ...(updates.checkOut !== undefined && { checkOut: updates.checkOut }),
                  ...(updates.checkInTime !== undefined && { checkInTime: updates.checkInTime }),
                  ...(updates.checkOutTime !== undefined && { checkOutTime: updates.checkOutTime }),
                };
              });
            },
          );

          // 2. Update linked interventions
          const hasDateChange = updates.checkIn !== undefined || updates.checkOut !== undefined;
          const hasTimeChange = updates.checkOutTime !== undefined;

          if (hasDateChange || hasTimeChange) {
            queryClient.setQueriesData(
              { queryKey: [...planningKeys.all, 'interventions'] },
              (old: unknown) => {
                if (!Array.isArray(old)) return old;
                return old.map((i: any) => {
                  if (i.linkedReservationId !== reservationId) return i;

                  const updated = { ...i };

                  if (updates.checkOut !== undefined) {
                    const interventionDuration =
                      (new Date(i.endDate).getTime() - new Date(i.startDate).getTime()) /
                      (1000 * 60 * 60 * 24);
                    updated.startDate = updates.checkOut;
                    updated.endDate = addDaysToStr(updates.checkOut, interventionDuration);
                  }

                  if (updates.checkOutTime !== undefined) {
                    updated.startTime = updates.checkOutTime;
                    if (i.estimatedDurationHours && updates.checkOutTime) {
                      const [h, m] = updates.checkOutTime.split(':').map(Number);
                      const totalMinutes = h * 60 + m + i.estimatedDurationHours * 60;
                      const endH = Math.floor(totalMinutes / 60) % 24;
                      const endM = totalMinutes % 60;
                      updated.endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                    }
                  }

                  return updated;
                });
              },
            );
          }
        } else {
          await reservationsApi.update(reservationId, updates);
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }

        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors de la mise a jour' };
      }
    },
    [queryClient, events, interventions],
  );

  const changeProperty = useCallback(
    async (
      reservationId: number,
      newPropertyId: number,
      newPropertyName: string,
    ): Promise<UpdateResult> => {
      // Find current reservation
      const currentEvent = events.find((e) => e.id === `res-${reservationId}`);
      if (!currentEvent || !currentEvent.reservation) {
        return { success: false, error: 'Reservation introuvable' };
      }

      // Validate: no overlap on target property
      const targetReservations = events.filter(
        (e) =>
          e.type === 'reservation' &&
          e.propertyId === newPropertyId,
      );
      const hasOverlap = targetReservations.some(
        (e) =>
          currentEvent.startDate < e.endDate &&
          currentEvent.endDate > e.startDate,
      );
      if (hasOverlap) {
        return {
          success: false,
          error: 'Conflit : le logement cible a deja une reservation sur ces dates',
        };
      }

      try {
        if (reservationsApi.isMockMode()) {
          // 1. Update reservation in cache: propertyId + propertyName
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'reservations'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((r: any) => {
                if (r.id !== reservationId) return r;
                return {
                  ...r,
                  propertyId: newPropertyId,
                  propertyName: newPropertyName,
                };
              });
            },
          );

          // 2. Update linked interventions: propertyId + propertyName
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'interventions'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((i: any) => {
                if (i.linkedReservationId !== reservationId) return i;
                return {
                  ...i,
                  propertyId: newPropertyId,
                  propertyName: newPropertyName,
                };
              });
            },
          );
        } else {
          await reservationsApi.update(reservationId, {
            propertyId: newPropertyId,
            propertyName: newPropertyName,
          });
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }

        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors du changement de logement' };
      }
    },
    [queryClient, events],
  );

  const cancelReservation = useCallback(
    async (reservationId: number): Promise<UpdateResult> => {
      const currentEvent = events.find((e) => e.id === `res-${reservationId}`);
      if (!currentEvent || !currentEvent.reservation) {
        return { success: false, error: 'Reservation introuvable' };
      }

      try {
        if (reservationsApi.isMockMode()) {
          // Update status to 'cancelled' in cache
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'reservations'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((r: any) => {
                if (r.id !== reservationId) return r;
                return { ...r, status: 'cancelled' };
              });
            },
          );

          // Cancel linked interventions
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'interventions'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((i: any) => {
                if (i.linkedReservationId !== reservationId) return i;
                return { ...i, status: 'cancelled' };
              });
            },
          );
        } else {
          await reservationsApi.update(reservationId, { status: 'cancelled' });
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }

        return { success: true, error: null };
      } catch {
        return { success: false, error: "Erreur lors de l'annulation" };
      }
    },
    [queryClient, events],
  );

  const updateNotes = useCallback(
    async (reservationId: number, notes: string): Promise<UpdateResult> => {
      try {
        if (reservationsApi.isMockMode()) {
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'reservations'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((r: any) => {
                if (r.id !== reservationId) return r;
                return { ...r, notes };
              });
            },
          );
        } else {
          await reservationsApi.update(reservationId, { notes });
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }

        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors de la sauvegarde des notes' };
      }
    },
    [queryClient],
  );

  const duplicateReservation = useCallback(
    async (
      reservationId: number,
      newCheckIn: string,
      newCheckOut: string,
    ): Promise<UpdateResult> => {
      const currentEvent = events.find((e) => e.id === `res-${reservationId}`);
      if (!currentEvent || !currentEvent.reservation) {
        return { success: false, error: 'Reservation introuvable' };
      }

      const res = currentEvent.reservation;

      // Validate: no overlap on same property
      const overlapping = events.some(
        (e) =>
          e.type === 'reservation' &&
          e.propertyId === res.propertyId &&
          newCheckIn < e.endDate &&
          newCheckOut > e.startDate,
      );
      if (overlapping) {
        return { success: false, error: 'Conflit : le logement est deja reserve sur ces dates' };
      }

      try {
        if (reservationsApi.isMockMode()) {
          const newId = Date.now();
          const newReservation = {
            ...res,
            id: newId,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            status: 'confirmed' as const,
            notes: `Dupliquee depuis #${res.id}`,
          };
          queryClient.setQueriesData(
            { queryKey: [...planningKeys.all, 'reservations'] },
            (old: unknown) => {
              if (!Array.isArray(old)) return [newReservation];
              return [...old, newReservation];
            },
          );
        } else {
          // TODO: call real API
          queryClient.invalidateQueries({ queryKey: planningKeys.all });
        }
        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors de la duplication' };
      }
    },
    [queryClient, events],
  );

  return { updateReservation, changeProperty, cancelReservation, updateNotes, duplicateReservation };
}
