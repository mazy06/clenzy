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

  /** Met à jour les réglages du site (langues, thème, SEO…). Le corps doit inclure `slug` (NotBlank). */
  updateSite: (siteId: number, body: Partial<Site>) =>
    apiClient.put<Site>(`/sites/${siteId}`, body),

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

  // ─── Articles de blog (2.13) ──────────────────────────────────────────────
  listPosts: (siteId: number) =>
    apiClient.get<BlogPost[]>(`/sites/${siteId}/posts`),

  createPost: (siteId: number, body: BlogPostUpsert) =>
    apiClient.post<BlogPost>(`/sites/${siteId}/posts`, body),

  updatePost: (siteId: number, postId: number, body: BlogPostUpsert) =>
    apiClient.put<BlogPost>(`/sites/${siteId}/posts/${postId}`, body),

  deletePost: (siteId: number, postId: number) =>
    apiClient.delete(`/sites/${siteId}/posts/${postId}`),

  /** Valide et publie un article (2.13) : seule voie vers la mise en prod (relecture manuelle). */
  approvePost: (siteId: number, postId: number) =>
    apiClient.post<BlogPost>(`/sites/${siteId}/posts/${postId}/approve`),

  /** Renvoie un article en brouillon (corrections demandées). */
  rejectPost: (siteId: number, postId: number) =>
    apiClient.post<BlogPost>(`/sites/${siteId}/posts/${postId}/reject`),

  /** Génère un brouillon d'article de blog (IA) à partir d'un sujet libre (2.13). */
  generateArticle: (siteId: number, topic: string, locale?: string) =>
    apiClient.post<GeneratedArticle>(`/sites/${siteId}/blog/ai`, { topic, locale }),

  /** Traduit (IA) le texte d'un fragment HTML de page vers une langue cible (multi-langue, P2). */
  translateHtml: (siteId: number, body: { html: string; targetLocale: string }) =>
    apiClient.post<{ html: string }>(`/sites/${siteId}/translate-html`, body),
};

export interface GeneratedSeo {
  seoTitle: string | null;
  seoDescription: string | null;
}

/** Article de blog d'un site (P1.3 / 2.13). */
export interface BlogPost {
  id: number;
  siteId: number;
  slug: string;
  locale: string | null;
  title: string;
  excerpt: string | null;
  body: string | null;
  coverImageUrl: string | null;
  tags: string | null;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoOgImageUrl: string | null;
  publishedAt: string | null;
  /** Validation manuelle (2.13) : article issu d'une génération IA. */
  aiGenerated: boolean;
  /** Validation manuelle (2.13) : horodatage + relecteur (keycloakId) ayant publié. */
  reviewedAt: string | null;
  reviewedBy: string | null;
}

/** Corps create/update d'un article (id/siteId ignorés par le backend). */
export type BlogPostUpsert = Partial<BlogPost>;

/** Brouillon d'article généré par IA (2.13) — pré-remplit l'éditeur. */
export interface GeneratedArticle {
  title: string | null;
  excerpt: string | null;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}
