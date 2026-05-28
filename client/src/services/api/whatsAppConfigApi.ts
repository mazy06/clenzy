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

/**
 * Status de la session OpenWA, normalise cote backend depuis les valeurs
 * variables de whatsapp-web.js (QR / QRCODE / SCAN_QR_CODE / CONNECTED / etc).
 *
 * - `qr_pending` : QR code disponible, attend que l'user scanne
 * - `connected` : session active, on peut envoyer
 * - `disconnected` : session existe mais pas (encore) connectee
 * - `failed` : auth failure cote WhatsApp (compte banni / 2FA / etc.)
 * - `not_configured` : pas de session OpenWA pour cette org
 */
export type OpenWaStatus =
  | 'qr_pending'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'not_configured';

export interface OpenWaStatusResponse {
  status: OpenWaStatus;
  sessionId?: string;
  phoneNumber?: string;
}

export interface OpenWaQrResponse {
  qr: string; // data:image/png;base64,...
  sessionId: string;
}

export interface OpenWaSessionCreateResponse {
  sessionId: string;
  status: 'qr_pending';
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

  // ─── OpenWA QR scan flow (Phase 4b) ────────────────────────────────

  /**
   * Cree une session OpenWA per-org sur l'instance partagee + persist les
   * credentials chiffres. Le frontend devra ensuite appeler getOpenWaQr()
   * et poller getOpenWaStatus() pour suivre le scan.
   */
  async createOpenWaSession(): Promise<OpenWaSessionCreateResponse> {
    return await apiClient.post<OpenWaSessionCreateResponse>('/whatsapp/openwa/session', {});
  },

  /**
   * Recupere l'image QR code (base64) a afficher dans le Dialog modal.
   * Peut throw 404 si la session est deja connectee (plus de QR a montrer)
   * ou 503 si l'instance OpenWA est injoignable.
   */
  async getOpenWaQr(): Promise<OpenWaQrResponse> {
    return await apiClient.get<OpenWaQrResponse>('/whatsapp/openwa/qr');
  },

  /**
   * Polling status connexion OpenWA. A appeler toutes les 2s tant que le
   * Dialog QR est ouvert. Stopper le polling quand status devient
   * `connected` ou `failed` (etat terminal).
   */
  async getOpenWaStatus(): Promise<OpenWaStatusResponse> {
    return await apiClient.get<OpenWaStatusResponse>('/whatsapp/openwa/status');
  },

  /**
   * Detruit la session cote OpenWA + reset les credentials cote DB.
   * Utile pour repartir d'un etat propre si le scan a echoue ou si l'user
   * veut changer de numero WhatsApp.
   */
  async deleteOpenWaSession(): Promise<void> {
    await apiClient.delete<void>('/whatsapp/openwa/session');
  },
};
