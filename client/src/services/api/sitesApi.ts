import apiClient from '../apiClient';

/**
 * Couche API des sites hébergés (P1.1 / multi-page 2.2). Le Studio édite la composition par
 * PAGE (`SitePage.blocks`, même format JSON que le builder) ; le service SSR (`clenzy-sites`)
 * consomme ces pages. `ensureForConfig` fait le find-or-create du site rattaché à une config de
 * widget + migre le `pageLayout` mono-page en page d'accueil (cf. SiteAdminController).
 */

export interface Site {
  id: number;
  bookingEngineConfigId: number | null;
  slug: string;
  name: string;
  status: string;
  defaultLocale: string;
  locales: string;
  designTokens: string | null;
  primaryColor: string | null;
  fontFamily: string | null;
  logoUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoOgImageUrl: string | null;
}

/** Type de page (miroir de `SitePageType` côté backend). */
export type SitePageType = 'HOME' | 'PROPERTY_LIST' | 'PROPERTY_DETAIL' | 'BLOG' | 'CUSTOM';

export interface SitePage {
  id: number;
  siteId: number;
  path: string;
  type: SitePageType;
  title: string | null;
  /** Composition par blocs (JSON) — même format que le builder du Studio. */
  blocks: string | null;
  locale: string | null;
  status: string;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  seoOgImageUrl: string | null;
  /** Draft/Live (2.7) — lecture seule. Date de dernière publication (ISO) ou null si jamais publiée. */
  publishedAt: string | null;
  /** Draft/Live (2.7) — lecture seule. Le brouillon `blocks` diffère de l'instantané publié. */
  dirty: boolean;
}

/** Corps create/update d'une page (id/siteId ignorés par le backend). */
export type SitePageUpsert = Partial<SitePage>;

export const sitesApi = {
  /** Find-or-create du site lié à la config + migration du pageLayout en page d'accueil. */
  ensureForConfig: (configId: number) =>
    apiClient.post<Site>(`/sites/ensure-for-config/${configId}`),

  listPages: (siteId: number) =>
    apiClient.get<SitePage[]>(`/sites/${siteId}/pages`),

  createPage: (siteId: number, body: SitePageUpsert) =>
    apiClient.post<SitePage>(`/sites/${siteId}/pages`, body),

  updatePage: (siteId: number, pageId: number, body: SitePageUpsert) =>
    apiClient.put<SitePage>(`/sites/${siteId}/pages/${pageId}`, body),

  deletePage: (siteId: number, pageId: number) =>
    apiClient.delete(`/sites/${siteId}/pages/${pageId}`),

  /** Publie une page (2.7) : fige le brouillon courant dans la version servie au public. */
  publishPage: (siteId: number, pageId: number) =>
    apiClient.post<SitePage>(`/sites/${siteId}/pages/${pageId}/publish`),

  /** Génère un titre + meta SEO (IA) pour une page à partir de son contenu (2.13). */
  generatePageSeo: (siteId: number, pageId: number): Promise<GeneratedSeo> =>
    apiClient.post<GeneratedSeo>(`/sites/${siteId}/pages/${pageId}/ai/seo`),
};

export interface GeneratedSeo {
  seoTitle: string | null;
  seoDescription: string | null;
}
