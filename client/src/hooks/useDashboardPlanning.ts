import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function generateDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  return days;
}

function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Safely unwrap API response that may be a plain array or a paginated { content: T[] } */
function unwrapPropertyList(data: unknown): Property[] {
  if (Array.isArray(data)) return data as Property[];
  if (data && typeof data === 'object' && 'content' in data && Array.isArray((data as { content: unknown }).content)) {
    return (data as { content: Property[] }).content;
  }
  return [];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const INITIAL_MONTHS = 3;
const MAX_MONTHS = 12; // Cap to prevent unbounded memory growth

export function useDashboardPlanning(): UseDashboardPlanningReturn {
  const { user } = useAuth();

  // State
  const [properties, setProperties] = useState<PlanningProperty[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [interventions, setInterventions] = useState<PlanningIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  // continuousEndMonth is used ONLY for display range (days array) — NOT for triggering loadData
  const continuousEndMonthRef = useRef(INITIAL_MONTHS);
  const [continuousEndMonth, setContinuousEndMonth] = useState(INITIAL_MONTHS);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [interventionTypeFilter, setInterventionTypeFilter] = useState<PlanningInterventionType | 'all'>('all');
  const [showInterventions, setShowInterventions] = useState(true);

  // Keep ref in sync
  useEffect(() => {
    continuousEndMonthRef.current = continuousEndMonth;
  }, [continuousEndMonth]);

  // Determine user role
  const isAdmin = user?.roles?.includes('ADMIN') || false;
  const isManager = user?.roles?.includes('MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;
  const isTechnician = user?.roles?.includes('TECHNICIAN') || false;
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER') || false;
  const isSupervisor = user?.roles?.includes('SUPERVISOR') || false;
  const isOperational = isTechnician || isHousekeeper || isSupervisor;

  // Display date range — extends as user scrolls, does NOT trigger loadData
  const dateRange = useMemo(() => {
    const start = startOfMonth(currentDate);
    const endMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + continuousEndMonth, 0);
    return { start, end: endMonth };
  }, [currentDate, continuousEndMonth]);

  // Initial load range — only depends on currentDate, NOT continuousEndMonth
  // This ensures loadData only runs on navigation (prev/next/today), not on extend
  const initialLoadRange = useMemo(() => {
    const start = startOfMonth(currentDate);
    const endMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + INITIAL_MONTHS, 0);
    return { start, end: endMonth };
  }, [currentDate]);

  // Generate array of days
  const days = useMemo(() => generateDays(dateRange.start, dateRange.end), [dateRange]);

  // Navigation — reset endMonth to initial
  const goToday = useCallback(() => {
    setCurrentDate(new Date());
    setContinuousEndMonth(INITIAL_MONTHS);
  }, []);

  const goPrev = useCallback(() => {
    setContinuousEndMonth(INITIAL_MONTHS);
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goNext = useCallback(() => {
    setContinuousEndMonth(INITIAL_MONTHS);
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  // Ref pour les proprietes chargees (necessaire pour extendRange)
  const propertiesRef = useRef<PlanningProperty[]>([]);

  // Guard against concurrent extendRange calls
  const extendingRef = useRef(false);

  // Infinite scroll : etendre la plage de 3 mois supplementaires
  // Uses refs to avoid dependency on state that would cause loadData to re-run
  const extendRange = useCallback(async () => {
    if (extendingRef.current) return;
    // Cap at MAX_MONTHS to prevent unbounded memory growth
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

      const propertyIds = propertiesRef.current.map((p) => p.id);

      if (propertyIds.length > 0) {
        const [newReservations, newInterventions] = await Promise.all([
          reservationsApi.getAll({ propertyIds, from: extFrom, to: extTo }),
          reservationsApi.getPlanningInterventions({ propertyIds, from: extFrom, to: extTo }),
        ]);

        setReservations((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const toAdd = newReservations.filter((r) => !existingIds.has(r.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
        setInterventions((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const toAdd = newInterventions.filter((i) => !existingIds.has(i.id));
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
  }, [currentDate]);

  // Load data — depends on initialLoadRange (= currentDate only), NOT continuousEndMonth
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const useMock = isAdmin && reservationsApi.isMockMode();

      if (useMock) {
        const mockProperties = reservationsApi.getMockProperties().map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          city: p.city,
          ownerName: p.ownerName || '',
        }));
        const mockPropertyIds = mockProperties.map((p) => p.id);
        const extFrom = toISODateString(addDays(initialLoadRange.start, -7));
        const extTo = toISODateString(addDays(initialLoadRange.end, 7));

        const [mockReservations, mockInterventions] = await Promise.all([
          reservationsApi.getAll({ propertyIds: mockPropertyIds, from: extFrom, to: extTo }),
          reservationsApi.getPlanningInterventions({ propertyIds: mockPropertyIds, from: extFrom, to: extTo }),
        ]);

        propertiesRef.current = mockProperties;
        setProperties(mockProperties);
        setReservations(mockReservations);
        setInterventions(mockInterventions);
        setLoading(false);
        return;
      }

      // Charger les proprietes reelles via API selon le role
      let propertyList: Property[] = [];

      if (isAdmin || isManager) {
        try {
          const data = await propertiesApi.getAll();
          propertyList = unwrapPropertyList(data);
        } catch {
          propertyList = [];
        }
      } else if (isHost) {
        try {
          const data = await propertiesApi.getAll({ ownerId: user.id });
          propertyList = unwrapPropertyList(data);
        } catch {
          propertyList = [];
        }
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
        } catch {
          propertyList = [];
        }
      }

      const mappedProperties: PlanningProperty[] = propertyList.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
        ownerName: p.ownerName || '',
      }));

      let reservationData: Reservation[] = [];
      let interventionData: PlanningIntervention[] = [];

      const propertyIds = mappedProperties.map((p) => p.id);
      const extendedFrom = toISODateString(addDays(initialLoadRange.start, -7));
      const extendedTo = toISODateString(addDays(initialLoadRange.end, 7));

      if (propertyIds.length > 0) {
        [reservationData, interventionData] = await Promise.all([
          reservationsApi.getAll({
            propertyIds,
            from: extendedFrom,
            to: extendedTo,
          }),
          reservationsApi.getPlanningInterventions({
            propertyIds,
            from: extendedFrom,
            to: extendedTo,
          }),
        ]);
      }

      propertiesRef.current = mappedProperties;
      setProperties(mappedProperties);
      setReservations(reservationData);
      setInterventions(interventionData);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du planning');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isManager, isHost, isOperational, initialLoadRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter reservations by status
  const filteredReservations = useMemo(() => {
    if (statusFilter === 'all') return reservations;
    return reservations.filter((r) => r.status === statusFilter);
  }, [reservations, statusFilter]);

  // Filter interventions by type
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
