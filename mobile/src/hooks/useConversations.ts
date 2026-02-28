import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  conversationApi,
  type ConversationDto,
  type ConversationStatus,
  type PaginatedMessages,
} from '@/api/endpoints/conversationApi';

const KEYS = {
  all: ['conversations'] as const,
  list: (status?: ConversationStatus) => ['conversations', 'list', status] as const,
  mine: () => ['conversations', 'mine'] as const,
  detail: (id: number) => ['conversations', 'detail', id] as const,
  messages: (id: number) => ['conversations', 'messages', id] as const,
  unreadCount: () => ['conversations', 'unread-count'] as const,
};

/** List all conversations, optionally filtered by status */
export function useConversations(status?: ConversationStatus) {
  return useQuery<ConversationDto[]>({
    queryKey: KEYS.list(status),
    queryFn: () => conversationApi.getConversations(status),
    staleTime: 30_000,
  });
}

/** List conversations assigned to the current user */
export function useMyConversations() {
  return useQuery<ConversationDto[]>({
    queryKey: KEYS.mine(),
    queryFn: () => conversationApi.getMyConversations(),
    staleTime: 30_000,
  });
}

/** Get a single conversation */
export function useConversation(id?: number) {
  return useQuery<ConversationDto>({
    queryKey: KEYS.detail(id!),
    queryFn: () => conversationApi.getConversation(id!),
    enabled: !!id,
  });
}

/** Paginated messages for a conversation (infinite scroll) */
export function useConversationMessages(conversationId?: number) {
  return useInfiniteQuery<PaginatedMessages>({
    queryKey: KEYS.messages(conversationId!),
    queryFn: ({ pageParam = 0 }) =>
      conversationApi.getMessages(conversationId!, pageParam as number, 20),
    getNextPageParam: (lastPage) =>
      lastPage.number < lastPage.totalPages - 1 ? lastPage.number + 1 : undefined,
    initialPageParam: 0,
    enabled: !!conversationId,
  });
}

/** Send a message in a conversation */
export function useSendConversationMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: number; content: string }) =>
      conversationApi.sendMessage(conversationId, content),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.messages(variables.conversationId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

/** Mark a conversation as read */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: number) => conversationApi.markAsRead(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

/** Assign a conversation to a team member */
export function useAssignConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, keycloakId }: { conversationId: number; keycloakId: string }) =>
      conversationApi.assignConversation(conversationId, keycloakId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

/** Update conversation status */
export function useUpdateConversationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, status }: { conversationId: number; status: ConversationStatus }) =>
      conversationApi.updateStatus(conversationId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

/** Get unread conversation count (polls every 30s) */
export function useUnreadConversationCount() {
  return useQuery({
    queryKey: KEYS.unreadCount(),
    queryFn: () => conversationApi.getUnreadCount(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
