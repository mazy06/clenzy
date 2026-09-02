import {
  RESERVATION_STATUS_COLORS,
  INTERVENTION_TYPE_COLORS,
  INTERVENTION_STATUS_COLORS,
} from '../../../services/api/reservationsApi';
import type { ReservationStatus, PlanningInterventionType, PlanningInterventionStatus } from '../../../services/api';
import type { PlanningEvent, PlanningEventType } from '../types';
import { RESERVATION_STATUS_BAR_COLORS, RESERVATION_STATUS_BAR_INK, INTERVENTION_TYPE_TOKEN_COLORS } from '../constants';

export function getReservationColor(status: ReservationStatus): string {
  return RESERVATION_STATUS_COLORS[status] || '#9e9e9e';
}

export function getInterventionColor(type: PlanningInterventionType): string {
  return INTERVENTION_TYPE_COLORS[type] || '#9e9e9e';
}

export function getInterventionStatusColor(status: PlanningInterventionStatus): string {
  return INTERVENTION_STATUS_COLORS[status] || '#9e9e9e';
}

export function getEventTypeColor(type: PlanningEventType): string {
  switch (type) {
    case 'reservation': return '#6B8A9A';
    case 'cleaning': return INTERVENTION_TYPE_COLORS.cleaning;
    case 'maintenance': return INTERVENTION_TYPE_COLORS.maintenance;
    case 'blocked': return '#616161';
    default: return '#9e9e9e';
  }
}

/**
 * Couleur d'affichage Signature d'un évènement (token CSS var(--…)).
 * Réservation → couleur = STATUT ; intervention/blocage → couleur = TYPE.
 * Ne touche pas event.color (hex de la couche data, encore utilisé par
 * les panneaux). À combiner avec color-mix() pour les ombres/voiles.
 */
export function getEventDisplayColor(event: PlanningEvent): string {
  if (event.type === 'reservation') {
    return RESERVATION_STATUS_BAR_COLORS[event.status] ?? 'var(--accent)';
  }
  return INTERVENTION_TYPE_TOKEN_COLORS[event.type] ?? 'var(--info)';
}

/**
 * Encre a poser SUR la brique (nom du voyageur, nombre de nuits, initiales).
 *
 * <p>La palette « Terre cuite » va du beige au brun fonce : le blanc, qui
 * etait ici en dur, disparait sur les valeurs claires. L'encre suit donc le
 * statut.</p>
 *
 * <p>Une brique d'intervention ou de blocage garde le blanc : ces fonds-la
 * restent soutenus.</p>
 */
export function getEventInkColor(event: PlanningEvent): string {
  if (event.type === 'reservation') {
    return RESERVATION_STATUS_BAR_INK[event.status] ?? '#fff';
  }
  return '#fff';
}

/**
 * Les deux statuts dont la brique est PALE, donc porteuse d'une encre foncee.
 *
 * <p>Ce qui se pose par-dessus la brique — le liseré de l'avatar, le verre de
 * la pastille de prix — presumait un fond soutenu et se dessinait en blanc
 * translucide. Sur un beige, ces voiles blancs disparaissent. Le prédicat leur
 * dit quel régime appliquer.</p>
 */
const PALE_BAR_STATUSES: ReadonlySet<string> = new Set(['pending', 'checked_out']);

/** La brique de cet évènement porte-t-elle une encre foncée ? */
export function hasDarkInk(event: PlanningEvent): boolean {
  return event.type === 'reservation' && PALE_BAR_STATUSES.has(event.status);
}

/**
 * Lighten a hex color by a percentage (for backgrounds).
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * percent));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Convert hex to rgba.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
