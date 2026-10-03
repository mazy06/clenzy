import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../services/api/reportsApi';
import { useAuth } from '../../../hooks/useAuth';

/** Cache partagé par source et compte, jamais entre deux organisations. */
function useReportData<T>(source: string, fetchData: () => Promise<T>) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['reports', 'stats', source, user?.id, user?.organizationId],
    queryFn: fetchData,
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  return {
    data: query.data ?? null,
    loading: !user || query.isLoading,
    error: query.error?.message ?? null,
    retry: () => { void query.refetch(); },
  };
}

export const useInterventionReport = () => useReportData('interventions', reportsApi.getInterventionStats);
export const usePropertyReport = () => useReportData('properties', reportsApi.getPropertyStats);
export const useTeamReport = () => useReportData('teams', reportsApi.getTeamStats);
export const useFinancialReport = () => useReportData('financial', reportsApi.getFinancialStats);
