/**
 * Galerie de templates prêts à charger dans le Studio GrapesJS (modèle HTML+CSS).
 *
 * Chaque entrée est un design complet (HTML + CSS) injectable via `loadHtmlIntoEditor`. Le catalogue est
 * VIDE pour l'instant : on chargera des templates déjà conçus qu'on adaptera ensuite.
 *
 * CONVENTION (à respecter dans les templates ajoutés) : la section « logements » doit porter le marqueur
 *   <div data-clenzy-widget="booking"></div>
 * pour qu'à la publication / au rendu SSR le SDK Baitly l'hydrate avec les vrais logements
 * (cf. `bookingComponents`).
 */
export interface GalleryTemplate {
  /** Identifiant stable (en anglais), ex. `lodge`, `minimal`. */
  id: string;
  /** Libellé affiché dans la galerie. */
  name: string;
  /** Vignette d'aperçu (URL data:image ou chemin d'asset). Optionnelle (placeholder sinon). */
  thumbnail?: string;
  /** HTML du corps du template (sera assaini avant injection par `loadHtmlIntoEditor`). */
  html: string;
  /** CSS associé au template. */
  css: string;
}

/** Catalogue des templates de galerie. VIDE — à peupler avec des templates adaptés. */
export const GALLERY_TEMPLATES: GalleryTemplate[] = [];
