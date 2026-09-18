import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { propertiesApi } from '../services/api/propertiesApi';

/** Les options proviennent du PMS et le cache reste borné au compte et à l'organisation. */
export function useMarketplaceProperties(enabled = true) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ['marketplace-properties', user?.id, user?.organizationId],
    queryFn: () => propertiesApi.getAll(),
    enabled: enabled && !!user && !loading,
    staleTime: 60_000,
  });
}
