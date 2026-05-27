/**
 * Helpers de formatage pour les durees en minutes.
 *
 * <p>Utilises principalement par les composants Incident / KPI ou les durees
 * peuvent aller de quelques minutes a plusieurs jours (ex: incident Stripe
 * resolu en 84h35min, moyenne KPI cumulee 10j+).</p>
 */

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR; // 1440

/**
 * Format une duree en minutes vers une string lisible.
 *
 * Echelles :
 * <ul>
 *   <li><b>&lt; 60 min</b> → "X min"</li>
 *   <li><b>&lt; 24 h</b>  → "Xh" ou "Xh Ymin"</li>
 *   <li><b>≥ 24 h</b>     → "Xj" ou "Xj Yh"</li>
 * </ul>
 *
 * <p>La precision sub-minute n'a pas de valeur metier (provoque du bruit
 * IEEE-754, ex: '4.040000000000873min'). On arrondit a la minute la plus
 * proche avant decoupage.</p>
 *
 * @example formatDuration(10)     // "10 min"
 * @example formatDuration(60)     // "1h"
 * @example formatDuration(190)    // "3h 10min"
 * @example formatDuration(1440)   // "1j"
 * @example formatDuration(5075)   // "3j 12h"
 * @example formatDuration(14944)  // "10j 9h"
 * @example formatDuration(null)   // "—"
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (!Number.isFinite(minutes)) return '—';

  const total = Math.max(0, Math.round(minutes));

  if (total < MINUTES_PER_HOUR) {
    return `${total} min`;
  }

  if (total < MINUTES_PER_DAY) {
    const hours = Math.floor(total / MINUTES_PER_HOUR);
    const remainingMin = total % MINUTES_PER_HOUR;
    if (remainingMin === 0) return `${hours}h`;
    return `${hours}h ${remainingMin}min`;
  }

  const days = Math.floor(total / MINUTES_PER_DAY);
  const remainingHours = Math.floor((total % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  if (remainingHours === 0) return `${days}j`;
  return `${days}j ${remainingHours}h`;
}

/**
 * Format une duree avec precision plus haute pour les contextes ou les
 * minutes restantes apres le decoupage jours/heures importent (rare, p. ex.
 * un export CSV ou un log technique). Pour l'UI standard, prefere
 * {@link formatDuration}.
 */
export function formatDurationFull(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (!Number.isFinite(minutes)) return '—';

  const total = Math.max(0, Math.round(minutes));

  const days = Math.floor(total / MINUTES_PER_DAY);
  const hours = Math.floor((total % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const mins = total % MINUTES_PER_HOUR;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}min`);
  return parts.join(' ');
}
