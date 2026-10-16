import type { PlanningData } from '../../../services/api/planningDataApi';
import { addDaysToStr, daysBetween, toDate } from './dateUtils';

/** Met à jour une tranche du cache agrégé Baitly, prestations liées comprises. */
export function updateBaitlyPlanningStay(
  data: PlanningData | undefined,
  reservationId: number,
  dates: { checkIn?: string; checkOut?: string },
  movement: { type: 'move' | 'resize'; daysDelta: number },
): PlanningData | undefined {
  if (!data) return data;
  return {
    ...data,
    reservations: data.reservations.map((reservation) =>
      reservation.id === reservationId ? { ...reservation, ...dates } : reservation),
    interventions: data.interventions.map((intervention) => {
      if (intervention.linkedReservationId !== reservationId) return intervention;
      if (movement.type === 'move') {
        return {
          ...intervention,
          startDate: addDaysToStr(intervention.startDate, movement.daysDelta),
          endDate: addDaysToStr(intervention.endDate, movement.daysDelta),
        };
      }
      if (!dates.checkOut) return intervention;
      const duration = daysBetween(toDate(intervention.startDate), toDate(intervention.endDate));
      return {
        ...intervention,
        startDate: dates.checkOut,
        endDate: addDaysToStr(dates.checkOut, duration),
      };
    }),
  };
}
