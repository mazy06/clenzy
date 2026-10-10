import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useUserPreference } from '../../../hooks/useUserPreference';
import { PLANNING_CHANNEL_KEYS, PLANNING_STATUS_KEYS, type PlanningChannelKey } from '../constants';
import { countBaitlyPlanningFilters } from '../utils/baitlyFilters';
import type { ReservationStatus, PlanningInterventionType } from '../../../services/api';
import type { PlanningEvent, PlanningFilters, PlanningProperty } from '../types';

const DEFAULT_FILTERS: PlanningFilters = {
  statuses: [],
  interventionTypes: [],
  propertyIds: [],
  searchQuery: '',
  showInterventions: true,
  showPrices: true,
};

// ─── Backend-persisted prefs (cf. UserUiPreferencesProvider) ────────────────
//
// La cle dot-notation est stockee dans `user_ui_preferences.pref_key`
// (migration 0135). Seuls les champs durables (filtres / toggles) sont
// persistes : searchQuery et propertyIds restent ephemeres par session
// (memes semantiques qu'avant la migration localStorage → backend).

const PREF_KEY = 'planning.filters';

type PersistedFilters = Pick<
  PlanningFilters,
  'statuses' | 'interventionTypes' | 'showInterventions' | 'showPrices'
> & { hiddenStatuses?: ReservationStatus[]; hiddenChannels?: PlanningChannelKey[] };

const DEFAULT_PERSISTED: PersistedFilters = {
  statuses: DEFAULT_FILTERS.statuses,
  interventionTypes: DEFAULT_FILTERS.interventionTypes,
  showInterventions: DEFAULT_FILTERS.showInterventions,
  showPrices: DEFAULT_FILTERS.showPrices,
};

/** Validation light : ne garde que les champs connus, types corrects. */
function sanitize(raw: unknown): PersistedFilters {
  if (!raw || typeof raw !== 'object') return DEFAULT_PERSISTED;
  const r = raw as Record<string, unknown>;
  return {
    hiddenChannels: Array.isArray(r.hiddenChannels) ? r.hiddenChannels.filter((channel): channel is PlanningChannelKey => PLANNING_CHANNEL_KEYS.includes(channel as PlanningChannelKey)) : [],
    hiddenStatuses: Array.isArray(r.hiddenStatuses) ? r.hiddenStatuses.filter((s): s is ReservationStatus => PLANNING_STATUS_KEYS.includes(s as ReservationStatus)) : undefined,
    statuses: Array.isArray(r.statuses) ? (r.statuses as ReservationStatus[]) : DEFAULT_PERSISTED.statuses,
    interventionTypes: Array.isArray(r.interventionTypes)
      ? (r.interventionTypes as PlanningInterventionType[])
      : DEFAULT_PERSISTED.interventionTypes,
    showInterventions:
      typeof r.showInterventions === 'boolean' ? r.showInterventions : DEFAULT_PERSISTED.showInterventions,
    showPrices: typeof r.showPrices === 'boolean' ? r.showPrices : DEFAULT_PERSISTED.showPrices,
  };
}

export interface UsePlanningFiltersReturn {
  filters: PlanningFilters;
  activeChannels: ReadonlySet<PlanningChannelKey>;
  activeStatuses: ReadonlySet<ReservationStatus>;
  toggleChannel: (channel: PlanningChannelKey) => void;
  toggleStatus: (status: ReservationStatus) => void;
  presentChannels: ReadonlySet<PlanningChannelKey>;
  filterCount: number;
  occupancyEvents: PlanningEvent[];
  setStatusFilter: (statuses: ReservationStatus[]) => void;
  setInterventionTypeFilter: (types: PlanningInterventionType[]) => void;
  setPropertyFilter: (propertyIds: number[]) => void;
  setSearchQuery: (query: string) => void;
  setShowInterventions: (show: boolean) => void;
  setShowPrices: (show: boolean) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  filteredEvents: PlanningEvent[];
  filteredProperties: PlanningProperty[];
}

