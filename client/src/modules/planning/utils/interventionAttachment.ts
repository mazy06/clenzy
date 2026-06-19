// ─── Rattachement intervention → réservation ─────────────────────────────────
//
// Une intervention est RATTACHÉE à une réservation si :
//   1. `linkedReservationId` correspond à une réservation chargée ET ACTIVE
//      (lien explicite backend — FK reservation.intervention_id). Un lien vers
//      une réservation ANNULÉE/disparue (ex. réservation dupliquée puis annulée
//      lors d'un ré-import iCal) est IGNORÉ → on retombe sur l'heuristique pour
//      re-résoudre vers la réservation active équivalente, OU
//   2. HEURISTIQUE : même propriété ET sa date planifiée tombe dans
//      [checkIn, checkOut] INCLUSIF du jour de checkout. Le ménage « après
//      départ » planifié le jour du checkout (même après 11h) appartient à la
//      réservation qui se termine ce jour-là. Si plusieurs candidates : celle
//      dont le checkout == jour de l'intervention, sinon celle qui couvre la
//      date (check-in le plus récent — le séjour en cours), OU
//   3. FENÊTRE DE VACANCE : ménage/maintenance planifié à checkout+N (N
//      variable). La date tombe APRÈS le checkout d'une réservation et AVANT
//      le check-in suivant → rattachée à la réservation la plus récemment
//      terminée avant cette date. Si une réservation suivante a déjà commencé
//      dans ]checkout, date], pas de rattachement via ce cas (le cas 2 « dans
//      le séjour » couvre déjà la suivante), OU
//   4. MÉNAGE ANTICIPÉ (pré-arrivée) : planifié peu AVANT un check-in à venir
//      (≤ ANTICIPATED_CLEANING_WINDOW_DAYS jours), sans séjour actif ni séjour
//      sortant pour réclamer la date → rattaché à la réservation à venir la plus
//      proche. Au-delà de la fenêtre, l'intervention reste autonome.
//
// Une intervention sans aucune candidate (date hors fenêtre de tout séjour,
// propriété sans réservation chargée) reste ORPHELINE → pastille isolée.
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

// Fenêtre (en jours) d'anticipation d'un ménage pré-arrivée : un ménage planifié
// jusqu'à N jours AVANT un check-in (sans séjour actif/sortant à réclamer la date)
// est rattaché à la réservation à venir. Au-delà, il est considéré autonome.
const ANTICIPATED_CLEANING_WINDOW_DAYS = 3;

/** Nombre de jours de `fromIso` à `toIso` (dates YYYY-MM-DD). +Infini si invalide. */
function isoDayDiff(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  return Math.round((to - from) / 86_400_000);
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
  const sameProperty = reservations.filter(
    (r) => r.propertyId === intervention.propertyId && r.status !== 'cancelled',
  );

  // 1. Lien explicite — prioritaire s'il pointe vers une réservation chargée ET
  //    ACTIVE. Un lien vers une réservation annulée/supprimée (typiquement une
  //    réservation dupliquée puis annulée lors d'un ré-import iCal) est IGNORÉ :
  //    on re-résout vers la réservation active équivalente via l'heuristique,
  //    plutôt que de laisser l'icône dériver hors de toute brique.
  if (intervention.linkedReservationId != null) {
    const linked = sameProperty.find((r) => r.id === intervention.linkedReservationId);
    if (linked) return linked.id;
  }

  // 2. Heuristique par propriété + date (comparaison lexicale ISO).
  const date = intervention.startDate;
  if (!date) return null;
  const candidates = sameProperty.filter((r) => r.checkIn <= date && date <= r.checkOut);
  if (candidates.length > 0) {
    // Ménage post-départ : la réservation qui SE TERMINE ce jour-là gagne.
    const checkoutMatch = candidates.find((r) => r.checkOut === date);
    if (checkoutMatch) return checkoutMatch.id;

    // Sinon : la réservation qui couvre la date (check-in le plus récent).
    return candidates.reduce((best, r) => (r.checkIn > best.checkIn ? r : best)).id;
  }

  // 3. Fenêtre de vacance post-checkout (ménage à checkout+N) : la réservation
  //    la plus récemment terminée AVANT la date, sauf si une autre réservation
  //    a déjà commencé dans ]checkout, date].
  const ended = sameProperty.filter((r) => r.checkOut < date);
  if (ended.length > 0) {
    const lastEnded = ended.reduce((best, r) => (r.checkOut > best.checkOut ? r : best));
    const nextStayStarted = sameProperty.some(
      (r) => r.checkIn > lastEnded.checkOut && r.checkIn <= date,
    );
    if (!nextStayStarted) return lastEnded.id;
  }

  // 4. Ménage ANTICIPÉ (pré-arrivée) : planifié peu avant un check-in à venir,
  //    sans séjour actif ni séjour récemment terminé pour réclamer la date.
  //    Rattaché à la réservation à venir la plus proche, dans une fenêtre bornée
  //    (au-delà, l'intervention reste autonome — cf. ménages/maintenances libres).
  const upcoming = sameProperty.filter((r) => r.checkIn > date);
  if (upcoming.length > 0) {
    const next = upcoming.reduce((best, r) => (r.checkIn < best.checkIn ? r : best));
    if (isoDayDiff(date, next.checkIn) <= ANTICIPATED_CLEANING_WINDOW_DAYS) {
      return next.id;
    }
  }

  return null;
}
