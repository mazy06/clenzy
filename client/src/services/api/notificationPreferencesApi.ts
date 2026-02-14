import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationPreferencesMap = Record<string, boolean>;

// ─── API ─────────────────────────────────────────────────────────────────────

export const notificationPreferencesApi = {
  /**
   * Retourne toutes les preferences de notification de l'utilisateur connecte.
   * Map: NotificationKey -> enabled (boolean)
   */
  getAll() {
    return apiClient.get<NotificationPreferencesMap>('/notification-preferences');
  },

  /**
   * Met a jour les preferences de notification (upsert).
   * Seules les cles presentes dans la map sont modifiees.
   */
  update(preferences: NotificationPreferencesMap) {
    return apiClient.put<NotificationPreferencesMap>('/notification-preferences', { preferences });
  },
};
