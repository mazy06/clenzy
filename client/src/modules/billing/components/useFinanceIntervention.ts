import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { interventionsApi } from '../../../services/api/interventionsApi';

/** Même source autorisée pour la vignette de liste et la fiche de paiement Baitly. */
export function useFinanceIntervention(id?: number | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['finance-intervention', user?.id, user?.organizationId, id],
    queryFn: () => interventionsApi.getById(id!),
    enabled: !!id && !!user,
    staleTime: 60_000,
    retry: false,
  });
}
