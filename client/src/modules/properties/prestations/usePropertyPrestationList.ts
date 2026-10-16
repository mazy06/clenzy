import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { interventionsApi } from '../../../services/api/interventionsApi';
import { serviceRequestsApi } from '../../../services/api/serviceRequestsApi';
import { activeLanguage } from '../../../utils/activeLocale';
import { weekStartsOnForLanguage } from '../../../utils/localeDate';
import { isoDay, mergePrestations, startOfWeek } from './prestationTimeline';

/**
 * Prestations d'un logement (interventions depuis le début de la semaine courante + demandes
 * ouvertes), en une suite chronologique. Partagé par la liste et le résumé de la fiche :
 * mêmes clés de cache, une seule lecture.
 */
export function usePropertyPrestationList(propertyId: number, today: Date) {
  const currentWeek = useMemo(() => startOfWeek(today, weekStartsOnForLanguage(activeLanguage())), [today]);
  const interventions = useQuery({
    queryKey: ['property-prestations', 'interventions', propertyId, isoDay(currentWeek)],
    queryFn: () => interventionsApi.getPage({ propertyId, startDate: isoDay(currentWeek), sort: 'scheduledDate,asc', size: 100 }),
    staleTime: 60_000,
  });
  const requests = useQuery({
    queryKey: ['property-prestations', 'requests', propertyId],
    queryFn: () => serviceRequestsApi.getAll({ propertyId, activeOnly: true }),
    staleTime: 60_000,
  });
  const prestations = useMemo(
    () => mergePrestations(interventions.data?.content ?? [], requests.data ?? []),
    [interventions.data, requests.data],
  );
  return {
    currentWeek,
    prestations,
    loading: interventions.isLoading || requests.isLoading,
    failed: interventions.isError || requests.isError,
  };
}
