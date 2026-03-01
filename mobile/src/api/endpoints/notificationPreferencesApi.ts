import { apiClient } from '../apiClient';

/** Map of NotificationKey name → enabled boolean */
export type NotificationPreferences = Record<string, boolean>;

export const notificationPreferencesApi = {
  /** Get all notification preferences for the authenticated user */
  getAll() {
    return apiClient.get<NotificationPreferences>('/notification-preferences');
  },

  /** Update notification preferences (partial or full map) */
  update(preferences: NotificationPreferences) {
    return apiClient.put<NotificationPreferences>('/notification-preferences', { preferences });
  },
};
