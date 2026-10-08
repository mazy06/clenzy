import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarPricingApi } from '../services/api/calendarPricingApi';
import type {
  CalendarPricingDay,
  RatePlan,
  CreateRatePlanData,
  BulkRateOverrideData,
} from '../services/api/calendarPricingApi';
import { propertiesApi } from '../services/api/propertiesApi';
import type { Property } from '../services/api/propertiesApi';
import { extractApiList } from '../types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const dynamicPricingKeys = {
  all: ['dynamic-pricing'] as const,
  calendarPricing: (propertyId: number, from: string, to: string) =>
    [...dynamicPricingKeys.all, 'calendar-pricing', propertyId, from, to] as const,
  ratePlans: (propertyId: number) =>
    [...dynamicPricingKeys.all, 'rate-plans', propertyId] as const,
  overrides: (propertyId: number, from: string, to: string) =>
    [...dynamicPricingKeys.all, 'overrides', propertyId, from, to] as const,
  properties: () => [...dynamicPricingKeys.all, 'properties'] as const,
  allCalendarPricing: () => [...dynamicPricingKeys.all, 'calendar-pricing'] as const,
};

// ─── Date Helpers ───────────────────────────────────────────────────────────

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthRange(date: Date): { from: string; to: string } {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: toISODate(first), to: toISODate(last) };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDynamicPricing() {
  const queryClient = useQueryClient();

  // ── State ──
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyParam = Number(searchParams.get('property'));
  const selectedPropertyId = Number.isSafeInteger(propertyParam) && propertyParam > 0 ? propertyParam : null;
  const setSelectedPropertyId = useCallback((id: number | null) => setSearchParams((previous) => {
    const next = new URLSearchParams(previous);
    if (id) next.set('property', String(id)); else next.delete('property');
    return next;
  }, { replace: true }), [setSearchParams]);
  const monthParam = searchParams.get('month');
  const currentMonth = useMemo(() => {
    if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
      const [year, month] = monthParam.split('-').map(Number);
      return new Date(year, month - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [monthParam]);

  // ── Derived dates ──
  const { from, to } = useMemo(() => getMonthRange(currentMonth), [currentMonth]);

  // ── Month navigation ──
  const changeMonth = useCallback((offset: number) => {
    const month = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('month', toISODate(month).slice(0, 7));
      return next;
    }, { replace: true });
  }, [currentMonth, setSearchParams]);
  const goToPrevMonth = useCallback(() => changeMonth(-1), [changeMonth]);
  const goToNextMonth = useCallback(() => changeMonth(1), [changeMonth]);

  // ── Properties query ──
  // propertiesApi.getAll() peut renvoyer Page<Property> ou Property[] selon la route
  const propertiesQuery = useQuery<Property[]>({
    queryKey: dynamicPricingKeys.properties(),
    queryFn: async () => {
      const data = await propertiesApi.getAll();
      return extractApiList<Property>(data);
    },
  });

  // ── Calendar Pricing query (single property) ──
  const calendarPricingQuery = useQuery<CalendarPricingDay[]>({
    queryKey: dynamicPricingKeys.calendarPricing(selectedPropertyId ?? 0, from, to),
    queryFn: () => calendarPricingApi.getPricing(selectedPropertyId!, from, to),
    enabled: selectedPropertyId !== null,
  });

  // ── Rate Plans query ──
  const ratePlansQuery = useQuery<RatePlan[]>({
    queryKey: dynamicPricingKeys.ratePlans(selectedPropertyId ?? 0),
    queryFn: () => calendarPricingApi.getRatePlans(selectedPropertyId!),
    enabled: selectedPropertyId !== null,
  });

  // ── Helper: invalidate calendar pricing after mutations ──
  const invalidateCalendarPricing = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: dynamicPricingKeys.allCalendarPricing() });
  }, [queryClient]);

  const invalidateRatePlans = useCallback(() => {
    if (selectedPropertyId !== null) {
      queryClient.invalidateQueries({ queryKey: dynamicPricingKeys.ratePlans(selectedPropertyId) });
    }
    invalidateCalendarPricing();
  }, [queryClient, selectedPropertyId, invalidateCalendarPricing]);

  // ── Update price mutation (bulk override) ──
  const updatePriceMutation = useMutation({
    mutationFn: (data: BulkRateOverrideData) => calendarPricingApi.createOverrideBulk(data),
    onSuccess: invalidateCalendarPricing,
  });

  // ── Rate Plan mutations ──
  const createRatePlanMutation = useMutation({
    mutationFn: (data: CreateRatePlanData) => calendarPricingApi.createRatePlan(data),
    onSuccess: invalidateRatePlans,
  });

  const updateRatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateRatePlanData> }) =>
      calendarPricingApi.updateRatePlan(id, data),
    onSuccess: invalidateRatePlans,
  });

  const deleteRatePlanMutation = useMutation({
    mutationFn: (id: number) => calendarPricingApi.deleteRatePlan(id),
    onSuccess: invalidateRatePlans,
  });

  // ── Rate Override delete ──
  const deleteOverrideMutation = useMutation({
    mutationFn: (id: number) => calendarPricingApi.deleteOverride(id),
    onSuccess: invalidateCalendarPricing,
  });

  return {
    // Properties
    properties: propertiesQuery.data ?? [],
    propertiesLoading: propertiesQuery.isLoading,
    propertiesError: propertiesQuery.isError,
    refetchProperties: propertiesQuery.refetch,

    // Selected property
    selectedPropertyId,
    setSelectedPropertyId,

    // Month navigation
    currentMonth,
    from,
    to,
    goToPrevMonth,
    goToNextMonth,

    // Calendar pricing data
    calendarPricing: calendarPricingQuery.data ?? [],
    calendarPricingLoading: calendarPricingQuery.isLoading,
    calendarPricingError: calendarPricingQuery.isError,
    refetchCalendarPricing: calendarPricingQuery.refetch,

    // Rate plans
    ratePlans: ratePlansQuery.data ?? [],
    ratePlansLoading: ratePlansQuery.isLoading,
    ratePlansError: ratePlansQuery.isError,
    refetchRatePlans: ratePlansQuery.refetch,

    // Mutations
    updatePrice: updatePriceMutation.mutateAsync,
    updatePriceLoading: updatePriceMutation.isPending,

    createRatePlan: createRatePlanMutation.mutateAsync,
    createRatePlanLoading: createRatePlanMutation.isPending,

    updateRatePlan: updateRatePlanMutation.mutateAsync,
    updateRatePlanLoading: updateRatePlanMutation.isPending,

    deleteRatePlan: deleteRatePlanMutation.mutateAsync,
    deleteRatePlanLoading: deleteRatePlanMutation.isPending,

    deleteOverride: deleteOverrideMutation.mutateAsync,
  };
}
