import type { BlockType } from './blockRegistry';

/**
 * Catalogue des sélecteurs CSS ciblables (Phase C — design custom).
 * Source de vérité de la « structure exposée » : alimente le panneau « Sélecteurs » du Studio.
 * - `bkly-*` : classes des blocs de la page composée (voir blockStyles.css).
 * - `cb-*`   : classes du widget de réservation (Shadow DOM ; voir sdk/styles/*.css).
 * Co-localisé avec blockStyles.css : on ajoute un sélecteur ici quand on en expose un là-bas.
 */

export interface SelectorDef {
  /** Sélecteur exact, copiable tel quel dans l'éditeur CSS. */
  sel: string;
  /** Libellé humain (à quoi correspond l'élément). */
  label: string;
}

/** Sélecteurs des blocs de page, par type de bloc. */
export const BLOCK_SELECTORS: Record<BlockType, SelectorDef[]> = {
  hero: [
    { sel: '.bkly-hero', label: 'Bannière (section)' },
    { sel: '.bkly-hero__eyebrow', label: 'Sur-titre' },
    { sel: '.bkly-hero__title', label: 'Titre' },
    { sel: '.bkly-hero__subtitle', label: 'Accroche' },
    { sel: '.bkly-hero__search', label: 'Barre de recherche' },
    { sel: '.bkly-hero__search-btn', label: 'Bouton « Rechercher »' },
  ],
  propertyGrid: [
    { sel: '.bkly-property-grid', label: 'Grille (section)' },
    { sel: '.bkly-property-grid__heading', label: 'Titre' },
    { sel: '.bkly-property-card', label: 'Carte logement' },
    { sel: '.bkly-property-card__price', label: 'Prix' },
  ],
  amenities: [
    { sel: '.bkly-amenities', label: 'Équipements (section)' },
    { sel: '.bkly-amenities__heading', label: 'Titre' },
    { sel: '.bkly-amenities__item', label: 'Ligne d’équipement' },
    { sel: '.bkly-amenities__icon', label: 'Pastille d’icône' },
  ],
  richText: [
    { sel: '.bkly-rich-text', label: 'Texte (section)' },
    { sel: '.bkly-rich-text__content', label: 'Contenu' },
  ],
  testimonial: [
    { sel: '.bkly-testimonial', label: 'Témoignage (section)' },
    { sel: '.bkly-testimonial__quote', label: 'Citation' },
    { sel: '.bkly-testimonial__author', label: 'Auteur' },
  ],
  cta: [
    { sel: '.bkly-cta', label: 'CTA (section)' },
    { sel: '.bkly-cta__title', label: 'Titre' },
    { sel: '.bkly-cta__button', label: 'Bouton' },
  ],
  footer: [
    { sel: '.bkly-footer', label: 'Pied de page' },
  ],
};

/** Sélecteurs clés du widget de réservation (Shadow DOM). Sous-ensemble curé des classes réelles. */
export const WIDGET_SELECTORS: SelectorDef[] = [
  { sel: '.cb-widget', label: 'Widget (conteneur)' },
  { sel: '.cb-property-card', label: 'Carte propriété' },
  { sel: '.cb-property-card__name', label: 'Nom de la propriété' },
  { sel: '.cb-property-card__price', label: 'Prix de la propriété' },
  { sel: '.cb-calendar', label: 'Calendrier' },
  { sel: '.cb-calendar-day', label: 'Jour du calendrier' },
  { sel: '.cb-date-input', label: 'Champ de dates' },
  { sel: '.cb-guests-toggle', label: 'Sélecteur de voyageurs' },
  { sel: '.cb-price-summary', label: 'Récapitulatif du prix' },
  { sel: '.cb-price-total', label: 'Total' },
  { sel: '.cb-input', label: 'Champs du formulaire' },
  { sel: '.cb-cta', label: 'Bouton principal' },
  { sel: '.cb-currency-selector', label: 'Sélecteur de devise' },
];
