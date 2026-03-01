import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactApi } from '../services/api/contactApi';
import type { PaginatedResponse } from '../services/apiClient';
import type { ContactMessage, ContactThreadSummary } from '../services/api/contactApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const contactKeys = {
  all: ['contact'] as const,
  messages: (type: string, page: number, size: number) =>
    [...contactKeys.all, 'messages', type, { page, size }] as const,
  threads: () => [...contactKeys.all, 'threads'] as const,
  threadMessages: (counterpartKeycloakId: string) =>
    [...contactKeys.all, 'thread-messages', counterpartKeycloakId] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useContactMessages(
  type: 'inbox' | 'sent' | 'archived',
  page: number,
  size: number,
) {
  return useQuery<PaginatedResponse<ContactMessage>>({
    queryKey: contactKeys.messages(type, page, size),
    queryFn: () => contactApi.getMessages(type, { page, size }),
    staleTime: 30_000,
  });
}

// ─── Thread Queries (messagerie instantanee) ────────────────────────────────

/** Liste des conversations groupees par interlocuteur */
export function useContactThreads() {
  return useQuery({
    queryKey: contactKeys.threads(),
    queryFn: () => contactApi.getThreads(),
    staleTime: 30_000,
    refetchInterval: 60_000,      // fallback polling 60s (WebSocket gere le temps reel)
  });
}

/** Messages d'une conversation avec un interlocuteur */
export function useThreadMessages(counterpartKeycloakId: string | null) {
  return useQuery({
    queryKey: contactKeys.threadMessages(counterpartKeycloakId!),
    queryFn: () => contactApi.getThreadMessages(counterpartKeycloakId!),
    staleTime: 15_000,
    refetchInterval: 30_000,      // fallback polling 30s (WebSocket gere le temps reel)
    enabled: counterpartKeycloakId != null,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Marquer tous les messages non-lus d'un thread comme lus */
export function useMarkThreadAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (counterpartKeycloakId: string) =>
      contactApi.markThreadAsRead(counterpartKeycloakId),
    onMutate: (counterpartKeycloakId) => {
      // Mise a jour optimiste : badge non-lu → 0 instantanement
      queryClient.setQueryData<ContactThreadSummary[]>(
        contactKeys.threads(),
        (old) => {
          if (!old) return old;
          return old.map((th) =>
            th.counterpartKeycloakId === counterpartKeycloakId
              ? { ...th, unreadCount: 0 }
              : th
          );
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.threads() });
    },
  });
}

export function useUpdateMessageStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      contactApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useArchiveMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => contactApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useUnarchiveMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => contactApi.unarchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => contactApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useReplyMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { message: string; attachments?: File[] } }) =>
      contactApi.reply(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: string }) =>
      contactApi.bulkUpdateStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useBulkDeleteMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => contactApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}
