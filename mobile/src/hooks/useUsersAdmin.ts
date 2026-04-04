import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersAdminApi, type CreateUserData, type UpdateUserData } from '@/api/endpoints/usersAdminApi';

const KEYS = {
  all: ['users-admin'] as const,
  list: () => [...KEYS.all, 'list'] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
  search: (query: string) => [...KEYS.all, 'search', query] as const,
};

export function useUsersAdmin() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: () => usersAdminApi.getAll(),
  });
}

export function useUserAdmin(id: number) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => usersAdminApi.getById(id),
    enabled: id > 0,
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: KEYS.search(query),
    queryFn: () => usersAdminApi.searchUsers(query),
    enabled: query.length >= 2,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserData) => usersAdminApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserData }) =>
      usersAdminApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => usersAdminApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}
