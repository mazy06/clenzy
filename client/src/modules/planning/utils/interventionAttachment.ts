// ─── Rattachement intervention → réservation ─────────────────────────────────
//
// Une intervention est RATTACHÉE à une réservation si :
//   1. `linkedReservationId` correspond à une réservation chargée (lien
//      explicite backend — FK reservation.intervention_id), OU
//   2. HEURISTIQUE : même propriété ET sa date planifiée tombe dans
//      [checkIn, checkOut] INCLUSIF du jour de checkout. Le ménage « après
//      départ » planifié le jour du checkout (même après 11h) appartient à la
//      réservation qui se termine ce jour-là. Si plusieurs candidates : celle
//      dont le checkout == jour de l'intervention, sinon celle qui couvre la
//      date (check-in le plus récent — le séjour en cours).
//
// Le lien explicite est souvent ABSENT en données réelles : le backend ne le
// renseigne que si la réservation référence l'intervention via son FK
// (cf. InterventionPlanningService.getPlanningInterventions) — un ménage
// post-départ créé indépendamment arrive avec linkedReservationId = null.

export interface AttachableIntervention {
  propertyId: number;
  /** Jour planifié de l'intervention (YYYY-MM-DD). */
  startDate: string;
  linkedReservationId?: number;
}

export interface AttachmentCandidate {
  id: number;
  propertyId: number;
  checkIn: string;   // YYYY-MM-DD
  checkOut: string;  // YYYY-MM-DD
  status?: string;
}

/**
 * Résout la réservation de rattachement d'une intervention parmi les
 * réservations CHARGÉES (avant filtres/légende/plage visible).
 * Retourne `null` si l'intervention est véritablement orpheline.
 */
export function resolveAttachedReservationId(
  intervention: AttachableIntervention,
  reservations: readonly AttachmentCandidate[],
): number | null {
  // 1. Lien explicite — prioritaire s'il pointe vers une réservation connue.
  if (intervention.linkedReservationId != null) {
    const linked = reservations.find((r) => r.id === intervention.linkedReservationId);
    if (linked) return linked.id;
  }

  // 2. Heuristique par propriété + date (comparaison lexicale ISO).
  const date = intervention.startDate;
  if (!date) return null;
  const candidates = reservations.filter(
    (r) =>
      r.propertyId === intervention.propertyId &&
      r.status !== 'cancelled' &&
      r.checkIn <= date &&
      date <= r.checkOut,
  );
  if (candidates.length === 0) return null;

  // Ménage post-départ : la réservation qui SE TERMINE ce jour-là gagne.
  const checkoutMatch = candidates.find((r) => r.checkOut === date);
  if (checkoutMatch) return checkoutMatch.id;

  // Sinon : la réservation qui couvre la date (check-in le plus récent).
  return candidates.reduce((best, r) => (r.checkIn > best.checkIn ? r : best)).id;
}
