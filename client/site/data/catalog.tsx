import type { ComponentType } from 'react';
import {
  BanknoteIcon,
  BarChart3Icon,
  BookOpenIcon,
  BotIcon,
  BuildingIcon,
  CalendarDaysIcon,
  CameraIcon,
  ClipboardCheckIcon,
  FileSignatureIcon,
  GlobeIcon,
  HomeIcon,
  KeyRoundIcon,
  LandmarkIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react';

export interface ModuleDef {
  slug: string;
  icon: ComponentType<{ className?: string }>;
  /** Chiffre mis en avant. La VALEUR ne se traduit pas, son libelle si. */
  metricValue: string;
}

/**
 * Les neuf modules produit — alimentent le mega-menu Produit, le pied de page
 * et les pages dediees.
 *
 * <p>Seule la STRUCTURE vit ici. Le texte est en trois langues dans
 * `lib/messages/modules.ts` : le site se lit aussi en arabe, et un libelle en
 * dur ici rouvrirait la porte au francais au milieu d'une page arabe.</p>
 */
export const MODULES: ModuleDef[] = [
  { slug: 'pms-channel-manager', icon: CalendarDaysIcon, metricValue: '0' },
  { slug: 'booking-engine', icon: GlobeIcon, metricValue: '0 %' },
  { slug: 'livret-accueil', icon: BookOpenIcon, metricValue: '+15 %' },
  { slug: 'agents-ia', icon: BotIcon, metricValue: '100 %' },
  { slug: 'revenue-market-data', icon: BarChart3Icon, metricValue: '+12 %' },
  { slug: 'paiements-finances', icon: BanknoteIcon, metricValue: '4' },
  { slug: 'operations-menage', icon: WrenchIcon, metricValue: '100 %' },
  { slug: 'objets-connectes', icon: CameraIcon, metricValue: '3 h' },
  { slug: 'portail-proprietaire', icon: FileSignatureIcon, metricValue: '4' },
];

export interface SolutionDef {
  slug: string;
  icon: ComponentType<{ className?: string }>;
}

/** Ordre du menu Solutions : l'Arabie saoudite precede le Maroc — marche d'ouverture. */
export const SOLUTIONS: SolutionDef[] = [
  { slug: 'conciergeries', icon: BuildingIcon },
  { slug: 'hotes-independants', icon: HomeIcon },
  { slug: 'riads-maisons-dhotes', icon: KeyRoundIcon },
  { slug: 'arabie-saoudite', icon: MapPinIcon },
  { slug: 'maroc', icon: MapPinIcon },
  { slug: 'multi-proprietaires', icon: UsersIcon },
];

export interface PartnerDef {
  mono: string;
  name: string;
  color: string;
  copy: string;
  tag?: string;
  /** URL d'un vrai logo (déposé dans site/assets/brands) — sinon tuile monogramme. */
  logoUrl?: string;
  /** Service first-party Baitly : tuile = mark Baitly teinté à `color`. */
  baitly?: boolean;
  /**
   * Logo monochrome (simple-icons) rendu en masque CSS : la tuile prend `color`
   * en fond et le glyphe est peint en `glyph` (blanc par défaut). Réservé aux
   * SVG à tracé unique — les logos raster/multicolores gardent `logoUrl` seul.
   */
  mask?: boolean;
  /** Couleur du glyphe masqué, quand le blanc manque de contraste sur `color`. */
  glyph?: string;
}

import serviceChef from '../assets/services/chef.jpg';
import serviceConciergerie from '../assets/services/conciergerie.jpg';
import serviceJardin from '../assets/services/jardin.jpg';
import serviceMenage from '../assets/services/menage.jpg';

import gyg from '../assets/brands/pl-getyourguide.svg';
import viator from '../assets/brands/pl-viator.png';
import klook from '../assets/brands/pl-klook.png';
import civitatis from '../assets/brands/pl-civitatis.png';
import tiqets from '../assets/brands/pl-tiqets.png';
import musement from '../assets/brands/pl-musement.png';

/** Partenaires de la marketplace d'activités & expériences du livret d'accueil. */
export const GUIDE_PARTNERS: PartnerDef[] = [
  {
    mono: 'GYG',
    name: 'GetYourGuide',
    color: '#FF5533',
    copy: 'Marketplace mondiale d’activités',
    tag: '~15 % commission',
    logoUrl: gyg,
  },
  {
    mono: 'VI',
    name: 'Viator',
    color: '#1A8917',
    copy: 'Réseau TripAdvisor',
    tag: 'Affiliation',
    logoUrl: viator,
  },
  {
    mono: 'KL',
    name: 'Klook',
    color: '#FF5B00',
    copy: 'Focus Asie & Golfe (KSA)',
    tag: 'Configurable',
    logoUrl: klook,
  },
  {
    mono: 'CI',
    name: 'Civitatis',
    color: '#F5333F',
    copy: 'Visites guidées FR / ES',
    tag: 'Affiliation',
    logoUrl: civitatis,
  },
  {
    mono: 'TQ',
    name: 'Tiqets',
    color: '#FF4E00',
    copy: 'Billets musées & attractions',
    tag: 'Affiliation',
    logoUrl: tiqets,
  },
  {
    mono: 'MU',
    name: 'Musement',
    color: '#0A7EF2',
    copy: 'Expériences en Europe',
    tag: 'Affiliation',
    logoUrl: musement,
  },
];

/** Partenaires de services à domicile / conciergerie proposés dans le livret.
    Services first-party Baitly → tuile = mark Baitly teinté (couleur par service). */
export const SERVICE_PARTNERS: PartnerDef[] = [
  {
    mono: 'CH',
    name: 'Chef à domicile',
    color: '#B5651D',
    copy: 'Dîners privés & petits-déjeuners',
    baitly: true,
  },
  {
    mono: 'SP',
    name: 'Spa & massage',
    color: '#7A6A95',
    copy: 'Soins à domicile sur réservation',
    baitly: true,
  },
  {
    mono: 'TR',
    name: 'Transferts',
    color: '#2E6E8E',
    copy: 'Aéroport, gare, excursions privées',
    baitly: true,
  },
  {
    mono: 'MN',
    name: 'Ménage & linge',
    color: '#14B8A6',
    copy: 'Ménage en cours de séjour',
    baitly: true,
  },
];

import uber from '../assets/brands/si-uber.svg';
import tripadvisor from '../assets/brands/si-tripadvisor.svg';
import glovo from '../assets/brands/si-glovo.svg';
import deliveroo from '../assets/brands/si-deliveroo.svg';
import { SITE_PHOTOS } from './baitlyPhotography';

const {
  serviceLaundry: serviceBlanchisserie,
  serviceMaintenance: serviceMaintenance,
} = SITE_PHOTOS;

/**
 * Mur de logos partenaires — 3 lignes défilantes (pattern Mobbin) : chaque
 * ligne regroupe une famille de partenaires et défile en continu.
 * Ligne 3 = services opérés par Baitly (mark Baitly teinté), pas des tiers.
 */
export const MARKETPLACE_ROWS: PartnerDef[][] = [
  // Activités & billetterie — programmes d'affiliation ouverts.
  GUIDE_PARTNERS,
  // Transport, table & découverte.
  [
    {
      mono: 'UB',
      name: 'Uber',
      color: '#000000',
      copy: 'Course & transfert',
      logoUrl: uber,
      mask: true,
    },
    {
      mono: 'TA',
      name: 'Tripadvisor',
      color: '#34E0A1',
      copy: 'Avis & réservations',
      logoUrl: tripadvisor,
      mask: true,
      glyph: '#0B3B2E',
    },
    {
      mono: 'GL',
      name: 'Glovo',
      color: '#FFC244',
      copy: 'Livraison de repas & courses',
      logoUrl: glovo,
      mask: true,
      glyph: '#1F2937',
    },
    {
      mono: 'DL',
      name: 'Deliveroo',
      color: '#00CCBC',
      copy: 'Livraison de repas',
      logoUrl: deliveroo,
      mask: true,
    },
    {
      mono: 'TR',
      name: 'Transferts Baitly',
      color: '#2E6E8E',
      copy: 'Aéroport & excursions',
      baitly: true,
    },
    {
      mono: 'CH',
      name: 'Chef à domicile',
      color: '#B5651D',
      copy: 'Dîners privés',
      baitly: true,
    },
  ],
  // Services à domicile opérés par Baitly.
  [
    {
      mono: 'MN',
      name: 'Ménage & linge',
      color: '#14B8A6',
      copy: 'Ménage en cours de séjour',
      baitly: true,
    },
    {
      mono: 'SP',
      name: 'Spa & massage',
      color: '#7A6A95',
      copy: 'Soins à domicile',
      baitly: true,
    },
    {
      mono: 'BL',
      name: 'Blanchisserie',
      color: '#7BA3C2',
      copy: 'Collecte & livraison',
      baitly: true,
    },
    {
      mono: 'CO',
      name: 'Conciergerie',
      color: '#D4A574',
      copy: 'Assistance sur place',
      baitly: true,
    },
    {
      mono: 'BS',
      name: 'Baby-sitting',
      color: '#C97A7A',
      copy: 'Garde d’enfants',
      baitly: true,
    },
    {
      mono: 'CS',
      name: 'Livraison de courses',
      color: '#6FA96A',
      copy: 'Panier d’arrivée',
      baitly: true,
    },
  ],
];

/* ─── Marketplace prestataires ─────────────────────────────────────────────────
   Côté offre : les pros (ménage, maintenance, blanchisserie…) qui veulent vendre
   leurs services aux hôtes et conciergeries via Baitly. Alimente /prestataires. */

/**
 * Metiers proposables sur la marketplace prestataires : photo et couleur de
 * domaine. Les libelles vivent dans `lib/messages/providers.ts`, l'ordre est
 * le meme des deux cotes.
 *
 * <p>La photo a remplace l'icone : un pictogramme de chapeau de chef ne dit
 * pas ce qu'est le metier, une cuisine en service le dit d'un coup d'oeil.
 * Chaque image montre le GESTE du metier, pas son decor — c'est la difference
 * avec les photos d'ambiance des vitrines du menu (`data/navVisuals`).</p>
 *
 * <p>Source : Pexels, licence libre, usage commercial autorise et attribution
 * non requise. Recadrees a 1000x560 a la prise pour ne pas transporter des
 * pleins formats.</p>
 */
export interface ProviderCategoryDef {
  photo: string;
  color: string;
}

export const PROVIDER_CATEGORIES: ProviderCategoryDef[] = [
  { photo: serviceMenage, color: '#4A9B8E' },
  { photo: serviceMaintenance, color: '#C97A7A' },
  { photo: serviceBlanchisserie, color: '#7BA3C2' },
  { photo: serviceJardin, color: '#6FA96A' },
  { photo: serviceConciergerie, color: '#D4A574' },
  { photo: serviceChef, color: '#B5651D' },
];

/** Parcours prestataire, de l'inscription au paiement. */
export const PROVIDER_STEP_ICONS: ComponentType<{ className?: string }>[] = [
  ClipboardCheckIcon,
  MapPinIcon,
  SmartphoneIcon,
  BanknoteIcon,
];

/** Arguments pour rejoindre le reseau. */
export const PROVIDER_BENEFIT_ICONS: ComponentType<{ className?: string }>[] = [
  CalendarDaysIcon,
  ShieldCheckIcon,
  StarIcon,
  SmartphoneIcon,
];

export interface ResourceDef {
  id: string;
  icon: ComponentType<{ className?: string }>;
}

export const RESOURCES: ResourceDef[] = [
  { id: 'barometre', icon: BarChart3Icon },
  { id: 'calculateur', icon: LandmarkIcon },
  { id: 'obligations', icon: MapPinIcon },
  { id: 'academie', icon: SparklesIcon },
  { id: 'blog', icon: GlobeIcon },
  { id: 'glossaire', icon: FileSignatureIcon },
];
