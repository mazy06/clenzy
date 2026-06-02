import apiClient from '../apiClient';

export interface PlatformSettings {
  sendProspectDevisEmails: boolean;
  addDevisLeadsToWaitlist: boolean;
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
  setDevisLeadsToWaitlist(enabled: boolean): Promise<{ addDevisLeadsToWaitlist: boolean }> {
    return apiClient.put('/admin/platform-settings/devis-leads-to-waitlist', undefined, {
      params: { enabled },
    });
  },
};
