import apiClient from '../apiClient';
import { PaginatedResponse } from '../apiClient';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export interface ContactAttachment {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  contentType: string;
  storagePath?: string | null;
}

export interface ContactMessage {
  id: number;
  senderId: string;
  senderName?: string;
  recipientId: string;
  recipientName?: string;
  subject: string;
  message: string;
  priority: string;
  category: string;
  status: string;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  repliedAt?: string | null;
  archivedAt?: string | null;
  archived?: boolean;
  attachments?: ContactAttachment[];
}

/** Presence/online status of a user, served by /presence/{userId}. */
export interface UserPresence {
  userId: string;
  online: boolean;
  lastSeen: string | null;
}

export interface ContactFormData {
  recipientId: string;
  subject: string;
  message: string;
  priority: string;
  category: string;
  attachments?: string[];
}

export interface Recipient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface ContactThreadSummary {
  counterpartKeycloakId: string;
  /** Numeric (Long) id of the counterpart user — present when they exist in our DB. */
  counterpartUserId?: number | null;
  counterpartFirstName: string;
  counterpartLastName: string;
  counterpartEmail: string;
  /** Public URL of the counterpart's avatar; null when they have no photo. */
  counterpartProfilePictureUrl?: string | null;
  /** Used as cache-buster for the avatar URL. */
  counterpartUpdatedAt?: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  totalMessages: number;
}

export const contactApi = {
  /** Track whether the backend contact endpoints are available */
  _endpointAvailable: true,

  getRecipients() {
    if (!this._endpointAvailable) return Promise.resolve([] as Recipient[]);
    return apiClient.get<Recipient[]>('/contact/recipients').catch(() => {
      this._endpointAvailable = false;
      return [] as Recipient[];
    });
  },
  getMessages(type: 'inbox' | 'sent' | 'archived', params?: { page?: number; size?: number }) {
    if (!this._endpointAvailable) {
      return Promise.resolve({
        content: [], totalPages: 0, totalElements: 0, number: 0, size: params?.size ?? 10, first: true, last: true,
      } as PaginatedResponse<ContactMessage>);
    }
    return apiClient.get<PaginatedResponse<ContactMessage>>(`/contact/messages/${type}`, { params }).catch(() => {
      this._endpointAvailable = false;
      return {
        content: [], totalPages: 0, totalElements: 0, number: 0, size: params?.size ?? 10, first: true, last: true,
      } as PaginatedResponse<ContactMessage>;
    });
  },
  send(data: ContactFormData) {
    return apiClient.post<ContactMessage>('/contact/messages', data);
  },
  updateStatus(id: number, status: string) {
    return apiClient.put(`/contact/messages/${id}/status`, undefined, { params: { status } });
  },
  delete(id: number) {
    return apiClient.delete(`/contact/messages/${id}`);
  },
  bulkUpdateStatus(ids: number[], status: string) {
    return apiClient.put('/contact/messages/bulk/status', { ids, status });
  },
  bulkDelete(ids: number[]) {
    return apiClient.post('/contact/messages/bulk/delete', { ids });
  },
  archive(id: number) {
    return apiClient.put(`/contact/messages/${id}/archive`);
  },
  unarchive(id: number) {
    return apiClient.put(`/contact/messages/${id}/unarchive`);
  },
  reply(id: number, data: { message: string; attachments?: File[] }) {
    const formData = new FormData();
    formData.append('message', data.message);
    if (data.attachments) {
      data.attachments.forEach((file) => {
        formData.append('attachments', file);
      });
    }
    return apiClient.upload<ContactMessage>(`/contact/messages/${id}/reply`, formData);
  },
  /** Telecharger une piece jointe */
  async downloadAttachment(messageId: number, attachmentId: string, filename: string) {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/contact/messages/${messageId}/attachments/${attachmentId}`;
    const token = getAccessToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors du telechargement`);
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },
  /** Obtenir l'URL blob d'une piece jointe (pour affichage image) */
  async getAttachmentBlobUrl(messageId: number, attachmentId: string): Promise<string> {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/contact/messages/${messageId}/attachments/${attachmentId}`;
    const token = getAccessToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors du chargement`);
    }
    let blob = await response.blob();

    // Convert HEIC/HEIF to JPEG — browsers cannot display HEIC natively
    const type = blob.type?.toLowerCase() || '';
    if (type.includes('heic') || type.includes('heif')) {
      try {
        const heic2any = (await import('heic2any')).default;
        const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.92 });
        blob = Array.isArray(converted) ? converted[0] : converted;
      } catch {
        // Fallback: return original blob (will show broken image)
      }
    }

    return window.URL.createObjectURL(blob);
  },
  // ── Threads (messagerie instantanee) ──────────────────────────────────

  /** Liste des conversations groupees par interlocuteur */
  getThreads(): Promise<ContactThreadSummary[]> {
    return apiClient.get<ContactThreadSummary[]>('/contact/threads');
  },

  /** Messages d'une conversation avec un interlocuteur */
  getThreadMessages(counterpartKeycloakId: string): Promise<ContactMessage[]> {
    return apiClient.get<ContactMessage[]>(`/contact/threads/${counterpartKeycloakId}/messages`);
  },

  /** Marquer tous les messages non-lus d'un thread comme lus */
  markThreadAsRead(counterpartKeycloakId: string): Promise<{ updatedCount: number }> {
    return apiClient.put<{ updatedCount: number }>(`/contact/threads/${counterpartKeycloakId}/mark-read`);
  },

  /** Statut de presence d'un utilisateur (en ligne / dernière connexion). */
  getPresence(userId: string): Promise<UserPresence> {
    return apiClient.get<UserPresence>(`/presence/${userId}`);
  },

  /** Statut de presence de plusieurs utilisateurs en une requete. */
  getBulkPresence(userIds: string[]): Promise<UserPresence[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return apiClient.post<UserPresence[]>('/presence/bulk', { userIds });
  },

  /** Reset availability flag */
  resetAvailability() {
    this._endpointAvailable = true;
  },
};
