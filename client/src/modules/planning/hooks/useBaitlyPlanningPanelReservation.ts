import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '../../../services/api/reservationsApi';
import { planningKeys } from './usePlanningData';

/** Coordonnées complètes à la demande ; même famille d'invalidation que la grille. */
export function useBaitlyPlanningPanelReservation(id: number | undefined, open: boolean) {
  return useQuery({
    queryKey: [...planningKeys.all, 'panel-reservation', id],
    queryFn: ({ signal }) => reservationsApi.getById(id!, signal),
    enabled: open && id !== undefined,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });
}
