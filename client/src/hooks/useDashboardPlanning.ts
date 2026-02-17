import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { propertiesApi, managersApi, reservationsApi } from '../services/api';
import type { Property, Reservation, ReservationStatus, PlanningIntervention, PlanningInterventionType } from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlanningFilterType = 'all' | 'reservations' | 'interventions';

export interface PlanningProperty {
  id: number;
  name: string;
  address: string;
  city: string;
  ownerName?: string;
}

export interface UseDashboardPlanningReturn {
  properties: PlanningProperty[];
  reservations: Reservation[];
  interventions: PlanningIntervention[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  // Navigation
  currentDate: Date;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  // Infinite scroll
  extendRange: () => void;
  // Filters
  statusFilter: ReservationStatus | 'all';
  setStatusFilter: (status: ReservationStatus | 'all') => void;
  interventionTypeFilter: PlanningInterventionType | 'all';
  setInterventionTypeFilter: (type: PlanningInterventionType | 'all') => void;
  showInterventions: boolean;
  setShowInterventions: (show: boolean) => void;
  // Computed
  dateRange: { start: Date; end: Date };
  days: Date[];
  filteredReservations: Reservation[];
  filteredInterventions: PlanningIntervention[];
}

// ─── Query Keys (exported for invalidation from other modules) ───────────────

export const planningKeys = {
  all: ['planning'] as const,
  properties: (userId: string | undefined) =>
    [...planningKeys.all, 'properties', userId] as const,
  reservations: (propertyIds: number[], from: string, to: string) =>
    [...planningKeys.all, 'reservations', { propertyIds, from, to }] as const,
  interventionsList: (propertyIds: number[], from: string, to: string) =>
    [...planningKeys.all, 'interventions', { propertyIds, from, to }] as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function generateDays(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    result.push(new Date(current));
    current = addDays(current, 1);
  }
  return result;
}

function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function unwrapPropertyList(data: unknown): Property[] {
  if (Array.isArray(data)) return data as Property[];
  if (data && typeof data === 'object' && 'content' in data && Array.isArray((data as { content: unknown }).content)) {
    return (data as { content: Property[] }).content;
  }
  return [];
}

function mapToPlanning(list: Property[]): PlanningProperty[] {
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    city: p.city,
    ownerName: p.ownerName || '',
  }));
}

// ─── Fetch functions (pure, no hooks) ────────────────────────────────────────

async function fetchProperties(
  user: { id: string; roles?: string[] } | null,
  isAdmin: boolean,
  isManager: boolean,
  isHost: boolean,
  isOperational: boolean,
): Promise<PlanningProperty[]> {
  if (!user) return [];

  // Mock mode for admin
  if (isAdmin && reservationsApi.isMockMode()) {
    return reservationsApi.getMockProperties().map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      ownerName: p.ownerName || '',
    }));
  }

  let propertyList: Property[] = [];

  if (isAdmin || isManager) {
    try {
      propertyList = unwrapPropertyList(await propertiesApi.getAll());
    } catch { /* empty */ }
  } else if (isHost) {
    try {
      propertyList = unwrapPropertyList(await propertiesApi.getAll({ ownerId: user.id }));
    } catch { /* empty */ }
  } else if (isOperational) {
    try {
      const associations = await managersApi.getAssociations(user.id);
      if (associations?.properties && Array.isArray(associations.properties)) {
        propertyList = associations.properties.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address || '',
          city: p.city || '',
          postalCode: '',
          country: '',
          type: p.type || '',
          status: '',
          bedroomCount: 0,
          bathroomCount: 0,
          squareMeters: 0,
          nightlyPrice: 0,
          description: '',
          maxGuests: 0,
          cleaningFrequency: '',
          ownerId: p.ownerId || 0,
        }));
      }
    } catch { /* empty */ }
  }

  return mapToPlanning(propertyList);
}

async function fetchReservations(
  propertyIds: number[],
  from: string,
  to: string,
): Promise<Reservation[]> {
  if (propertyIds.length === 0) return [];
  return reservationsApi.getAll({ propertyIds, from, to });
}

