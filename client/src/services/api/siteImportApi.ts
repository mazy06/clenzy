import apiClient from '../apiClient';
import { sitesApi } from './sitesApi';

/**
 * Import « depuis URL » du Studio booking engine.
 *
 * Le client envoie l'URL saisie par l'utilisateur ; le SERVEUR effectue le fetch (HTTPS only +
 * anti-SSRF : blocage RFC 1918, résolution DNS, etc. — cf. règle sécurité #5) puis renvoie le HTML,
 * le CSS et les assets extraits du document. Aucun fetch cross-origin n'est fait côté navigateur
 * (CORS + SSRF).
 *
 * L'endpoint backend est ownership-gaté par SITE (`POST /api/sites/{siteId}/import-url`, cf.
 * `SiteImportController`). Le Studio ne connaît que la `config` (id = configId) ; on résout donc
 * d'abord le site rattaché à la config via `sitesApi.ensureForConfig(configId)` (find-or-create,
 * même précédent que le reste du Studio multi-page), puis on appelle l'import sur ce `siteId`.
 */

export interface SiteImportUrlRequest {
  /** URL publique à importer (validée HTTPS côté client, ré-validée + fetchée côté serveur). */
  url: string;
  /**
   * Id de la config courante du widget. Sert à résoudre le site cible (scope org + ownership) :
   * requis pour câbler l'import sur la bonne ressource. Optionnel à l'appel (la commande GrapesJS
   * peut être déclenchée sans config), mais l'import échoue alors faute de site à cibler.
   */
  configId?: number;
}

export interface SiteImportUrlResponse {
  /** HTML du corps extrait (déjà assaini côté serveur ; ré-assaini côté client avant injection). */
  html: string;
  /** CSS associé (feuilles liées + styles inline agrégés), ou chaîne vide. */
  css: string;
  /** URLs absolues dédupliquées des assets référencés (images, vidéos…) — informatif pour l'éditeur. */
  assets: string[];
}

/** Corps réellement attendu par le backend : l'URL seule (le siteId est dans le chemin). */
interface ImportUrlBody {
  url: string;
}

export const siteImportApi = {
  /**
   * Résout le site de la config puis POST /api/sites/{siteId}/import-url. Renvoie { html, css, assets }.
   * @throws si `configId` est absent (aucun site cible → import impossible).
   */
  importFromUrl: async (payload: SiteImportUrlRequest, signal?: AbortSignal): Promise<SiteImportUrlResponse> => {
    if (payload.configId == null) {
      throw new Error("Configuration introuvable : impossible de cibler le site à alimenter.");
    }
    const site = await sitesApi.ensureForConfig(payload.configId);
    return apiClient.post<SiteImportUrlResponse>(
      `/sites/${site.id}/import-url`,
      { url: payload.url } satisfies ImportUrlBody,
      { signal },
    );
  },
};
