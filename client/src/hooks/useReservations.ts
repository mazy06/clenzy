import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
import { reservationsApi } from '../services/api';
import type {
  Reservation,
  ReservationStatus,
  ReservationSource,
  ReservationFilters,
  CreateReservationData,
  UpdateReservationData,
} from '../services/api/reservationsApi';

// ============================================================================
// Query keys
// ============================================================================

export const reservationsKeys = {
  all: ['reservations'] as const,
  list: (filters: ReservationFilters) => [...reservationsKeys.all, filters] as const,
};

// ============================================================================
// Filter state
// ============================================================================

export interface ReservationFilterState {
  propertyId: number | null;
  status: ReservationStatus | null;
  source: ReservationSource | null;
  from: string;
  to: string;
}

const DEFAULT_FILTERS: ReservationFilterState = {
  propertyId: null,
  status: null,
  source: null,
  from: '',
  to: '',
};

// ============================================================================
// Hook
// ============================================================================

export interface UseReservationsReturn {
  reservations: Reservation[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  filters: ReservationFilterState;
  setFilter: <K extends keyof ReservationFilterState>(key: K, value: ReservationFilterState[K]) => void;
  resetFilters: () => void;
  createReservation: (data: CreateReservationData) => Promise<Reservation>;
  isCreating: boolean;
  updateReservation: (params: { id: number; data: UpdateReservationData }) => Promise<Reservation>;
  isUpdating: boolean;
  cancelReservation: (id: number) => Promise<void>;
  isCancelling: boolean;
}

export function useReservations(): UseReservationsReturn {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReservationFilterState>(DEFAULT_FILTERS);

  // Build API filters from local state
  const apiFilters = useMemo<ReservationFilters>(() => {
    const f: ReservationFilters = {};
    if (filters.propertyId) f.propertyIds = [filters.propertyId];
    if (filters.status) f.status = filters.status;
    if (filters.source) f.source = filters.source;
    if (filters.from) f.from = filters.from;
    if (filters.to) f.to = filters.to;
    return f;
  }, [filters]);

  // ─── List query ────────────────────────────────────────────────────
  const listQuery = useQuery({
    queryKey: reservationsKeys.list(apiFilters),
    queryFn: () => reservationsApi.getAll(apiFilters),
    staleTime: 30_000,
  });

  // ─── Create mutation ───────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateReservationData) => reservationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationsKeys.all });
    },
  });

  // ─── Update mutation ───────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateReservationData }) =>
      reservationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationsKeys.all });
    },
  });

  // ─── Cancel mutation ───────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: (id: number) => reservationsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationsKeys.all });
    },
  });

  // ─── Filter helpers ────────────────────────────────────────────────
  const setFilter = useCallback(
    <K extends keyof ReservationFilterState>(key: K, value: ReservationFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return useMemo(
    () => ({
      reservations: listQuery.data ?? [],
      isLoading: listQuery.isLoading,
      isError: listQuery.isError,
      error: listQuery.error
        ? ((listQuery.error as { message?: string }).message ?? 'Erreur de chargement')
        : null,
      filters,
      setFilter,
      resetFilters,
      createReservation: createMutation.mutateAsync,
      isCreating: createMutation.isPending,
      updateReservation: updateMutation.mutateAsync,
      isUpdating: updateMutation.isPending,
      cancelReservation: cancelMutation.mutateAsync,
      isCancelling: cancelMutation.isPending,
    }),
    [
      listQuery.data,
      listQuery.isLoading,
      listQuery.isError,
      listQuery.error,
      filters,
      setFilter,
      resetFilters,
      createMutation.mutateAsync,
      createMutation.isPending,
      updateMutation.mutateAsync,
      updateMutation.isPending,
      cancelMutation.mutateAsync,
      cancelMutation.isPending,
    ],
  );
}
