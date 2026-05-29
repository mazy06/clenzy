import apiClient from '../apiClient';
import type { TemplateVariable } from './guestMessagingApi';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Contenu d'un template email systeme pour 1 langue donnee.
 *
 * <p>Aligne sur le DTO backend {@code SystemEmailTemplateDto}. Le serveur
 * retourne les variables {@code {nameVar}} extraites du subject + body pour
 * eviter de dupliquer le parsing cote client.</p>
 */
export interface SystemEmailTemplate {
  id: number | null;
  /** Null = template systeme global, defini = override per-org. */
  organizationId: number | null;
  /** Cle logique stable : "noise_alert_owner", "invitation_organization", etc. */
  templateKey: string;
  /** Locale ISO 639-1 : "fr", "en", "ar". */
  language: string;
  /** Destinataire : OWNER | GUEST | INTERNAL_TEAM | INVITED_USER. */
  recipientType: 'OWNER' | 'GUEST' | 'INTERNAL_TEAM' | 'INVITED_USER';
  /** Sujet de l'email (peut contenir des variables {nameVar}). Max 255 chars. */
  subject: string;
  /**
   * Corps PLAIN TEXT (max 100 KB). Le wrapper HTML est applique cote serveur
   * via EmailWrapperService avant l'envoi (cf. wrapperStyle).
   */
  body: string;
  /** True = template systeme (read-only pour l'org). */
  isSystem: boolean;
  /** Si override, pointe vers le template systeme parent. */
  parentTemplateId: number | null;
  /** Variables {nameVar} uniques extraites du subject + body, ordre apparition. */
  variables: string[];
  /** ISO 8601, sert au cache busting. */
  updatedAt: string | null;
}

/**
 * Groupe : 1 templateKey + ses langues (fr, en, ar).
 */
export interface SystemEmailTemplateGroup {
  templateKey: string;
  recipientType: 'OWNER' | 'GUEST' | 'INTERNAL_TEAM' | 'INVITED_USER';
  /** True si l'org a customise au moins 1 langue. */
  isCustomized: boolean;
  /** Map locale → contenu. */
  languages: Record<string, SystemEmailTemplate>;
}

export interface UpsertSystemEmailTemplatePayload {
  subject: string;
  body: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/system-email-templates';

export const systemEmailTemplatesApi = {
  list: (): Promise<SystemEmailTemplateGroup[]> => apiClient.get(BASE),

  getByKey: (key: string): Promise<SystemEmailTemplateGroup> =>
    apiClient.get(`${BASE}/${encodeURIComponent(key)}`),

  upsertOverride: (
    key: string,
    language: string,
    payload: UpsertSystemEmailTemplatePayload,
  ): Promise<SystemEmailTemplate> =>
    apiClient.put(`${BASE}/${encodeURIComponent(key)}/${encodeURIComponent(language)}`, payload),

  removeOverride: (key: string, language: string): Promise<void> =>
    apiClient.delete(`${BASE}/${encodeURIComponent(key)}/${encodeURIComponent(language)}`),

  getVariables: (): Promise<TemplateVariable[]> => apiClient.get(`${BASE}/variables`),
};
