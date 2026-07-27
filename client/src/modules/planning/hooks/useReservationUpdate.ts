import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../../services/api/reservationsApi';
import type { PlanningIntervention } from '../../../services/api';
import type { PlanningEvent } from '../types';
import { planningKeys } from './usePlanningData';
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
        await reservationsApi.update(reservationId, updates);
        queryClient.invalidateQueries({ queryKey: planningKeys.all });

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
        await reservationsApi.update(reservationId, {
          propertyId: newPropertyId,
          propertyName: newPropertyName,
        });
        queryClient.invalidateQueries({ queryKey: planningKeys.all });

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
        await reservationsApi.cancel(reservationId);
        queryClient.invalidateQueries({ queryKey: planningKeys.all });

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
        await reservationsApi.update(reservationId, { notes });
        queryClient.invalidateQueries({ queryKey: planningKeys.all });

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
        // TODO: appeler la vraie API de duplication
        queryClient.invalidateQueries({ queryKey: planningKeys.all });
        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors de la duplication' };
      }
    },
    [queryClient, events],
  );

  const hideReservation = useCallback(
    async (reservationId: number): Promise<UpdateResult> => {
      try {
        await reservationsApi.hideFromPlanning(reservationId);
        queryClient.invalidateQueries({ queryKey: planningKeys.all });
        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors du masquage' };
      }
    },
    [queryClient],
  );

  const updateGuestInfo = useCallback(
    async (
      reservationId: number,
      updates: { guestName?: string; guestEmail?: string; guestPhone?: string },
    ): Promise<UpdateResult> => {
      try {
        const serverRes = await reservationsApi.update(reservationId, updates);
        // Update cache with server response (authoritative) merged with local updates
        queryClient.setQueriesData(
          { queryKey: [...planningKeys.all, 'reservations'] },
          (old: unknown) => {
            if (!Array.isArray(old)) return old;
            return old.map((r: any) => {
              if (r.id !== reservationId) return r;
              return {
                ...r,
                // Use server response for all fields (it includes the persisted guest email)
                ...(serverRes.guestName !== undefined && { guestName: serverRes.guestName }),
                ...(serverRes.guestEmail !== undefined && { guestEmail: serverRes.guestEmail }),
                ...(serverRes.guestPhone !== undefined && { guestPhone: serverRes.guestPhone }),
                // Also apply local updates as fallback in case server doesn't return them
                ...(updates.guestName !== undefined && { guestName: updates.guestName }),
                ...(updates.guestEmail !== undefined && { guestEmail: updates.guestEmail }),
                ...(updates.guestPhone !== undefined && { guestPhone: updates.guestPhone }),
              };
            });
          },
        );

        return { success: true, error: null };
      } catch {
        return { success: false, error: 'Erreur lors de la mise a jour des infos client' };
      }
    },
    [queryClient],
  );

  return { updateReservation, changeProperty, cancelReservation, updateNotes, duplicateReservation, hideReservation, updateGuestInfo };
}
