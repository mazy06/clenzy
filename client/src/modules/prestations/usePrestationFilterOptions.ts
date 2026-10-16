import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamsApi, type Team } from '../../services/api/teamsApi';
import { usersApi, type User } from '../../services/api/usersApi';
import { extractApiList } from '../../types';
import { INTERVENTION_STATUS_OPTIONS, REQUEST_STATUS_OPTIONS } from '../../types/statusEnums';
import { OPERATIONAL_ROLES } from '../../constants/roles';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import { useTranslation } from '../../hooks/useTranslation';
import type { FilterOption } from '../../components/FilterSearchBar';
import type { PrestationCategory } from './prestationFilters';

/** Seuls ces statuts de demande figurent à l'écran : les autres sont devenus des interventions ou sont clos. */
const OPEN_REQUEST_STATUSES = ['PENDING', 'ASSIGNED'];

/** Options des filtres de l'écran Prestations. Les intervenants ne sont lus que pour les gestionnaires. */
export function usePrestationFilterOptions(category: PrestationCategory, canFilterAssignee: boolean) {
  const { t } = useTranslation();
  const { properties } = usePropertiesList();
  // Mêmes clés de cache que la modale d'assignation des interventions.
  const teams = useQuery({
    queryKey: ['assign-teams'],
    queryFn: async () => extractApiList<Team>(await teamsApi.getAll()),
    enabled: canFilterAssignee, staleTime: 5 * 60_000,
  });
  const users = useQuery({
    queryKey: ['assign-users'],
    queryFn: async () => extractApiList<User>(await usersApi.getAll()),
    enabled: canFilterAssignee, staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const all = (label: string): FilterOption => ({ value: 'all', label });
    const requestStatuses = REQUEST_STATUS_OPTIONS
      .filter((option) => OPEN_REQUEST_STATUSES.includes(option.value))
      .map((option) => ({ value: option.value as string, label: t(option.labelKey) }));
    const interventionStatuses = INTERVENTION_STATUS_OPTIONS
      .map((option) => ({ value: option.value as string, label: t(option.labelKey) }));
    const statusPool = category === 'request' ? requestStatuses
      : category === 'intervention' ? interventionStatuses
      // Un même code (PENDING…) couvre les deux types : une seule entrée.
      : [...interventionStatuses, ...requestStatuses.filter((s) => !interventionStatuses.some((i) => i.value === s.value))];
    const operational = (users.data ?? []).filter((user) => (OPERATIONAL_ROLES as readonly string[]).includes(user.role));
    return {
      categories: [
        all(t('prestations.filters.allKinds', 'Toutes')),
        { value: 'intervention', label: t('prestations.filters.interventions', 'Interventions') },
        { value: 'request', label: t('prestations.filters.requests', 'Demandes') },
      ],
      statuses: [all(t('prestations.filters.allStatuses', 'Tous les statuts')), ...statusPool],
      periods: [
        all(t('prestations.filters.anyDate', 'Toutes les dates')),
        { value: 'today', label: t('prestations.filters.today', "Aujourd'hui") },
        { value: 'next7', label: t('prestations.filters.next7', '7 prochains jours') },
        { value: 'next30', label: t('prestations.filters.next30', '30 prochains jours') },
        { value: 'past30', label: t('prestations.filters.past30', '30 derniers jours') },
      ],
      properties: [
        all(t('prestations.filters.allProperties', 'Tous les logements')),
        ...properties.map((property) => ({ value: String(property.id), label: property.name })),
      ],
      assignees: [
        all(t('prestations.filters.anyAssignee', 'Tous les intervenants')),
        ...(teams.data ?? []).map((team) => ({ value: `team:${team.id}`, label: team.name })),
        ...operational.map((user) => ({ value: `user:${user.id}`, label: `${user.firstName} ${user.lastName}`.trim() })),
      ],
    };
  }, [t, category, properties, teams.data, users.data]);
}
