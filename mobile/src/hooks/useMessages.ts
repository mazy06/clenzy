import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { contactApi, type ContactMessage, type ContactFormData, type Recipient, type ContactThreadSummary } from '@/api/endpoints/contactApi';
import { guestMessagingApi, type GuestMessageLog } from '@/api/endpoints/guestMessagingApi';

/* ─── Query Keys ─── */

const KEYS = {
  // Internal messaging
  inbox: ['contact', 'inbox'] as const,
  sent: ['contact', 'sent'] as const,
  recipients: ['contact', 'recipients'] as const,
  threads: ['contact', 'threads'] as const,
  threadMessages: (counterpartId: string) => ['contact', 'threads', counterpartId, 'messages'] as const,
  // Guest messaging
  guestHistory: ['guest-messaging', 'history'] as const,
  // Legacy
  legacyMessages: ['messages'] as const,
};

/* ─── Internal messaging hooks ─── */

/** Paginated inbox (received messages) */
export function useInbox(pageSize = 20) {
  return useInfiniteQuery({
    queryKey: KEYS.inbox,
    queryFn: ({ pageParam = 0 }) => contactApi.getInbox({ page: pageParam, size: pageSize }),
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
    initialPageParam: 0,
  });
}

/** Paginated sent messages */
export function useSentMessages(pageSize = 20) {
  return useInfiniteQuery({
    queryKey: KEYS.sent,
    queryFn: ({ pageParam = 0 }) => contactApi.getSent({ page: pageParam, size: pageSize }),
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
    initialPageParam: 0,
  });
}

/** List of available recipients */
export function useRecipients() {
  return useQuery<Recipient[]>({
    queryKey: KEYS.recipients,
    queryFn: () => contactApi.getRecipients(),
    staleTime: 5 * 60 * 1000, // 5min
  });
}

/** Send a new internal message */
export function useSendContactMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ContactFormData) => contactApi.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.sent });
      queryClient.invalidateQueries({ queryKey: KEYS.inbox });
    },
  });
}

/** Reply to an internal message (with optional attachments) */
export function useReplyMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message, attachments }: {
      id: number;
      message: string;
      attachments?: { uri: string; name: string; type: string }[];
    }) => contactApi.reply(id, message, attachments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.inbox });
      queryClient.invalidateQueries({ queryKey: KEYS.sent });
      queryClient.invalidateQueries({ queryKey: KEYS.threads });
    },
  });
}

/** List of grouped conversation threads (WhatsApp-like) */
export function useContactThreads() {
  return useQuery<ContactThreadSummary[]>({
    queryKey: KEYS.threads,
    queryFn: () => contactApi.getThreads(),
    staleTime: 30_000,
    refetchInterval: 60_000,      // fallback polling 60s (WebSocket gere le temps reel)
  });
}

/** Messages for a specific thread (by counterpart keycloakId) */
export function useThreadMessages(counterpartKeycloakId: string | null) {
  return useQuery<ContactMessage[]>({
    queryKey: KEYS.threadMessages(counterpartKeycloakId!),
    queryFn: () => contactApi.getThreadMessages(counterpartKeycloakId!),
    staleTime: 15_000,
    refetchInterval: 30_000,      // fallback polling 30s (WebSocket gere le temps reel)
    enabled: counterpartKeycloakId != null,
  });
}

/** Mark all unread messages in a thread as read */
export function useMarkThreadAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (counterpartKeycloakId: string) =>
      contactApi.markThreadAsRead(counterpartKeycloakId),
    onMutate: (counterpartKeycloakId) => {
      // Mise a jour optimiste : badge non-lu → 0 instantanement
      queryClient.setQueryData<ContactThreadSummary[]>(
        KEYS.threads,
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
      queryClient.invalidateQueries({ queryKey: KEYS.threads });
    },
  });
}

/** Mark message as read */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => contactApi.updateStatus(id, 'READ'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.inbox });
    },
  });
}

/** Archive a message */
export function useArchiveMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => contactApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.inbox });
      queryClient.invalidateQueries({ queryKey: KEYS.sent });
    },
  });
}

/** Delete a message */
export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => contactApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.inbox });
      queryClient.invalidateQueries({ queryKey: KEYS.sent });
    },
  });
}

/* ─── Guest messaging hooks ─── */

/** Full guest message history */
export function useGuestMessageHistory() {
  return useQuery<GuestMessageLog[]>({
    queryKey: KEYS.guestHistory,
    queryFn: () => guestMessagingApi.getHistory(),
  });
}

/* ─── Legacy hooks (backward compat) ─── */

export function useMessages() {
  return useQuery<ContactMessage[]>({
    queryKey: KEYS.legacyMessages,
    queryFn: () => contactApi.getMessages(),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ContactMessage>) => contactApi.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.legacyMessages });
    },
  });
}
