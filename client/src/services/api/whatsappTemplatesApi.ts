import apiClient from '../apiClient';
import type { TemplateVariable } from './guestMessagingApi';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Contenu d'un template WhatsApp pour 1 langue donnee.
 *
 * <p>Le serveur retourne ce DTO avec les variables extraites du body (parsing
 * cote serveur, evite la duplication du regex dans le frontend).</p>
 */
export interface WhatsAppTemplateContent {
  /** ID DB. Null si pas encore persiste (cas template systeme jamais override). */
  id: number | null;
  /** Null = template systeme global, defini = override per-org. */
  organizationId: number | null;
  /** Cle logique stable, ex: "checkin_instructions". */
  templateKey: string;
  /** Locale Meta : fr_FR, en_US, ar_AR. */
  language: string;
  /** Categorie Meta : UTILITY | MARKETING | AUTHENTICATION. */
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  /** Body au format nomme editable : "Bonjour {guestFirstName} ...". */
  bodyNamed: string;
  /** True = template systeme (read-only pour l'org). */
  isSystem: boolean;
  /** Si override, pointe vers le template systeme parent. */
  parentTemplateId: number | null;
  /** Nom Meta (clenzy_xxx_v1) si soumis cote Meta. */
  metaTemplateName: string | null;
  /** PENDING | APPROVED | REJECTED | PAUSED | null. */
  metaApprovalStatus: string | null;
  /** Liste ordonnee des variables {nameVar} extraites du body (parsing serveur). */
  variables: string[];
  /** ISO 8601, sert au cache busting. */
  updatedAt: string | null;
}

/**
 * Groupe : 1 templateKey + ses 3 langues (fr_FR, en_US, ar_AR).
 *
 * <p>Format pratique pour l'UI : 1 ligne par template-concept dans la liste,
 * 3 onglets/colonnes pour les langues dans l'editeur.</p>
 */
export interface WhatsAppTemplateGroup {
  templateKey: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  /** True si l'org a customise au moins 1 des 3 langues. Sert au badge "Personnalise". */
  isCustomized: boolean;
  /** Map locale → contenu. Generalement 3 entries (fr_FR, en_US, ar_AR). */
  languages: Record<string, WhatsAppTemplateContent>;
}

export interface UpsertOverridePayload {
  bodyNamed: string;
}

export interface PreviewPayload {
  /** Valeurs mock pour les variables. Cles = noms des variables sans accolades. */
  mockValues: Record<string, string>;
}

export interface PreviewResponse {
  /** Body apres substitution. Variables non fournies sont laissees telles quelles. */
  renderedBody: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/whatsapp-templates';

export const whatsappTemplatesApi = {
  /**
   * Liste TOUS les templates visibles par l'org courante, groupes par cle
   * logique. Les overrides per-org masquent les systeme avec meme cle/langue.
   */
  list: (): Promise<WhatsAppTemplateGroup[]> => apiClient.get(BASE),

  /**
   * Detail d'un template (3 langues). 404 si la cle est inconnue.
   */
  getByKey: (key: string): Promise<WhatsAppTemplateGroup> =>
    apiClient.get(`${BASE}/${encodeURIComponent(key)}`),

  /**
   * Cree ou met a jour un override per-org pour une langue. Si pas d'override
   * existant → fork du systeme. Sinon → update body.
   */
  upsertOverride: (
    key: string,
    language: string,
    payload: UpsertOverridePayload,
  ): Promise<WhatsAppTemplateContent> =>
    apiClient.put(`${BASE}/${encodeURIComponent(key)}/${encodeURIComponent(language)}`, payload),

  /**
   * Supprime l'override per-org → l'org retombe sur le defaut systeme. 404 si
   * pas d'override pour ce (key, language).
   */
  removeOverride: (key: string, language: string): Promise<void> =>
    apiClient.delete(`${BASE}/${encodeURIComponent(key)}/${encodeURIComponent(language)}`),

  /**
   * Preview : remplace les variables {nameVar} dans le body courant avec les
   * valeurs mock fournies. Variables non fournies = laissees telles quelles.
   */
  preview: (
    key: string,
    language: string,
    payload: PreviewPayload,
  ): Promise<PreviewResponse> =>
    apiClient.post(`${BASE}/${encodeURIComponent(key)}/${encodeURIComponent(language)}/preview`, payload),

  /**
   * Liste des variables supportees par le moteur d'interpolation Clenzy.
   * Memes variables que pour les templates email/SMS (TemplateInterpolationService).
   */
  getVariables: (): Promise<TemplateVariable[]> => apiClient.get(`${BASE}/variables`),
};
