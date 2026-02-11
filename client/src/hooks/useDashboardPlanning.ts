import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { propertiesApi, managersApi, reservationsApi } from '../services/api';
import type { Property, Reservation, ReservationStatus, PlanningIntervention, PlanningInterventionType } from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlanningViewMode = 'week' | 'month';
export type PlanningFilterType = 'all' | 'reservations' | 'interventions';

export interface PlanningProperty {
  id: number;
  name: string;
  address: string;
  city: string;
}

export interface UseDashboardPlanningReturn {
  properties: PlanningProperty[];
  reservations: Reservation[];
  interventions: PlanningIntervention[];
  loading: boolean;
  error: string | null;
  // Navigation
  currentDate: Date;
  viewMode: PlanningViewMode;
  setViewMode: (mode: PlanningViewMode) => void;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
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

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday = start of week (French convention)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
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

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDashboardPlanning(): UseDashboardPlanningReturn {
  const { user } = useAuth();

  // State
  const [properties, setProperties] = useState<PlanningProperty[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [interventions, setInterventions] = useState<PlanningIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<PlanningViewMode>('month');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [interventionTypeFilter, setInterventionTypeFilter] = useState<PlanningInterventionType | 'all'>('all');
  const [showInterventions, setShowInterventions] = useState(true);

  // Determine user role
  const isAdmin = user?.roles?.includes('ADMIN') || false;
  const isManager = user?.roles?.includes('MANAGER') || false;
  const isHost = user?.roles?.includes('HOST') || false;
  const isTechnician = user?.roles?.includes('TECHNICIAN') || false;
  const isHousekeeper = user?.roles?.includes('HOUSEKEEPER') || false;
  const isSupervisor = user?.roles?.includes('SUPERVISOR') || false;
  const isOperational = isTechnician || isHousekeeper || isSupervisor;

  // Compute date range
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      return { start, end };
    }
    // month view
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return { start, end };
  }, [currentDate, viewMode]);

  // Generate array of days
  const days = useMemo(() => generateDays(dateRange.start, dateRange.end), [dateRange]);

  // Navigation
  const goToday = useCallback(() => setCurrentDate(new Date()), []);

  const goPrev = useCallback(() => {
    setCurrentDate((prev) => {
      if (viewMode === 'week') return addDays(prev, -7);
      return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
    });
  }, [viewMode]);

  const goNext = useCallback(() => {
    setCurrentDate((prev) => {
      if (viewMode === 'week') return addDays(prev, 7);
      return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
    });
  }, [viewMode]);

  // Load data
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // ── Mode Mock : utiliser les propriétés mock directement ──────────
      // En mode mock, les réservations utilisent des propertyId (1-10) qui
      // ne correspondent pas aux vrais IDs backend. On charge donc les
      // propriétés mock au lieu d'appeler l'API properties.
      // TODO: Supprimer ce bloc quand l'API Airbnb sera connectée.
      if (reservationsApi.isMockMode()) {
        const mockProperties = reservationsApi.getMockProperties();
        setProperties(mockProperties);

        const extendedFrom = toISODateString(addDays(dateRange.start, -7));
        const extendedTo = toISODateString(addDays(dateRange.end, 7));

        const [reservationData, interventionData] = await Promise.all([
          reservationsApi.getAll({ from: extendedFrom, to: extendedTo }),
          reservationsApi.getPlanningInterventions({ from: extendedFrom, to: extendedTo }),
        ]);

        setReservations(reservationData);
        setInterventions(interventionData);
        return;
      }

      // ── Mode API réelle ───────────────────────────────────────────────
      let propertyList: Property[] = [];

      if (isAdmin || isManager) {
        // Admin/Manager: all properties
        const data = await propertiesApi.getAll();
        propertyList = Array.isArray(data) ? data : (data as any)?.content ?? [];
      } else if (isHost) {
        // Host: only their own properties
        const data = await propertiesApi.getAll({ ownerId: user.id });
        propertyList = Array.isArray(data) ? data : (data as any)?.content ?? [];
      } else if (isOperational) {
        // Housekeeping/Supervisor/Technician: properties assigned via manager associations
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
          // If associations API fails, show empty list
          propertyList = [];
        }
      }

      // Map to PlanningProperty (lightweight)
      const mappedProperties: PlanningProperty[] = propertyList.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
      }));

      setProperties(mappedProperties);

      // Load reservations and interventions for these properties within the date range (extended by 7 days each side for visibility)
      const propertyIds = mappedProperties.map((p) => p.id);
      if (propertyIds.length > 0) {
        const extendedFrom = toISODateString(addDays(dateRange.start, -7));
        const extendedTo = toISODateString(addDays(dateRange.end, 7));

        const [reservationData, interventionData] = await Promise.all([
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

        setReservations(reservationData);
        setInterventions(interventionData);
      } else {
        setReservations([]);
        setInterventions([]);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du planning');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isManager, isHost, isOperational, dateRange]);

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
    error,
    currentDate,
    viewMode,
    setViewMode,
    goToday,
    goPrev,
    goNext,
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
