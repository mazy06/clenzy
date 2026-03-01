import { useState, useCallback, useMemo } from 'react';
import type { ReservationStatus, PlanningInterventionType } from '../../../services/api';
import type { PlanningEvent, PlanningFilters, PlanningProperty } from '../types';

const DEFAULT_FILTERS: PlanningFilters = {
  statuses: [],
  interventionTypes: [],
  propertyIds: [],
  searchQuery: '',
  showInterventions: true,
  showPrices: false,
};

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
  const [filters, setFilters] = useState<PlanningFilters>(DEFAULT_FILTERS);

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
    || filters.showPrices;

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
