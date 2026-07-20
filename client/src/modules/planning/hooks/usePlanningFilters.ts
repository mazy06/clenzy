import { useCallback, useMemo, useState } from 'react';
import { useUserPreference } from '../../../hooks/useUserPreference';
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
>;

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
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filters: PlanningFilters = useMemo(
    () => ({ ...safePersisted, propertyIds, searchQuery }),
    [safePersisted, propertyIds, searchQuery],
  );

  const setStatusFilter = useCallback(
    (statuses: ReservationStatus[]) => setPersisted({ ...safePersisted, statuses }),
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

  const hasActiveFilters =
    filters.statuses.length > 0
    || filters.interventionTypes.length > 0
    || filters.propertyIds.length > 0
    || filters.searchQuery.length > 0
    || !filters.showInterventions
    || !filters.showPrices;

  const filteredEvents = useMemo(() => {
    let result = events;

    if (filters.statuses.length > 0) {
      const statusSet = new Set(filters.statuses);
      result = result.filter((e) =>
        e.type !== 'reservation' || statusSet.has(e.status as ReservationStatus),
      );
    }

    if (!filters.showInterventions) {
      result = result.filter((e) => e.type === 'reservation');
    } else if (filters.interventionTypes.length > 0) {
      const interventionTypeSet = new Set(filters.interventionTypes);
      result = result.filter((e) =>
        e.type === 'reservation'
        || interventionTypeSet.has(e.type as PlanningInterventionType),
      );
    }

    if (filters.propertyIds.length > 0) {
      const propertyIdSet = new Set(filters.propertyIds);
      result = result.filter((e) => propertyIdSet.has(e.propertyId));
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.label.toLowerCase().includes(q)
        || (e.sublabel && e.sublabel.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [events, filters]);

  const filteredProperties = useMemo(() => {
    if (filters.propertyIds.length === 0) return properties;
    const propertyIdSet = new Set(filters.propertyIds);
    return properties.filter((p) => propertyIdSet.has(p.id));
  }, [properties, filters.propertyIds]);

  return {
    filters,
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
