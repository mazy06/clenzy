import apiClient from '../apiClient';

/**
 * Provider WhatsApp actif pour une organisation.
 *
 * - `META` : Meta Cloud API officielle (graph.facebook.com v18.0). Default
 *   historique, conforme ToS, features completes mais payant.
 * - `OPENWA` : Instance OpenWA self-hosted (whatsapp-web.js + Puppeteer).
 *   Gratuit, setup ultra-rapide (QR), mais HORS ToS Meta.
 */
export type WhatsAppProviderType = 'META' | 'OPENWA';

/**
 * Vue de la config WhatsApp expose par le backend. Aucun secret n'est
 * inclus (apiToken Meta + openwaApiKey OpenWA chiffres en base, jamais
 * renvoyes en clair). Le frontend a juste les booleens `hasApiToken` /
 * `hasOpenwaApiKey` pour savoir s'ils sont deja remplis.
 */
export interface WhatsAppConfig {
  id: number | null;
  provider: WhatsAppProviderType;
  // Meta
  phoneNumberId: string | null;
  businessAccountId: string | null;
  hasApiToken: boolean;
  // OpenWA
  openwaSessionId: string | null;
  hasOpenwaApiKey: boolean;
  // Common
  enabled: boolean;
}

/**
 * Patch request : tous les champs sont optionnels (undefined = ne pas
 * toucher). Les champs Meta restent en base quand on bascule en OpenWA
 * (et reciproquement) — utile pour revenir en arriere sans re-saisir.
 */
export interface UpdateWhatsAppConfigRequest {
  provider?: WhatsAppProviderType;
  // Meta
  apiToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
  // OpenWA
  openwaSessionId?: string;
  openwaApiKey?: string;
  // Common
  enabled?: boolean;
}

export const whatsAppConfigApi = {
  /**
   * Recupere la config WhatsApp de l'org courante. Retourne `null` si pas
   * encore configuree (premiere fois sur la section).
   */
  async getConfig(): Promise<WhatsAppConfig | null> {
    try {
      return await apiClient.get<WhatsAppConfig>('/whatsapp/config');
    } catch (error: unknown) {
      // ApiError shape : { status, message, details } — cf. handleResponse
      // dans services/apiClient.ts. Pas wrapping axios-style, status direct.
      const status = (error as { status?: number })?.status;
      if (status === 404) return null; // Pas encore configure, normal
      throw error;
    }
  },

  /**
   * Update partiel de la config WhatsApp. Le backend fait un merge selectif :
   * seuls les champs non-undefined sont modifies. Cree la config si pas existante.
   */
  async updateConfig(patch: UpdateWhatsAppConfigRequest): Promise<WhatsAppConfig> {
    return await apiClient.put<WhatsAppConfig>('/whatsapp/config', patch);
  },
};
