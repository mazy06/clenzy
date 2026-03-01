import { apiClient } from '../apiClient';

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  category: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}

export const notificationsApi = {
  getAll() {
    return apiClient.get<Notification[]>('/notifications');
  },

  getUnreadCount() {
    return apiClient.get<UnreadCountResponse>('/notifications/unread-count');
  },

  markAsRead(id: number) {
    return apiClient.patch(`/notifications/${id}/read`);
  },

  markAllAsRead() {
    return apiClient.patch('/notifications/read-all');
  },

  dismiss(id: number) {
    return apiClient.delete(`/notifications/${id}`);
  },
};
