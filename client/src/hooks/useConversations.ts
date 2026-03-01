import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationApi } from '../services/api/conversationApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const conversationKeys = {
  all: ['conversations'] as const,
  inbox: (channels?: string[], status?: string, page?: number) =>
    [...conversationKeys.all, 'inbox', { channels, status, page }] as const,
  messages: (conversationId: number, page?: number) =>
    [...conversationKeys.all, 'messages', conversationId, { page }] as const,
  unreadCount: () => [...conversationKeys.all, 'unread-count'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

/** Inbox des conversations filtre par channels OTA */
export function useChannelInbox(
  channels: string[],
  page = 0,
  size = 20,
  status?: string,
) {
  return useQuery({
    queryKey: conversationKeys.inbox(channels, status, page),
    queryFn: () => conversationApi.getInbox({ channels, status, page, size }),
    staleTime: 30_000,
  });
}

/** Messages d'une conversation */
export function useConversationMessages(
  conversationId: number | null,
  page = 0,
  size = 50,
) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId!, page),
    queryFn: () => conversationApi.getMessages(conversationId!, { page, size }),
    staleTime: 15_000,
    enabled: conversationId != null,
  });
}

/** Compteur de conversations non-lues (global) */
export function useUnreadCount() {
  return useQuery({
    queryKey: conversationKeys.unreadCount(),
    queryFn: () => conversationApi.getUnreadCount(),
    staleTime: 60_000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Marquer une conversation comme lue */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: number) =>
      conversationApi.markAsRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

/** Envoyer un message dans une conversation */
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      content,
      contentHtml,
    }: {
      conversationId: number;
      content: string;
      contentHtml?: string;
    }) => conversationApi.sendMessage(conversationId, { content, contentHtml }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
