import { DESIGN_PRESETS, type DesignPreset } from '../constants';
import type { BlockType, BlockProps } from './builder/blockRegistry';

/**
 * Templates de site hébergé : un thème (preset existant) + une composition de blocs avec une
 * copy adaptée → des designs réellement distincts pour la page publique. Le « custom » reste
 * le builder (page vierge + édition libre). Appliqués depuis le Studio ou à la création.
 */

export interface SiteTemplateBlock {
  type: BlockType;
  props: BlockProps;
}

export interface SiteTemplate {
  id: string;
  label: string;
  description: string;
  preset: DesignPreset;
  blocks: SiteTemplateBlock[];
}

const preset = (id: string): DesignPreset =>
  DESIGN_PRESETS.find((p) => p.id === id) ?? DESIGN_PRESETS[0];

const footer = (text: string): SiteTemplateBlock => ({ type: 'footer', props: { text } });
const propertyGrid = (heading: string, subheading: string): SiteTemplateBlock =>
  ({ type: 'propertyGrid', props: { heading, subheading, columns: 3 } });

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: 'lodge',
    label: 'Lodge nature',
    description: 'Chaleureux, immersif — idéal maisons de campagne & nature.',
    preset: preset('safari-lodge'),
    blocks: [
      { type: 'hero', props: { eyebrow: 'Évasion nature', title: 'Votre refuge, loin du tumulte', subtitle: 'Des séjours d’exception au plus près de la nature.', showSearch: true } },
      { type: 'amenities', props: { heading: 'Tout le confort, en pleine nature', items: 'Wi-Fi fibre\nCheminée\nTerrasse privative\nParking gratuit\nCuisine équipée\nAnimaux bienvenus' } },
      propertyGrid('Nos logements', 'Une sélection prête à réserver.'),
      { type: 'testimonial', props: { quote: 'Un cadre magique et un accueil parfait. On reviendra sans hésiter.', author: 'Camille D., Lyon' } },
      { type: 'cta', props: { title: 'Prêt pour une parenthèse nature ?', buttonLabel: 'Voir les disponibilités' } },
      footer('© Votre conciergerie — Réservation directe sécurisée'),
    ],
  },
  {
    id: 'minimal',
    label: 'Épuré',
    description: 'Sobre et direct — la réservation au premier plan.',
    preset: preset('stripe-minimal'),
    blocks: [
      { type: 'hero', props: { eyebrow: '', title: 'Réservez en toute simplicité', subtitle: 'Sans frais cachés, en quelques clics.', showSearch: true } },
      propertyGrid('Disponibilités', ''),
      footer('© Votre conciergerie'),
    ],
  },
  {
    id: 'seaside',
    label: 'Bord de mer',
    description: 'Lumineux, aéré — locations balnéaires.',
    preset: preset('ocean-breeze'),
    blocks: [
      { type: 'hero', props: { eyebrow: 'Front de mer', title: 'Réveillez-vous face à l’océan', subtitle: 'Vue mer, pieds dans l’eau, souvenirs garantis.', showSearch: true } },
      propertyGrid('Nos adresses bord de mer', 'Vue mer et pieds dans l’eau.'),
      { type: 'amenities', props: { heading: 'Les essentiels du séjour', items: 'Vue mer\nPiscine\nClimatisation\nWi-Fi\nParking\nAccès plage' } },
      { type: 'cta', props: { title: 'Votre prochaine escapade balnéaire', buttonLabel: 'Réserver maintenant' } },
      footer('© Votre conciergerie — Réservation directe'),
    ],
  },
  {
    id: 'urban',
    label: 'Urbain',
    description: 'Contemporain, contrasté — appartements en ville.',
    preset: preset('urban-chic'),
    blocks: [
      { type: 'hero', props: { eyebrow: 'City break', title: 'Le cœur de la ville à votre porte', subtitle: 'Des appartements design, idéalement situés.', showSearch: true } },
      propertyGrid('Nos appartements', 'Au centre de tout.'),
      { type: 'testimonial', props: { quote: 'Emplacement parfait et appartement impeccable. Rien à redire.', author: 'Marc T., Paris' } },
      footer('© Votre conciergerie'),
    ],
  },
  {
    id: 'riad',
    label: 'Riad / Art de vivre',
    description: 'Élégant et chaleureux — riads, maisons d’hôtes, MENA.',
    preset: preset('provencal'),
    blocks: [
      { type: 'hero', props: { eyebrow: 'Art de vivre', title: 'Séjournez au cœur de l’authenticité', subtitle: 'Le charme d’un lieu unique, le confort moderne.', showSearch: true } },
      { type: 'amenities', props: { heading: 'Une hospitalité d’exception', items: 'Patio & fontaine\nPetit-déjeuner inclus\nClimatisation\nWi-Fi\nConciergerie\nHammam' } },
      propertyGrid('Nos maisons', 'Chaque lieu raconte une histoire.'),
      { type: 'testimonial', props: { quote: 'Un véritable havre de paix, un accueil aux petits soins.', author: 'Sofia R., Marrakech' } },
      { type: 'cta', props: { title: 'Vivez l’expérience', buttonLabel: 'Découvrir les disponibilités' } },
      footer('© Votre conciergerie — Réservation directe'),
    ],
  },
  {
    id: 'nordic',
    label: 'Nordique',
    description: 'Minimal et apaisant — esprit hygge.',
    preset: preset('nordic'),
    blocks: [
      { type: 'hero', props: { eyebrow: 'Hygge', title: 'Confort scandinave, simplicité absolue', subtitle: 'Des intérieurs apaisants pour se ressourcer.', showSearch: true } },
      propertyGrid('Nos logements', 'Le confort, sans le superflu.'),
      { type: 'amenities', props: { heading: 'Pensé pour le bien-être', items: 'Lumière naturelle\nLinge premium\nWi-Fi\nCuisine équipée\nChauffage au sol' } },
      footer('© Votre conciergerie'),
    ],
  },
];

/** Blocs de template pour un preset donné (utilisé à la création depuis la galerie). */
export function templateBlocksForPreset(presetId: string): SiteTemplateBlock[] | null {
  const tpl = SITE_TEMPLATES.find((t) => t.preset.id === presetId);
  return tpl ? tpl.blocks : null;
}
