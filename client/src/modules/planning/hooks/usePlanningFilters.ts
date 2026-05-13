import { useState, useCallback, useEffect, useMemo } from 'react';
import { getParsedAccessToken } from '../../../keycloak';
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

// ─── localStorage persistence (per-user) ────────────────────────────────────

const STORAGE_KEY_PREFIX = 'clenzy.planning.filters';

/** Champs de PlanningFilters qui sont persistés. searchQuery / propertyIds
 *  restent éphémères (typés à chaque session). */
type PersistedFilters = Pick<
  PlanningFilters,
  'statuses' | 'interventionTypes' | 'showInterventions' | 'showPrices'
>;

function storageKey(): string {
  const sub = getParsedAccessToken()?.sub ?? 'anon';
  return `${STORAGE_KEY_PREFIX}.${sub}`;
}

function loadPersistedFilters(): Partial<PersistedFilters> {
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    // Validation light — only known fields, correct types
    const out: Partial<PersistedFilters> = {};
    if (Array.isArray(parsed.statuses)) out.statuses = parsed.statuses as ReservationStatus[];
    if (Array.isArray(parsed.interventionTypes)) out.interventionTypes = parsed.interventionTypes as PlanningInterventionType[];
    if (typeof parsed.showInterventions === 'boolean') out.showInterventions = parsed.showInterventions;
    if (typeof parsed.showPrices === 'boolean') out.showPrices = parsed.showPrices;
    return out;
  } catch {
    return {};
  }
}

function savePersistedFilters(filters: PlanningFilters): void {
  try {
    const toSave: PersistedFilters = {
      statuses: filters.statuses,
      interventionTypes: filters.interventionTypes,
      showInterventions: filters.showInterventions,
      showPrices: filters.showPrices,
    };
    window.localStorage.setItem(storageKey(), JSON.stringify(toSave));
  } catch {
    // ignore (quota, private mode)
  }
}

function buildInitialFilters(): PlanningFilters {
  return { ...DEFAULT_FILTERS, ...loadPersistedFilters() };
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
  const [filters, setFilters] = useState<PlanningFilters>(() => buildInitialFilters());

  // Persiste a chaque changement (champs persistés uniquement — voir PersistedFilters).
  useEffect(() => {
    savePersistedFilters(filters);
  }, [filters.statuses, filters.interventionTypes, filters.showInterventions, filters.showPrices]);

  const setStatusFilter = useCallback((statuses: ReservationStatus[]) => {
    setFilters((prev) => ({ ...prev, statuses }));
  }, []);

  const setInterventionTypeFilter = useCallback((types: PlanningInterventionType[]) => {
    setFilters((prev) => ({ ...prev, interventionTypes: types }));
  }, []);

  const setPropertyFilter = useCallback((propertyIds: number[]) => {
    setFilters((prev) => ({ ...prev, propertyIds }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setShowInterventions = useCallback((show: boolean) => {
    setFilters((prev) => ({ ...prev, showInterventions: show }));
  }, []);

  const setShowPrices = useCallback((show: boolean) => {
    setFilters((prev) => ({ ...prev, showPrices: show }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const hasActiveFilters = filters.statuses.length > 0
    || filters.interventionTypes.length > 0
    || filters.propertyIds.length > 0
    || filters.searchQuery.length > 0
    || !filters.showInterventions
    || !filters.showPrices;

  const filteredEvents = useMemo(() => {
    let result = events;

    // Filter by status
    if (filters.statuses.length > 0) {
      result = result.filter((e) =>
        e.type !== 'reservation' || filters.statuses.includes(e.status as ReservationStatus),
      );
    }

    // Filter by intervention type
    if (!filters.showInterventions) {
      result = result.filter((e) => e.type === 'reservation');
    } else if (filters.interventionTypes.length > 0) {
      result = result.filter((e) =>
        e.type === 'reservation' || filters.interventionTypes.includes(e.type as PlanningInterventionType),
      );
    }

    // Filter by property
    if (filters.propertyIds.length > 0) {
      result = result.filter((e) => filters.propertyIds.includes(e.propertyId));
    }

    // Filter by search query
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
    return properties.filter((p) => filters.propertyIds.includes(p.id));
  }, [properties, filters.propertyIds]);

  return {
    filters,
    setStatusFilter,
    setInterventionTypeFilter,
    setPropertyFilter,
    setSearchQuery,
    setShowInterventions,
    setShowPrices,
    clearFilters,
    hasActiveFilters,
    filteredEvents,
    filteredProperties,
  };
}
