import apiClient from '../apiClient';

/**
 * Génération IA de contenu pour une propriété (descriptions commerciales + meta SEO, fr/en/ar).
 * Mappe le PropertyContentAiController : POST /properties/{id}/ai/description|seo-meta.
 */

export interface GeneratedContent {
  /** "DESCRIPTION" ou "SEO_META". */
  kind: string;
  language: string;
  /** Titre SEO — null pour une description. */
  title: string | null;
  content: string;
}

export const propertyContentAiApi = {
  /** Génère une description commerciale du bien dans la langue demandée (ton optionnel). */
  generateDescription: (propertyId: number, language: string, tone?: string) =>
    apiClient.post<GeneratedContent>(`/properties/${propertyId}/ai/description`, null, {
      params: { language, ...(tone ? { tone } : {}) },
    }),

  /** Génère un titre SEO + meta description dans la langue demandée. */
  generateSeoMeta: (propertyId: number, language: string) =>
    apiClient.post<GeneratedContent>(`/properties/${propertyId}/ai/seo-meta`, null, {
      params: { language },
    }),
};