async function fetchPlanningInterventions(
  propertyIds: number[],
  from: string,
  to: string,
): Promise<PlanningIntervention[]> {
  if (propertyIds.length === 0) return [];
  return reservationsApi.getPlanningInterventions({ propertyIds, from, to });
}

// ─── Constants ───────────────────────────────────────────────────────────────

const INITIAL_MONTHS = 3;
const MAX_MONTHS = 12;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDashboardPlanning(): UseDashboardPlanningReturn {
  const { user } = useAuth();

  // ── Navigation state (local) ────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const [continuousEndMonth, setContinuousEndMonth] = useState(INITIAL_MONTHS);
  const continuousEndMonthRef = useRef(INITIAL_MONTHS);

  // ── Filter state (local) ────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [interventionTypeFilter, setInterventionTypeFilter] = useState<PlanningInterventionType | 'all'>('all');
  const [showInterventions, setShowInterventions] = useState(true);

  // ── Extension state (local — for infinite scroll beyond initial 3 months)
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraReservations, setExtraReservations] = useState<Reservation[]>([]);
  const [extraInterventions, setExtraInterventions] = useState<PlanningIntervention[]>([]);
  const extendingRef = useRef(false);

  useEffect(() => {
    continuousEndMonthRef.current = continuousEndMonth;
  }, [continuousEndMonth]);

  const resetExtras = useCallback(() => {
    setExtraReservations([]);
    setExtraInterventions([]);
    setContinuousEndMonth(INITIAL_MONTHS);
  }, []);

  // ── Roles ───────────────────────────────────────────────────────────
  const isAdmin = user?.roles?.includes('ADMIN') || false;
  const isManager = user?.roles?.includes('MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;
  const isTechnician = user?.roles?.includes('TECHNICIAN') || false;
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER') || false;
  const isSupervisor = user?.roles?.includes('SUPERVISOR') || false;
  const isOperational = isTechnician || isHousekeeper || isSupervisor;

  // ── Date ranges ─────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const start = startOfMonth(currentDate);
    const endMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + continuousEndMonth, 0);
    return { start, end: endMonth };
  }, [currentDate, continuousEndMonth]);

  const initialLoadRange = useMemo(() => {
    const start = startOfMonth(currentDate);
    const endMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + INITIAL_MONTHS, 0);
    return { start, end: endMonth };
  }, [currentDate]);

  const days = useMemo(() => generateDays(dateRange.start, dateRange.end), [dateRange]);

  const extendedFrom = useMemo(() => toISODateString(addDays(initialLoadRange.start, -7)), [initialLoadRange]);
  const extendedTo = useMemo(() => toISODateString(addDays(initialLoadRange.end, 7)), [initialLoadRange]);

  // ══════════════════════════════════════════════════════════════════════
  // React Query — 3 queries that replace the old loadData useEffect
  // ══════════════════════════════════════════════════════════════════════

  // Query 1: Properties (cached 2 min — they rarely change)
  const propertiesQuery = useQuery({
    queryKey: planningKeys.properties(user?.id),
    queryFn: () => fetchProperties(user, isAdmin, isManager, isHost, isOperational),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const properties = propertiesQuery.data ?? [];
  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  // Query 2: Reservations for current date range
  const reservationsQuery = useQuery({
    queryKey: planningKeys.reservations(propertyIds, extendedFrom, extendedTo),
    queryFn: () => fetchReservations(propertyIds, extendedFrom, extendedTo),
    enabled: propertyIds.length > 0,
    staleTime: 30_000,
  });

  // Query 3: Interventions for current date range
  const interventionsQuery = useQuery({
    queryKey: planningKeys.interventionsList(propertyIds, extendedFrom, extendedTo),
    queryFn: () => fetchPlanningInterventions(propertyIds, extendedFrom, extendedTo),
    enabled: propertyIds.length > 0,
    staleTime: 30_000,
  });

  // ── Merge initial query data + extended extras ──────────────────────
  const reservations = useMemo(() => {
    const base = reservationsQuery.data ?? [];
    if (extraReservations.length === 0) return base;
    const existingIds = new Set(base.map((r) => r.id));
    const toAdd = extraReservations.filter((r) => !existingIds.has(r.id));
    return [...base, ...toAdd];
  }, [reservationsQuery.data, extraReservations]);

  const interventions = useMemo(() => {
    const base = interventionsQuery.data ?? [];
    if (extraInterventions.length === 0) return base;
    const existingIds = new Set(base.map((i) => i.id));
    const toAdd = extraInterventions.filter((i) => !existingIds.has(i.id));
    return [...base, ...toAdd];
  }, [interventionsQuery.data, extraInterventions]);

  // ── Loading / Error ─────────────────────────────────────────────────
  const loading = propertiesQuery.isLoading
    || (propertyIds.length > 0 && reservationsQuery.isLoading)
    || (propertyIds.length > 0 && interventionsQuery.isLoading);

  const error = propertiesQuery.error?.message
    ?? reservationsQuery.error?.message
    ?? interventionsQuery.error?.message
    ?? null;

  // ── Navigation ──────────────────────────────────────────────────────
  const goToday = useCallback(() => {
    setCurrentDate(new Date());
    resetExtras();
  }, [resetExtras]);

  const goPrev = useCallback(() => {
    resetExtras();
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, [resetExtras]);

  const goNext = useCallback(() => {
    resetExtras();
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, [resetExtras]);

  // ── Extend range (infinite scroll) ──────────────────────────────────
  const extendRange = useCallback(async () => {
    if (extendingRef.current) return;
    if (continuousEndMonthRef.current >= MAX_MONTHS) return;
    extendingRef.current = true;
    setLoadingMore(true);

    try {
      const curEndMonth = continuousEndMonthRef.current;
      const newEndMonth = Math.min(curEndMonth + 3, MAX_MONTHS);
      const oldEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + curEndMonth, 0);
      const newEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + newEndMonth, 0);
      const extFrom = toISODateString(oldEnd);
      const extTo = toISODateString(addDays(newEnd, 7));

      if (propertyIds.length > 0) {
        const [newRes, newInt] = await Promise.all([
          fetchReservations(propertyIds, extFrom, extTo),
          fetchPlanningInterventions(propertyIds, extFrom, extTo),
        ]);

        const baseResIds = new Set((reservationsQuery.data ?? []).map((r) => r.id));
        const baseIntIds = new Set((interventionsQuery.data ?? []).map((i) => i.id));

        setExtraReservations((prev) => {
          const existingIds = new Set([...prev.map((r) => r.id), ...baseResIds]);
          const toAdd = newRes.filter((r) => !existingIds.has(r.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
        setExtraInterventions((prev) => {
          const existingIds = new Set([...prev.map((i) => i.id), ...baseIntIds]);
          const toAdd = newInt.filter((i) => !existingIds.has(i.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      setContinuousEndMonth(newEndMonth);
    } catch {
      // Silencieux
    } finally {
      setLoadingMore(false);
      extendingRef.current = false;
    }
  }, [currentDate, propertyIds, reservationsQuery.data, interventionsQuery.data]);

  // ── Filtered data (computed, no fetch) ──────────────────────────────
  const filteredReservations = useMemo(() => {
    if (statusFilter === 'all') return reservations;
    return reservations.filter((r) => r.status === statusFilter);
  }, [reservations, statusFilter]);

  const filteredInterventions = useMemo(() => {
    if (!showInterventions) return [];
    if (interventionTypeFilter === 'all') return interventions;
    return interventions.filter((i) => i.type === interventionTypeFilter);
  }, [interventions, interventionTypeFilter, showInterventions]);

  return {
    properties,
    reservations,
    interventions,
    loading,
    loadingMore,
    error,
    currentDate,
    goToday,
    goPrev,
    goNext,
    extendRange,
    statusFilter,
    setStatusFilter,
    interventionTypeFilter,
    setInterventionTypeFilter,
    showInterventions,
    setShowInterventions,
    dateRange,
    days,
    filteredReservations,
    filteredInterventions,
  };
}
