import type { SitePageType } from '../../../../../services/api/sitesApi';
import { BAITLY_JOURNEY_TEMPLATES } from './baitlyJourneyTemplates';
import type { BaitlyBookingJourneyId } from '../baitlyJourneyComposites';

/**
 * Galerie de templates NATIFS prêts à charger dans le Studio GrapesJS.
 *
 * Un template est MULTI-PAGE : il décrit chaque page (accueil + pages internes) en HTML+CSS pensés POUR
 * notre éditeur. À l'import (cf. `GrapesStudio.handleImportTemplate`), chaque page devient une `SitePage`
 * (via `useSitePages.importPages`), l'accueil est chargé dans le canvas, et le thème est appliqué à la
 * config. Rendu identique éditeur ↔ publication (le SSR clenzy-sites lit la même enveloppe `{html,css}`).
 *
 * MARQUEURS BOOKING — vocabulaire RUNTIME (hydraté par le SDK `BaitlyBooking.hydrate` ET prévisualisé
 * dans l'éditeur, cf. `bookingComponents`) :
 *   <div data-clenzy-widget="search"></div>   → barre de recherche (logements + dates + voyageurs + CTA)
 *   <div data-clenzy-widget="results"></div>  → grille des logements disponibles (cliquable)
 *   <div data-clenzy-widget="property"></div> → fiche du logement sélectionné
 *   <div data-clenzy-widget="confirmation"></div> → confirmation post-paiement (lit ?reservation)
 * Navigation template-driven via `data-clenzy-next` / `data-clenzy-return` (chemins de pages internes).
 */

/** Une page d'un template (HTML+CSS), normalisée en `SitePage` à l'import. */
export interface TemplatePage {
  /** Chemin de la page (l'accueil = `/`). */
  path: string;
  /** Type de page (l'accueil DOIT être `HOME`). */
  type: SitePageType;
  /** Titre affiché (onglet de page + nav). */
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  /** Corps HTML de la page (assaini avant injection). */
  html: string;
  /** CSS de la page (assaini avant injection). */
  css: string;
}

/** Un template complet de la galerie. */
export interface GalleryTemplate {
  /** Immutable master release recorded on each independently editable client fork. */
  version?: string;
  /** Identifiant stable (en anglais), ex. `conciergerie-marrakech`. */
  id: string;
  journeyId?: BaitlyBookingJourneyId;
  designVars?: Record<string, string>;
  /** Libellé affiché dans la galerie. */
  name: string;
  /** Sous-titre court (style / usage). */
  description?: string;
  /** Vignette d'aperçu (URL data:image ou chemin d'asset). Optionnelle (placeholder sinon). */
  thumbnail?: string;
  /** Thème appliqué à la config à l'import (couleur de marque + polices corps/titres). */
  theme?: { primaryColor?: string; fontFamily?: string; headingFontFamily?: string };
  /** Pages du template (la 1re entrée `type:'HOME'` est chargée dans le canvas). */
  pages: TemplatePage[];
}

/** Native Baitly templates, composed for each supported booking journey. */
export const GALLERY_TEMPLATES: GalleryTemplate[] = BAITLY_JOURNEY_TEMPLATES;
