import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { propertiesApi, managersApi, reservationsApi } from '../services/api';
import type { Property, Reservation, ReservationStatus, PlanningIntervention, PlanningInterventionType } from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlanningViewMode = 'day' | 'week' | 'month' | 'continuous';
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
  loadingMore: boolean;
  error: string | null;
  // Navigation
  currentDate: Date;
  viewMode: PlanningViewMode;
  setViewMode: (mode: PlanningViewMode) => void;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<PlanningViewMode>('continuous');
  // En mode continu, on gère la fin de la plage via un état dédié pour l'infinite scroll
  const [continuousEndMonth, setContinuousEndMonth] = useState(3); // nombre de mois après le mois courant
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
    if (viewMode === 'day') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      return { start, end: start };
    }
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      return { start, end };
    }
    if (viewMode === 'continuous') {
      // Mode continu : mois courant + N mois suivants (extensible via infinite scroll)
      const start = startOfMonth(currentDate);
      const endMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + continuousEndMonth, 0);
      return { start, end: endMonth };
    }
    // month view
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return { start, end };
  }, [currentDate, viewMode, continuousEndMonth]);

  // Generate array of days
  const days = useMemo(() => generateDays(dateRange.start, dateRange.end), [dateRange]);

  // Navigation
  const goToday = useCallback(() => {
    setCurrentDate(new Date());
    setContinuousEndMonth(3);
  }, []);

  const goPrev = useCallback(() => {
    setContinuousEndMonth(3);
    setCurrentDate((prev) => {
      if (viewMode === 'day') return addDays(prev, -1);
      if (viewMode === 'week') return addDays(prev, -7);
      return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
    });
  }, [viewMode]);

  const goNext = useCallback(() => {
    setContinuousEndMonth(3);
    setCurrentDate((prev) => {
      if (viewMode === 'day') return addDays(prev, 1);
      if (viewMode === 'week') return addDays(prev, 7);
      return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
    });
  }, [viewMode]);

  // Réf pour les propriétés chargées (nécessaire pour extendRange)
  const propertiesRef = useRef<PlanningProperty[]>([]);

  // Infinite scroll : étendre la plage de 3 mois supplémentaires
  const extendRange = useCallback(async () => {
    if (viewMode !== 'continuous' || loadingMore) return;

    setLoadingMore(true);
    try {
      const newEndMonth = continuousEndMonth + 3;
      // Calculer la plage de données à charger (uniquement les nouveaux mois)
      const oldEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + continuousEndMonth, 0);
      const newEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + newEndMonth, 0);
      const extFrom = toISODateString(oldEnd);
      const extTo = toISODateString(addDays(newEnd, 7));

      const propertyIds = propertiesRef.current.map((p) => p.id);

      if (propertyIds.length > 0) {
        const [newReservations, newInterventions] = await Promise.all([
          reservationsApi.getAll({ propertyIds, from: extFrom, to: extTo }),
          reservationsApi.getPlanningInterventions({ propertyIds, from: extFrom, to: extTo }),
        ]);

        // Ajouter les données mock si admin en mode mock
        let mockRes: Reservation[] = [];
        let mockInt: PlanningIntervention[] = [];
        if (isAdmin && reservationsApi.isMockMode()) {
          [mockRes, mockInt] = await Promise.all([
            reservationsApi.getAll({ from: extFrom, to: extTo }),
            reservationsApi.getPlanningInterventions({ from: extFrom, to: extTo }),
          ]);
        }

        // Dédupliquer par ID avant d'ajouter
        setReservations((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const toAdd = [...newReservations, ...mockRes].filter((r) => !existingIds.has(r.id));
          return [...prev, ...toAdd];
        });
        setInterventions((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const toAdd = [...newInterventions, ...mockInt].filter((i) => !existingIds.has(i.id));
          return [...prev, ...toAdd];
        });
      }

      setContinuousEndMonth(newEndMonth);
    } catch {
      // Silencieux — on ne bloque pas le planning pour un échec de chargement incrémental
    } finally {
      setLoadingMore(false);
    }
  }, [viewMode, loadingMore, continuousEndMonth, currentDate, isAdmin]);

  // Load data
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // ── Étape 1 : Charger les propriétés réelles via API selon le rôle ──
      let propertyList: Property[] = [];

      if (isAdmin || isManager) {
        // Admin/Manager: toutes les propriétés réelles
        try {
          const data = await propertiesApi.getAll();
          propertyList = Array.isArray(data) ? data : (data as any)?.content ?? [];
        } catch {
          propertyList = [];
        }
      } else if (isHost) {
        // Host: uniquement ses propres propriétés
        try {
          const data = await propertiesApi.getAll({ ownerId: user.id });
          propertyList = Array.isArray(data) ? data : (data as any)?.content ?? [];
        } catch {
          propertyList = [];
        }
      } else if (isOperational) {
        // Supervisor/Housekeeper/Technician: propriétés assignées via portefeuille client
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
          // Si l'API associations échoue, liste vide
          propertyList = [];
        }
      }

      // Map vers PlanningProperty (léger)
      const mappedProperties: PlanningProperty[] = propertyList.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
      }));

      // ── Étape 2 : Charger les réservations/interventions réelles ──
      let reservationData: Reservation[] = [];
      let interventionData: PlanningIntervention[] = [];

      const propertyIds = mappedProperties.map((p) => p.id);
      const extendedFrom = toISODateString(addDays(dateRange.start, -7));
      const extendedTo = toISODateString(addDays(dateRange.end, 7));

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

      // ── Étape 3 : ADMIN uniquement — ajouter les données mock de test ──
      // Les données mock (10 propriétés fictives) ne sont visibles que par
      // l'admin à des fins de test du planning. Les autres rôles ne voient
      // que les données réelles issues de l'API.
      if (isAdmin && reservationsApi.isMockMode()) {
        const mockProperties = reservationsApi.getMockProperties();
        mappedProperties.push(...mockProperties);

        const [mockReservations, mockInterventions] = await Promise.all([
          reservationsApi.getAll({ from: extendedFrom, to: extendedTo }),
          reservationsApi.getPlanningInterventions({ from: extendedFrom, to: extendedTo }),
        ]);

        reservationData = [...reservationData, ...mockReservations];
        interventionData = [...interventionData, ...mockInterventions];
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
    loadingMore,
    error,
    currentDate,
    viewMode,
    setViewMode,
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
