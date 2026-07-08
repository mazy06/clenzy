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
  /** Dates de séjour si rattachée à une réservation (titre « Logement · Dates · Guest »). */
  checkIn: string | null;
  checkOut: string | null;
  /** Identifiant externe : numéro brut pour WhatsApp (formaté à l'affichage). */
  externalConversationId: string | null;
  /** Concierge IA : brouillon de réponse à valider (null si aucun). */
  aiDraftReply: string | null;
  /** Méta du brouillon (JSON : sentiment, urgence, ton…). */
  aiDraftMeta: string | null;
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

  /** Changer le statut (OPEN / CLOSED / ARCHIVED) — archive/restaure une conversation OTA */
  updateStatus: (conversationId: number, status: string): Promise<ConversationDto> =>
    apiClient.put(`${BASE}/${conversationId}/status`, { status }),

  /** Compteur de conversations non-lues */
  getUnreadCount: (): Promise<{ count: number }> =>
    apiClient.get(`${BASE}/unread-count`),

  /** Envoyer un message dans une conversation */
  sendMessage: (
    conversationId: number,
    data: { content: string; contentHtml?: string },
  ): Promise<ConversationMessageDto> =>
    apiClient.post(`${BASE}/${conversationId}/messages`, data),

  /** Rattache une conversation « à trier » à une réservation (+ mémorise le numéro WhatsApp sur le guest). */
  attachToReservation: (
    conversationId: number,
    reservationId: number,
    memorizePhone = true,
  ): Promise<ConversationDto> =>
    apiClient.put(`${BASE}/${conversationId}/attach`, { reservationId, memorizePhone }),

  /** Envoie un template WhatsApp (rendu) sur la conversation — fonctionne dans et hors 24h. */
  sendTemplate: (conversationId: number, templateKey: string): Promise<ConversationDto> =>
    apiClient.post(`${BASE}/${conversationId}/send-template`, { templateKey }),

  /** Envoi proactif d'un template WhatsApp depuis une réservation (crée la conversation au besoin). */
  sendTemplateForReservation: (reservationId: number, templateKey: string): Promise<ConversationDto> =>
    apiClient.post(`${BASE}/reservation/${reservationId}/send-template`, { templateKey }),

  /** Concierge IA : valide et envoie le brouillon suggéré au guest. */
  sendAiDraft: (conversationId: number): Promise<ConversationDto> =>
    apiClient.post(`${BASE}/${conversationId}/ai-draft/send`),

  /** Concierge IA : rejette le brouillon (sans envoi). */
  dismissAiDraft: (conversationId: number): Promise<ConversationDto> =>
    apiClient.post(`${BASE}/${conversationId}/ai-draft/dismiss`),
};
