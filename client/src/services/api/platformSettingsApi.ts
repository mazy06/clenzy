import apiClient from '../apiClient';

export interface PlatformSettings {
  sendProspectDevisEmails: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Réglages plateforme Baitly — réservés aux SUPER_ADMIN / SUPER_MANAGER. */
export const platformSettingsApi = {
  get(): Promise<PlatformSettings> {
    return apiClient.get<PlatformSettings>('/admin/platform-settings');
  },
  setProspectDevisEmails(enabled: boolean): Promise<{ sendProspectDevisEmails: boolean }> {
    return apiClient.put('/admin/platform-settings/prospect-devis-emails', undefined, {
      params: { enabled },
    });
  },
};
