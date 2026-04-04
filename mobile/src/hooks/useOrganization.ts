import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi, type InviteMemberRequest } from '@/api/endpoints/organizationsApi';

const KEYS = {
  all: ['organizations'] as const,
  current: () => [...KEYS.all, 'current'] as const,
  members: (orgId: number) => [...KEYS.all, 'members', orgId] as const,
};

export function useCurrentOrganization() {
  return useQuery({
    queryKey: KEYS.current(),
    queryFn: () => organizationsApi.getCurrent(),
  });
}

export function useOrganizationMembers(orgId: number) {
  return useQuery({
    queryKey: KEYS.members(orgId),
    queryFn: () => organizationsApi.getMembers(orgId),
    enabled: orgId > 0,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, request }: { orgId: number; request: InviteMemberRequest }) =>
      organizationsApi.inviteMember(orgId, request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.members(variables.orgId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, memberId }: { orgId: number; memberId: number }) =>
      organizationsApi.removeMember(orgId, memberId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.members(variables.orgId) });
    },
  });
}
