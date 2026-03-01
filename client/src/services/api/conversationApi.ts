import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConversationDto {
  id: number;
  guestId: number | null;
  guestName: string | null;
  propertyId: number | null;
  propertyName: string | null;
  reservationId: number | null;
  channel: string;
  status: string;
  subject: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  assignedToKeycloakId: string | null;
  unread: boolean;
  messageCount: number;
  createdAt: string;
}

export interface ConversationMessageDto {
  id: number;
  conversationId: number;
  direction: 'INBOUND' | 'OUTBOUND';
  channelSource: string;
  senderName: string;
  senderIdentifier: string | null;
  content: string;
  contentHtml: string | null;
  externalMessageId: string | null;
  deliveryStatus: string;
  sentAt: string;
  readAt: string | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/conversations';

export const conversationApi = {
  /** Inbox — optionnel : filtrer par channels (comma-separated) et status */
  getInbox: (params?: {
    channels?: string[];
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<ConversationDto>> => {
    const queryParams: Record<string, string | number | undefined> = {
      status: params?.status,
      page: params?.page,
      size: params?.size,
    };
    // Spring accepte channels=AIRBNB,BOOKING (comma-separated)
    if (params?.channels && params.channels.length > 0) {
      queryParams.channels = params.channels.join(',');
    }
    return apiClient.get(BASE, { params: queryParams });
  },

  /** Messages d'une conversation */
  getMessages: (
    conversationId: number,
    params?: { page?: number; size?: number },
  ): Promise<PageResponse<ConversationMessageDto>> =>
    apiClient.get(`${BASE}/${conversationId}/messages`, { params }),

  /** Marquer une conversation comme lue */
  markAsRead: (conversationId: number): Promise<void> =>
    apiClient.put(`${BASE}/${conversationId}/read`),

  /** Compteur de conversations non-lues */
  getUnreadCount: (): Promise<{ count: number }> =>
    apiClient.get(`${BASE}/unread-count`),

  /** Envoyer un message dans une conversation */
  sendMessage: (
    conversationId: number,
    data: { content: string; contentHtml?: string },
  ): Promise<ConversationMessageDto> =>
    apiClient.post(`${BASE}/${conversationId}/messages`, data),
};
