import apiClient from '../apiClient';

/**
 * Couche API des systèmes de design réutilisables (direction : tokens `--bt-*` + `DESIGN.md` prose).
 * Miroir de `DesignSystemDto`. Création multi-sources (MANUAL / BRAND / PASTE / URL) — inspiré d'open-design.
 */

export interface DesignSystem {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  status: string;
  /** Map JSON des tokens `--bt-*`. */
  tokensJson: string | null;
  /** Le DESIGN.md (prose de direction). */
  designMarkdown: string | null;
  sourceType: string | null;
  sourceRef: string | null;
  /** GLOBAL (catalogue Baitly) | ORG (privé). */
  scope: string;
  organizationId: number | null;
  createdAt: string;
}

export type DesignSystemSource = 'MANUAL' | 'BRAND' | 'PASTE' | 'URL';

export interface DesignSystemCreateRequest {
  name: string;
  category?: string;
  description?: string;
  /** "GLOBAL" (staff plateforme) | "ORG" (défaut). */
  scope?: string;
  /** Optionnel : le backend dérive la source des champs fournis (il combine tout le contexte). */
  sourceType?: DesignSystemSource;
  /** Description libre de la marque (voix, contexte). */
  brandDescription?: string;
  /** URL d'un site à analyser. */
  websiteUrl?: string;
  /** DESIGN.md collé. */
  designMarkdown?: string;
  /** Réglages manuels : map JSON des tokens `--bt-*` (appliqués APRÈS l'IA — priment). */
  tokensJson?: string;
}

export const designSystemsApi = {
  /** Systèmes visibles : catalogue global + ceux de l'org. */
  list: () => apiClient.get<DesignSystem[]>('/booking-engine/design-systems'),

  get: (id: number) => apiClient.get<DesignSystem>(`/booking-engine/design-systems/${id}`),

  /** Crée un système (source MANUAL / BRAND / PASTE / URL — les 3 dernières passent par l'IA). */
  create: (body: DesignSystemCreateRequest) =>
    apiClient.post<DesignSystem>('/booking-engine/design-systems', body),

  delete: (id: number) => apiClient.delete(`/booking-engine/design-systems/${id}`),
};
