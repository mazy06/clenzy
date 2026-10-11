import type { Reservation } from '../../../services/api';
import type { PlanningEvent } from '../types';
import { resolveAttachedReservationId } from './interventionAttachment';

export interface BaitlyLoadedReservationWindow {
  propertyIds: readonly number[];
  from: string;
  to: string;
}

/** Publier les prestations avec leurs séjours, jamais avant les fiches détaillées. */
export function selectBaitlyHydratedEvents(
  events: PlanningEvent[],
  filteredEvents: PlanningEvent[],
  reservations: Reservation[],
  details: Reservation[],
  loadedWindows: readonly BaitlyLoadedReservationWindow[],
): PlanningEvent[] {
  const visibleIds = new Set(filteredEvents.map((event) => event.id));
  const hydratedIds = new Set(details.map((reservation) => reservation.id));
  const reservationsByProperty = new Map<number, Reservation[]>();
  for (const reservation of reservations) {
    const group = reservationsByProperty.get(reservation.propertyId);
    if (group) group.push(reservation);
    else reservationsByProperty.set(reservation.propertyId, [reservation]);
  }
  const windows = loadedWindows.map((window) => ({ ...window, ids: new Set(window.propertyIds) }));
  return events.filter((event) => {
    if (!visibleIds.has(event.id)) return false;
    if (event.type === 'reservation') return !!event.reservation && hydratedIds.has(event.reservation.id);
    if (event.type !== 'cleaning' && event.type !== 'maintenance') return true;

    // La même règle que PlanningRow : lien explicite ou rattachement par date.
    // Une prestation ne doit pas devenir autonome pendant que sa brique hôte charge.
    const hostId = resolveAttachedReservationId({
      propertyId: event.propertyId,
      startDate: event.startDate,
      linkedReservationId: event.intervention?.linkedReservationId ?? event.serviceRequest?.reservationId,
    }, reservationsByProperty.get(event.propertyId) ?? []);
    if (hostId != null) return hydratedIds.has(hostId);

    // Une réponse vide est aussi un résultat : un logement sans séjour peut
    // afficher ses prestations libres. Une période voisine en attente ne l'est pas.
    return windows.some((window) => window.ids.has(event.propertyId)
      && window.from <= event.endDate && window.to >= event.startDate);
  });
}
