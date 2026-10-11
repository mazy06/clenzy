/**
 * État affiché par l'anneau d'une épingle — on lit le planning sur la carte.
 *
 * Logements : `turnover` (départ + arrivée le même jour : ménage urgent),
 * `arrival`, `departure`, `occupied`, `alert` (maintenance), `inactive`.
 * Missions : `late`, `today`, `done`, `closed`.
 * Absent : lieu calme, épingle sans anneau.
 */
export type MarkerState =
  | 'alert'
  | 'late'
  | 'turnover'
  | 'arrival'
  | 'departure'
  | 'today'
  | 'occupied'
  | 'done'
  | 'closed'
  | 'inactive';

/** Ordre de la légende, et rang d'urgence (bulles de regroupement). */
export const MARKER_STATE_ORDER: MarkerState[] = [
  'alert', 'late', 'turnover', 'arrival', 'departure', 'today', 'occupied', 'done', 'closed', 'inactive',
];

export function urgencyOf(state: MarkerState | undefined): number {
  switch (state) {
    case 'alert':
    case 'late':
      return 3;
    case 'turnover':
      return 2;
    case 'arrival':
    case 'departure':
    case 'today':
      return 1;
    default:
      return 0;
  }
}

export const MARKER_STATE_DEFAULT_LABELS: Record<MarkerState, string> = {
  alert: 'Alerte',
  late: 'En retard',
  turnover: 'Rotation (ménage urgent)',
  arrival: 'Arrivée',
  departure: 'Départ',
  today: "Aujourd'hui",
  occupied: 'Occupé',
  done: 'Terminée',
  closed: 'Annulée',
  inactive: 'Inactif',
};
