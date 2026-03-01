import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '@/api/endpoints/teamsApi';

const KEYS = {
  all: ['teams'] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
};

export function useTeams() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: () => teamsApi.getAll(),
  });
}

export function useTeam(id: number) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => teamsApi.getById(id),
    enabled: id > 0,
  });
}