export function usePlanningFilters(
  events: PlanningEvent[],
  properties: PlanningProperty[],
): UsePlanningFiltersReturn {
  // Persistance backend des champs durables
  const [persisted, setPersisted] = useUserPreference<PersistedFilters>(PREF_KEY, DEFAULT_PERSISTED);
  const safePersisted = useMemo(() => sanitize(persisted), [persisted]);

  // Champs ephemeres (session-scoped, pas persistes — meme comportement qu'avant)
  const [propertyIds, setPropertyIds] = useState<number[]>([]);
  const activeChannels = useMemo(() => new Set(PLANNING_CHANNEL_KEYS.filter(
    (channel) => !safePersisted.hiddenChannels?.includes(channel),
  )), [safePersisted.hiddenChannels]);
  const activeStatuses = useMemo(() => new Set(
    safePersisted.hiddenStatuses
      ? PLANNING_STATUS_KEYS.filter((status) => !safePersisted.hiddenStatuses!.includes(status))
      : safePersisted.statuses.length ? safePersisted.statuses : PLANNING_STATUS_KEYS,
  ), [safePersisted]);
  const toggleChannel = useCallback((channel: PlanningChannelKey) => {
    const next = new Set(activeChannels);
    if (next.has(channel)) next.delete(channel); else next.add(channel);
    setPersisted({ ...safePersisted, hiddenChannels: PLANNING_CHANNEL_KEYS.filter((key) => !next.has(key)) });
  }, [activeChannels, safePersisted, setPersisted]);
  const toggleStatus = useCallback((status: ReservationStatus) => {
    const next = new Set(activeStatuses);
    if (next.has(status)) next.delete(status); else next.add(status);
    setPersisted({ ...safePersisted, statuses: [], hiddenStatuses: PLANNING_STATUS_KEYS.filter((key) => !next.has(key)) });
  }, [activeStatuses, safePersisted, setPersisted]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Version differee pour le filtrage : le champ controle reste reactif a la
  // frappe, mais le recalcul filteredEvents → re-layout complet de la grille
  // passe en priorite basse (interruptible) au lieu de bloquer chaque keystroke.
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filters: PlanningFilters = useMemo(
    () => ({ ...safePersisted, propertyIds, searchQuery }),
    [safePersisted, propertyIds, searchQuery],
  );

  const setStatusFilter = useCallback(
    (statuses: ReservationStatus[]) => setPersisted({ ...safePersisted, statuses, hiddenStatuses: undefined }),
    [safePersisted, setPersisted],
  );

  const setInterventionTypeFilter = useCallback(
    (types: PlanningInterventionType[]) => setPersisted({ ...safePersisted, interventionTypes: types }),
    [safePersisted, setPersisted],
  );

  const setPropertyFilter = useCallback((ids: number[]) => setPropertyIds(ids), []);

  const setSearchQueryCb = useCallback((query: string) => setSearchQuery(query), []);

  const setShowInterventions = useCallback(
    (show: boolean) => setPersisted({ ...safePersisted, showInterventions: show }),
    [safePersisted, setPersisted],
  );

  const setShowPrices = useCallback(
    (show: boolean) => setPersisted({ ...safePersisted, showPrices: show }),
    [safePersisted, setPersisted],
  );

  const clearFilters = useCallback(() => {
    setPersisted(DEFAULT_PERSISTED);
    setPropertyIds([]);
    setSearchQuery('');
  }, [setPersisted]);

  const occupancyEvents = useMemo(() => {
    const ids = new Set(propertyIds);
    return ids.size ? events.filter((event) => ids.has(event.propertyId)) : events;
  }, [events, propertyIds]);
  const presentChannels = useMemo(() => new Set(occupancyEvents.flatMap((event) => {
    const channel = PLANNING_CHANNEL_KEYS.find((key) => key === event.reservation?.source);
    return channel ? [channel] : [];
  })), [occupancyEvents]);
  const filterCount = countBaitlyPlanningFilters(filters, activeChannels, activeStatuses, presentChannels);
  const hasActiveFilters = filterCount > 0;

  // Depend des champs individuels (et de la recherche DIFFEREE) : dependre de
  // l'objet `filters` invalidait le memo a chaque frappe, avant meme le defer.
  const filteredEvents = useMemo(() => {
    let result = events;

    result = result.filter((event) => {
      if (event.type !== 'reservation') return true;
      const channel = PLANNING_CHANNEL_KEYS.find((key) => key === event.reservation?.source);
      return activeStatuses.has(event.status as ReservationStatus) && (!channel || activeChannels.has(channel));
    });

    if (!safePersisted.showInterventions) {
      result = result.filter((e) => e.type === 'reservation' || e.type === 'blocked');
    } else if (safePersisted.interventionTypes.length > 0) {
      const interventionTypeSet = new Set(safePersisted.interventionTypes);
      result = result.filter((e) =>
        e.type === 'reservation' || e.type === 'blocked'
        || interventionTypeSet.has(e.type as PlanningInterventionType),
      );
    }

    if (propertyIds.length > 0) {
      const propertyIdSet = new Set(propertyIds);
      result = result.filter((e) => propertyIdSet.has(e.propertyId));
    }

    if (deferredSearchQuery) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter((e) =>
        e.label.toLowerCase().includes(q)
        || (e.sublabel && e.sublabel.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [events, safePersisted, propertyIds, deferredSearchQuery, activeStatuses, activeChannels]);

  const filteredProperties = useMemo(() => {
    if (filters.propertyIds.length === 0) return properties;
    const propertyIdSet = new Set(filters.propertyIds);
    return properties.filter((p) => propertyIdSet.has(p.id));
  }, [properties, filters.propertyIds]);

  return {
    filters, activeChannels, activeStatuses, toggleChannel, toggleStatus, presentChannels, filterCount, occupancyEvents,
    setStatusFilter,
    setInterventionTypeFilter,
    setPropertyFilter,
    setSearchQuery: setSearchQueryCb,
    setShowInterventions,
    setShowPrices,
    clearFilters,
    hasActiveFilters,
    filteredEvents,
    filteredProperties,
  };
}
