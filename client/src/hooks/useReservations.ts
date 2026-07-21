import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useState, useMemo, useCallback } from 'react';
import { reservationsApi } from '../services/api/reservationsApi';
import { trackEvent } from '../providers/PostHogProvider';
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
  // Mode paginé serveur (écran liste). Invalidé par reservationsKeys.all
  // comme les listes non paginées (les mutations invalident `all`).
  page: (filters: ReservationFilters, page: number, size: number, search: string) =>
    [...reservationsKeys.all, 'page', filters, { page, size, search }] as const,
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
  // Aucun filtre de statut par defaut : on affiche toutes les reservations.
  // L'utilisateur applique « En attente » (ou un autre statut) manuellement.
  status: null,
  source: null,
  from: '',
  to: '',
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Mode paginé serveur (opt-in) : fourni par l'écran liste, absent partout
 * ailleurs. `search` est appliqué en SQL (guest, code de confirmation,
 * logement) — le passer déjà débouncé.
 */
export interface UseReservationsPagination {
  page: number;
  size: number;
  search?: string;
}

export interface UseReservationsOptions {
  pagination?: UseReservationsPagination;
}

export interface UseReservationsReturn {
  reservations: Reservation[];
  /** Total serveur en mode paginé ; longueur de la liste sinon. */
  totalElements: number;
  isLoading: boolean;
  /** true pendant le refetch d'une page (placeholderData conserve l'ancienne). */
  isFetching: boolean;
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

export function useReservations(options?: UseReservationsOptions): UseReservationsReturn {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ReservationFilterState>(DEFAULT_FILTERS);
  const pagination = options?.pagination;

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

  // ─── List query (mode historique, liste complète) ──────────────────
  const listQuery = useQuery({
    queryKey: reservationsKeys.list(apiFilters),
    queryFn: () => reservationsApi.getAll(apiFilters),
    staleTime: 30_000,
    enabled: !pagination,
  });

  // ─── Page query (mode paginé serveur, écran liste) ─────────────────
  const search = pagination?.search?.trim() ?? '';
  const pageQuery = useQuery({
    queryKey: reservationsKeys.page(apiFilters, pagination?.page ?? 0, pagination?.size ?? 0, search),
    queryFn: () =>
      reservationsApi.getPage({
        ...apiFilters,
        page: pagination!.page,
        size: pagination!.size,
        search: search || undefined,
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: !!pagination,
  });

  const activeQuery = pagination ? pageQuery : listQuery;

  // ─── Create mutation ───────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateReservationData) => reservationsApi.create(data),
    onSuccess: (_result, data) => {
      queryClient.invalidateQueries({ queryKey: reservationsKeys.all });
      trackEvent.reservationCreated({
        channel: 'manual',
        propertyId: data.propertyId,
      });
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
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: reservationsKeys.all });
      trackEvent.reservationCancelled({ reservationId: id });
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

  const reservations = useMemo<Reservation[]>(() => {
    if (pagination) return pageQuery.data?.content ?? [];
    return listQuery.data ?? [];
  }, [pagination, pageQuery.data, listQuery.data]);

  const totalElements = pagination
    ? (pageQuery.data?.totalElements ?? 0)
    : (listQuery.data?.length ?? 0);

  return useMemo(
    () => ({
      reservations,
      totalElements,
      isLoading: activeQuery.isLoading,
      isFetching: activeQuery.isFetching,
      isError: activeQuery.isError,
      error: activeQuery.error
        ? ((activeQuery.error as { message?: string }).message ?? 'Erreur de chargement')
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
      reservations,
      totalElements,
      activeQuery.isLoading,
      activeQuery.isFetching,
      activeQuery.isError,
      activeQuery.error,
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
