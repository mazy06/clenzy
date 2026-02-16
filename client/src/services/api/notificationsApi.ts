import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'intervention' | 'service_request' | 'payment' | 'system' | 'team' | 'contact';
  notificationKey?: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}

// TODO: Remplacer le polling HTTP par une consommation Kafka (WebSocket/SSE côté frontend)
// pour recevoir les notifications en temps réel via un topic Kafka dédié.
// Cela éliminera le besoin de polling et réduira la charge sur le backend.

// ─── API ─────────────────────────────────────────────────────────────────────

export const notificationsApi = {
  /** Track whether the backend endpoints are available */
  _endpointAvailable: true,

  getAll() {
    if (!this._endpointAvailable) return Promise.resolve([] as Notification[]);
    return apiClient.get<Notification[]>('/notifications').catch(() => {
      this._endpointAvailable = false;
      return [] as Notification[];
    });
  },
  getUnreadCount() {
    if (!this._endpointAvailable) return Promise.resolve({ count: 0 } as UnreadCountResponse);
    return apiClient.get<UnreadCountResponse>('/notifications/unread-count').catch(() => {
      this._endpointAvailable = false;
      return { count: 0 } as UnreadCountResponse;
    });
  },
  markAsRead(id: number) {
    if (!this._endpointAvailable) return Promise.resolve(undefined);
    return apiClient.patch<Notification>(`/notifications/${id}/read`).catch(() => undefined);
  },
  markAllAsRead() {
    if (!this._endpointAvailable) return Promise.resolve(undefined);
    return apiClient.patch<void>('/notifications/read-all').catch(() => undefined);
  },
  delete(id: number) {
    if (!this._endpointAvailable) return Promise.resolve(undefined);
    return apiClient.delete(`/notifications/${id}`).catch(() => undefined);
  },
  /** Reset availability flag (call when user navigates to notifications page or retry) */
  resetAvailability() {
    this._endpointAvailable = true;
  },
};
