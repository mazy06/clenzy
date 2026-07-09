import apiClient from '../apiClient';

export interface PlatformSettings {
  sendProspectDevisEmails: boolean;
  addDevisLeadsToWaitlist: boolean;
  /** Destinataires des notifications internes (lead devis, copie devis, waitlist, maintenance). */
  internalNotificationEmails: string[];
  /** Adresse d'expédition (From) de la plateforme + nom d'affichage. */
  senderEmail: string;
  senderName: string;
  /** Masters concierge IA (pilotés en base, pris en compte à chaud). */
  conciergeDraftEnabled: boolean;
  conciergeAutosendEnabled: boolean;
  conciergeAutosendMinForfait: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Payload de mise à jour des masters concierge IA. */
export interface ConciergeSettingsUpdate {
  draftEnabled: boolean;
  autosendEnabled: boolean;
  minForfait: string;
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
  setInternalNotificationEmails(emails: string[]): Promise<{ internalNotificationEmails: string[] }> {
    return apiClient.put('/admin/platform-settings/internal-notification-emails', emails);
  },
  setSender(email: string, name: string): Promise<{ senderEmail: string; senderName: string }> {
    return apiClient.put('/admin/platform-settings/sender', { email, name });
  },
  setConcierge(
    payload: ConciergeSettingsUpdate,
  ): Promise<{ conciergeDraftEnabled: boolean; conciergeAutosendEnabled: boolean; conciergeAutosendMinForfait: string }> {
    return apiClient.put('/admin/platform-settings/concierge', payload);
  },
};
