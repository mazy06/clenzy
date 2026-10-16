import type { ReservationStatus } from '../../../services/api';
import { PLANNING_CHANNEL_KEYS, PLANNING_STATUS_KEYS, type PlanningChannelKey } from '../constants';
import type { PlanningFilters } from '../types';

/** Compte les restrictions de données, pas les préférences d'affichage. */
export function countBaitlyPlanningFilters(
  filters: PlanningFilters,
  activeChannels: ReadonlySet<PlanningChannelKey>,
  activeStatuses: ReadonlySet<ReservationStatus>,
  presentChannels?: ReadonlySet<PlanningChannelKey>,
): number {
  const hiddenChannels = PLANNING_CHANNEL_KEYS.filter((channel) =>
    (!presentChannels || presentChannels.has(channel)) && !activeChannels.has(channel)).length;
  return hiddenChannels + PLANNING_STATUS_KEYS.filter((status) => !activeStatuses.has(status)).length
    + filters.propertyIds.length + filters.interventionTypes.length + Number(!!filters.searchQuery.trim());
}
