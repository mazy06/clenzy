import { apiClient } from '../apiClient';

/* ─── Types ─── */

export type ConversationChannel = 'AIRBNB' | 'BOOKING' | 'WHATSAPP' | 'EMAIL' | 'SMS' | 'INTERNAL';
export type ConversationStatus = 'OPEN' | 'CLOSED' | 'ARCHIVED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export interface ConversationDto {
  id: number;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  propertyId: number | null;
  propertyName: string | null;
  reservationId: number | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  assignedToKeycloakId: string | null;
  assignedToName: string | null;
  lastMessageContent: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageDto {
  id: number;
  conversationId: number;
  content: string;
  direction: MessageDirection;
  senderName: string | null;
  senderKeycloakId: string | null;
  channel: ConversationChannel;
  metadata: Record<string, string> | null;
  createdAt: string;
}

export interface PaginatedMessages {
  content: ConversationMessageDto[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface UnreadCountResponse {
  count: number;
}

/* ─── API ─── */

export const conversationApi = {
  /** Get all conversations (optionally filtered by status) */
  getConversations(status?: ConversationStatus) {
    return apiClient.get<ConversationDto[]>('/conversations', {
      params: status ? { status } : undefined,
    });
  },

  /** Get conversations assigned to the current user */
  getMyConversations() {
    return apiClient.get<ConversationDto[]>('/conversations/mine');
  },

  /** Get a single conversation by ID */
  getConversation(id: number) {
    return apiClient.get<ConversationDto>(`/conversations/${id}`);
  },

  /** Get paginated messages for a conversation */
  getMessages(conversationId: number, page = 0, size = 20) {
    return apiClient.get<PaginatedMessages>(`/conversations/${conversationId}/messages`, {
      params: { page, size },
    });
  },

  /** Send an outbound message in a conversation */
  sendMessage(conversationId: number, content: string) {
    return apiClient.post<ConversationMessageDto>(`/conversations/${conversationId}/messages`, {
      content,
    });
  },

  /** Mark a conversation as read */
  markAsRead(conversationId: number) {
    return apiClient.put<void>(`/conversations/${conversationId}/read`);
  },

  /** Assign a conversation to a team member */
  assignConversation(conversationId: number, keycloakId: string) {
    return apiClient.put<ConversationDto>(`/conversations/${conversationId}/assign`, null, {
      params: { keycloakId },
    });
  },

  /** Update conversation status */
  updateStatus(conversationId: number, status: ConversationStatus) {
    return apiClient.put<ConversationDto>(`/conversations/${conversationId}/status`, null, {
      params: { status },
    });
  },

  /** Get unread conversation count */
  getUnreadCount() {
    return apiClient.get<UnreadCountResponse>('/conversations/unread-count');
  },
};
