import type { ComponentType } from 'react';
import {
  BanknoteIcon,
  BarChart3Icon,
  BookOpenIcon,
  BotIcon,
  BuildingIcon,
  CalendarDaysIcon,
  CameraIcon,
  ChefHatIcon,
  ClipboardCheckIcon,
  FileSignatureIcon,
  GlobeIcon,
  HomeIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LeafIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ShirtIcon,
  SmartphoneIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react';

export interface ModuleFeature {
  title: string;
  copy: string;
}

export interface ModuleDef {
  slug: string;
  icon: ComponentType<{ className?: string }>;
  name: string;
  menuCopy: string;
  heroTitle: string;
  heroCopy: string;
  metric: { value: string; label: string };
  features: ModuleFeature[];
  faq: Array<{ q: string; a: string }>;
}

/** Les 8 modules produit — alimentent le mega-menu Produit et les pages dédiées. */
export const MODULES: ModuleDef[] = [
  {
    slug: 'pms-channel-manager',
    icon: CalendarDaysIcon,
    name: 'PMS & Channel manager',
    menuCopy: 'Calendrier multi-biens, réservations, synchronisation OTA en continu.',
    heroTitle: 'Tous vos calendriers, une seule vérité.',
    heroCopy:
      'Airbnb, Booking.com et vos réservations directes synchronisés en continu (ARI via Channex). Le double booking devient structurellement impossible.',
    metric: { value: '0', label: 'double booking par conception — absence de ligne = disponible' },
    features: [
      { title: 'Planning multi-propriétés', copy: 'Blocs colorés par canal, occupation par jour, drag & drop des séjours.' },
      { title: 'Synchronisation ARI', copy: 'Tarifs, disponibilités et restrictions poussés en continu vers les canaux.' },
      { title: 'Réservations unifiées', copy: 'OTA, direct et imports iCal dans une seule liste, avec cycle de vie complet.' },
      { title: 'Filet iCal', copy: 'Mode dégradé universel pendant les transitions — jamais de trou de couverture.' },
    ],
    faq: [
      { q: 'Combien de canaux sont couverts ?', a: 'Airbnb et Booking.com en connexion native via Channex, plus tout canal compatible iCal (Vrbo, Abritel…).' },
      { q: 'Que se passe-t-il si un canal tombe ?', a: 'L’Agent Distribution détecte les conflits de synchronisation et vous alerte avant qu’un double booking n’arrive.' },
    ],
  },
  {
    slug: 'booking-engine',
    icon: GlobeIcon,
    name: 'Booking engine & sites',
    menuCopy: 'Votre site de réservation directe, sans commission, avec templates.',
    heroTitle: 'Vos réservations directes, sans commission.',
    heroCopy:
      'Un moteur de réservation embarquable sur n’importe quel site, une galerie de templates prêts à personnaliser, un panier multi-séjours et le paiement intégré.',
    metric: { value: '0 %', label: 'de commission sur vos réservations directes' },
    features: [
      { title: 'Widget embarquable', copy: 'Recherche par dates, calendrier 2 mois avec prix par nuit, multi-langue FR/EN/AR avec RTL.' },
      { title: 'Galerie de templates', copy: 'Des sites complets prêts à instancier, personnalisables dans le Studio no-code.' },
      { title: 'Panier multi-séjours', copy: 'Plusieurs logements et dates dans une seule réservation payée en une fois.' },
      { title: 'Relance de panier', copy: 'Les paniers abandonnés sont relancés automatiquement par email.' },
    ],
    faq: [
      { q: 'Puis-je utiliser mon site existant ?', a: 'Oui — le widget s’intègre en une balise script sur WordPress, Wix ou tout site HTML.' },
      { q: 'Le paiement est-il inclus ?', a: 'Oui, via le provider adapté à votre pays : CMI/PayZone ou YouCan Pay au Maroc, Stripe ailleurs.' },
    ],
  },
  {
    slug: 'livret-accueil',
    icon: BookOpenIcon,
    name: 'Livret d’accueil & expériences',
    menuCopy: 'Livret numérique, upsells et marketplace d’activités — nouveaux revenus par commission.',
    heroTitle: 'Le voyage parfait pour vos voyageurs. De nouveaux revenus pour vous.',
    heroCopy:
      'Un livret d’accueil numérique qui organise tout le séjour — arrivée, recommandations, activités locales et services à domicile — et fait naître un revenu additionnel à chaque réservation.',
    metric: { value: '+15 %', label: 'de revenu additionnel par séjour via upsells et commissions' },
    features: [
      { title: 'Livret d’accueil numérique', copy: 'Accessible par un simple lien borné à la réservation, sans app ni mot de passe : arrivée, wifi, règles, contacts, guide de quartier — multilingue FR/EN/AR.' },
      { title: 'Upsells intégrés', copy: 'Check-in anticipé, départ tardif, ménage en cours de séjour, panier de bienvenue — proposés et payés directement dans le livret.' },
      { title: 'Marketplace d’expériences', copy: 'Activités, excursions et bons plans de partenaires locaux réservables depuis le livret — commission automatique à chaque réservation.' },
      { title: 'Services à domicile', copy: 'Chef privé, spa, transferts, garde d’enfants : le logement devient une conciergerie. Vous choisissez l’offre, vous fixez votre marge.' },
    ],
    faq: [
      { q: 'Le voyageur doit-il installer une application ?', a: 'Non — il reçoit un simple lien avant l’arrivée, valable le temps du séjour, sans compte ni mot de passe.' },
      { q: 'Comment gagnez-vous de l’argent avec la marketplace ?', a: 'Chaque activité ou service réservé depuis le livret génère une commission que vous paramétrez ; l’encaissement passe par votre provider de paiement.' },
      { q: 'Qui fournit les activités et les services ?', a: 'Des partenaires locaux que vous sélectionnez, ou votre propre catalogue — vous gardez la main sur l’offre, les prix et les marges.' },
    ],
  },
  {
    slug: 'agents-ia',
    icon: BotIcon,
    name: 'Agents IA',
    menuCopy: 'La constellation qui surveille, propose et exécute — sous votre contrôle.',
    heroTitle: 'Une équipe d’agents IA qui travaille pour vos logements.',
    heroCopy: '',
    metric: { value: '100 %', label: 'des décisions expliquées et traçables' },
    features: [],
    faq: [],
  },
  {
    slug: 'revenue-market-data',
    icon: BarChart3Icon,
    name: 'Revenue & market data',
    menuCopy: 'Yield automatique borné + comparables de marché par ville.',
    heroTitle: 'Des prix qui suivent votre marché. Pas l’inverse.',
    heroCopy:
      'Le yield ajuste vos tarifs bloc par bloc dans des bornes que vous fixez, nourri par des comparables de marché anonymisés. Chaque ajustement est simulé et expliqué.',
    metric: { value: '+12 %', label: 'de RevPAR visé par le yield automatique' },
    features: [
      { title: 'Tarification 6 niveaux', copy: 'Overrides, promotions, saisons, last-minute, prix de base — résolus dans un ordre clair.' },
      { title: 'Yield borné', copy: 'Baisse sous 55 % d’occupation, hausse au-delà de 85 %, plancher intouchable, repos de 14 jours.' },
      { title: 'Market data', copy: 'ADR, occupation et saisonnalité de votre ville, agrégés et anonymisés.' },
      { title: 'Rapports RMS', copy: 'Pacing, courbes de réservation, funnel de conversion, snapshots historiques.' },
    ],
    faq: [
      { q: 'Le yield peut-il brader mes nuits ?', a: 'Non : le prix plancher que vous définissez est une borne dure, et chaque baisse est plafonnée et espacée dans le temps.' },
      { q: 'D’où viennent les données de marché ?', a: 'Des portefeuilles Baitly agrégés avec k-anonymat — aucune donnée individuelle n’est exposée.' },
    ],
  },
  {
    slug: 'paiements-finances',
    icon: BanknoteIcon,
    name: 'Paiements & finances',
    menuCopy: 'Encaissement local (CMI, PayZone, YouCan Pay), facturation conforme.',
    heroTitle: 'Encaissez au Maroc. Facturez dans les règles.',
    heroCopy:
      'Là où Stripe s’arrête, Baitly continue : CMI/PayZone et YouCan Pay pour encaisser en dirhams, numérotation de factures inaltérable, taxe de séjour calculée par commune.',
    metric: { value: '3', label: 'providers d’encaissement selon votre pays' },
    features: [
      { title: 'Multi-providers', copy: 'CMI/PayZone, YouCan Pay, Stripe — résolus automatiquement selon le pays et la capacité.' },
      { title: 'Facturation conforme', copy: 'Numérotation séquentielle NF, mentions légales, factures de commission pour vos mandants.' },
      { title: 'Taxe de séjour', copy: 'Barèmes communaux (défaut org + par logement), exonérations, rapports par période.' },
      { title: 'Versements', copy: 'Open Banking, virement SEPA ou Wise pour vos payouts propriétaires et prestataires.' },
    ],
    faq: [
      { q: 'Stripe fonctionne-t-il au Maroc ?', a: 'Non pour les sociétés marocaines — c’est précisément pourquoi Baitly intègre CMI/PayZone et YouCan Pay en natif.' },
      { q: 'Gérez-vous la caution ?', a: 'Oui, par pré-autorisation sur les providers qui la supportent.' },
    ],
  },
  {
    slug: 'operations-menage',
    icon: WrenchIcon,
    name: 'Opérations & ménage',
    menuCopy: 'Missions auto-assignées, preuve photo, payouts gatés.',
    heroTitle: 'Le ménage assigné, prouvé, payé.',
    heroCopy:
      'Chaque départ génère sa mission, l’équipe reçoit sa checklist, la preuve photo conditionne le paiement. Vos standards deviennent des processus.',
    metric: { value: '100 %', label: 'des payouts ménage conditionnés à la preuve photo' },
    features: [
      { title: 'Planning auto', copy: 'Missions générées au checkout, assignées selon disponibilités et zones.' },
      { title: 'Checklists par logement', copy: 'Pièce par pièce, avec photos de référence et consignes.' },
      { title: 'Preuve photo', copy: 'Le prestataire documente, vous validez, le payout se débloque.' },
      { title: 'Maintenance', copy: 'Interventions, devis, tarifs travaux des techniciens.' },
    ],
    faq: [
      { q: 'Mes équipes doivent-elles installer une app ?', a: 'Elles reçoivent leurs missions sur mobile avec un accès limité à leur rôle — rien d’autre.' },
      { q: 'Comment sont payés les prestataires ?', a: 'Tarifs par prestation, payout déclenché après validation de la preuve photo.' },
    ],
  },
  {
    slug: 'objets-connectes',
    icon: CameraIcon,
    name: 'Objets connectés',
    menuCopy: 'Serrures, capteurs de bruit, vidéosurveillance des accès.',
    heroTitle: 'Vos logements sous contrôle, à distance.',
    heroCopy:
      'Serrures connectées avec codes bornés au séjour, capteurs de bruit avec seuils et alertes WhatsApp, caméras des espaces extérieurs — dans le respect de la vie privée.',
    metric: { value: '3 h', label: 'avant l’arrivée : le code d’accès part automatiquement' },
    features: [
      { title: 'Serrures connectées', copy: 'Nuki, KeyNest — codes générés par séjour, journal des accès.' },
      { title: 'Capteurs de bruit', copy: 'Seuils jour/nuit, créneaux, alertes graduées avant l’escalade.' },
      { title: 'Vidéosurveillance', copy: 'Espaces extérieurs et accès uniquement — flux intérieurs interdits.' },
      { title: 'Automatisations', copy: 'Arrivée → code + guide voyageur ; bruit → message WhatsApp au guest.' },
    ],
    faq: [
      { q: 'Quelles marques sont supportées ?', a: 'Nuki et KeyNest pour les serrures, Minut pour le bruit ; le catalogue s’étend en continu.' },
      { q: 'Et la vie privée des voyageurs ?', a: 'Les caméras intérieures sont interdites par conception ; le bruit est mesuré en décibels, jamais enregistré.' },
    ],
  },
  {
    slug: 'portail-proprietaire',
    icon: FileSignatureIcon,
    name: 'Portail propriétaire & contrats',
    menuCopy: 'Relevés, versements, mandats signés en ligne.',
    heroTitle: 'Vos mandants voient tout. Vous ne ressaisissez rien.',
    heroCopy:
      'Un portail par propriétaire avec relevés mensuels, versements et performances. Les mandats de gestion se signent en ligne, certificat de preuve inclus.',
    metric: { value: '4', label: 'modèles d’encaissement contractuels supportés' },
    features: [
      { title: 'Portail dédié', copy: 'Relevés, calendrier, revenus nets — chaque propriétaire voit son bien.' },
      { title: 'E-signature', copy: 'Mandat signé en ligne, horodaté, certificat joint au PDF.' },
      { title: 'Modèles d’encaissement', copy: 'Direct, propriétaire encaisse, conciergerie encaisse, co-hôte OTA.' },
      { title: 'Factures de commission', copy: 'Générées automatiquement à chaque période, conformes.' },
    ],
    faq: [
      { q: 'La signature électronique est-elle valable ?', a: 'Signature simple avec dossier de preuve (IP, horodatage, consentement) — adaptée aux mandats de gestion.' },
      { q: 'Le propriétaire peut-il bloquer des dates ?', a: 'Oui, selon les permissions que vous lui accordez.' },
    ],
  },
];

export interface SolutionDef {
  slug: string;
  icon: ComponentType<{ className?: string }>;
  name: string;
  menuCopy: string;
  copy: string;
  points: string[];
}

export const SOLUTIONS: SolutionDef[] = [
  {
    slug: 'conciergeries',
    icon: BuildingIcon,
    name: 'Conciergeries',
    menuCopy: 'De 5 à 200 lots, multi-propriétaires.',
    copy: 'Pilotez le portefeuille, les équipes et les mandants depuis un seul cockpit.',
    points: ['Cartes HITL par équipe', 'Portail propriétaires', 'Factures de commission', 'Contrats 4 modèles'],
  },
  {
    slug: 'hotes-independants',
    icon: HomeIcon,
    name: 'Hôtes indépendants',
    menuCopy: '1 à 5 logements, autopilote simple.',
    copy: 'Les agents gèrent le quotidien, vous validez depuis votre téléphone.',
    points: ['Autopilote messages + prix', 'Validation en 2 gestes', 'Sans carte bancaire pour essayer', 'WhatsApp natif'],
  },
  {
    slug: 'riads-maisons-dhotes',
    icon: KeyRoundIcon,
    name: 'Riads & maisons d’hôtes',
    menuCopy: 'Chambres + logements entiers, petit-déjeuner, équipe sur place.',
    copy: 'Le fonctionnement hybride chambre/logement, avec la conformité marocaine intégrée.',
    points: ['Fiche police DGSN', 'Taxe de séjour auto', 'Interface FR/AR', 'Boutique & extras'],
  },
  {
    slug: 'maroc',
    icon: MapPinIcon,
    name: 'Maroc — conformité',
    menuCopy: 'Fiche police, taxe de séjour, Go Siyaha, encaissement en MAD.',
    copy: 'Le seul PMS qui traite la conformité marocaine comme un produit, pas une promesse.',
    points: ['Fiche police au format DGSN', 'Barèmes de taxe par commune', 'Éligibilité Go Siyaha (jusqu’à 90 %)', 'CMI / PayZone / YouCan Pay'],
  },
  {
    slug: 'multi-proprietaires',
    icon: UsersIcon,
    name: 'Multi-propriétaires',
    menuCopy: 'Gestion pour compte de tiers, relevés et versements.',
    copy: 'Chaque mandant a son contrat, son relevé, son versement — automatiquement.',
    points: ['Relevés mensuels', 'Versements SEPA/Wise', 'Journal d’audit exportable', 'Accès propriétaire borné'],
  },
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

import gyg from '../assets/brands/pl-getyourguide.svg';
import viator from '../assets/brands/pl-viator.png';
import klook from '../assets/brands/pl-klook.png';
import civitatis from '../assets/brands/pl-civitatis.png';
import tiqets from '../assets/brands/pl-tiqets.png';
import musement from '../assets/brands/pl-musement.png';

/** Partenaires de la marketplace d'activités & expériences du livret d'accueil. */
export const GUIDE_PARTNERS: PartnerDef[] = [
  { mono: 'GYG', name: 'GetYourGuide', color: '#FF5533', copy: 'Marketplace mondiale d’activités', tag: '~15 % commission', logoUrl: gyg },
  { mono: 'VI', name: 'Viator', color: '#1A8917', copy: 'Réseau TripAdvisor', tag: 'Affiliation', logoUrl: viator },
  { mono: 'KL', name: 'Klook', color: '#FF5B00', copy: 'Focus Asie & Golfe (KSA)', tag: 'Configurable', logoUrl: klook },
  { mono: 'CI', name: 'Civitatis', color: '#F5333F', copy: 'Visites guidées FR / ES', tag: 'Affiliation', logoUrl: civitatis },
  { mono: 'TQ', name: 'Tiqets', color: '#FF4E00', copy: 'Billets musées & attractions', tag: 'Affiliation', logoUrl: tiqets },
  { mono: 'MU', name: 'Musement', color: '#0A7EF2', copy: 'Expériences en Europe', tag: 'Affiliation', logoUrl: musement },
];

/** Partenaires de services à domicile / conciergerie proposés dans le livret.
    Services first-party Baitly → tuile = mark Baitly teinté (couleur par service). */
export const SERVICE_PARTNERS: PartnerDef[] = [
  { mono: 'CH', name: 'Chef à domicile', color: '#B5651D', copy: 'Dîners privés & petits-déjeuners', baitly: true },
  { mono: 'SP', name: 'Spa & massage', color: '#7A6A95', copy: 'Soins à domicile sur réservation', baitly: true },
  { mono: 'TR', name: 'Transferts', color: '#2E6E8E', copy: 'Aéroport, gare, excursions privées', baitly: true },
  { mono: 'MN', name: 'Ménage & linge', color: '#14B8A6', copy: 'Ménage en cours de séjour', baitly: true },
];

import uber from '../assets/brands/si-uber.svg';
import tripadvisor from '../assets/brands/si-tripadvisor.svg';
import glovo from '../assets/brands/si-glovo.svg';
import deliveroo from '../assets/brands/si-deliveroo.svg';

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
    { mono: 'UB', name: 'Uber', color: '#000000', copy: 'Course & transfert', logoUrl: uber, mask: true },
    { mono: 'TA', name: 'Tripadvisor', color: '#34E0A1', copy: 'Avis & réservations', logoUrl: tripadvisor, mask: true, glyph: '#0B3B2E' },
    { mono: 'GL', name: 'Glovo', color: '#FFC244', copy: 'Livraison de repas & courses', logoUrl: glovo, mask: true, glyph: '#1F2937' },
    { mono: 'DL', name: 'Deliveroo', color: '#00CCBC', copy: 'Livraison de repas', logoUrl: deliveroo, mask: true },
    { mono: 'TR', name: 'Transferts Baitly', color: '#2E6E8E', copy: 'Aéroport & excursions', baitly: true },
    { mono: 'CH', name: 'Chef à domicile', color: '#B5651D', copy: 'Dîners privés', baitly: true },
  ],
  // Services à domicile opérés par Baitly.
  [
    { mono: 'MN', name: 'Ménage & linge', color: '#14B8A6', copy: 'Ménage en cours de séjour', baitly: true },
    { mono: 'SP', name: 'Spa & massage', color: '#7A6A95', copy: 'Soins à domicile', baitly: true },
    { mono: 'BL', name: 'Blanchisserie', color: '#7BA3C2', copy: 'Collecte & livraison', baitly: true },
    { mono: 'CO', name: 'Conciergerie', color: '#D4A574', copy: 'Assistance sur place', baitly: true },
    { mono: 'BS', name: 'Baby-sitting', color: '#C97A7A', copy: 'Garde d’enfants', baitly: true },
    { mono: 'CS', name: 'Livraison de courses', color: '#6FA96A', copy: 'Panier d’arrivée', baitly: true },
  ],
];

/* ─── Marketplace prestataires ─────────────────────────────────────────────────
   Côté offre : les pros (ménage, maintenance, blanchisserie…) qui veulent vendre
   leurs services aux hôtes et conciergeries via Baitly. Alimente /prestataires. */

export interface ProviderCategoryDef {
  icon: ComponentType<{ className?: string }>;
  name: string;
  copy: string;
  color: string;
  examples: string[];
}

/** Métiers proposables sur la marketplace prestataires. */
export const PROVIDER_CATEGORIES: ProviderCategoryDef[] = [
  {
    icon: SparklesIcon,
    name: 'Ménage & entretien',
    copy: 'Ménage entre deux séjours, remise en état, réassort des consommables.',
    color: '#4A9B8E',
    examples: ['Femme / homme de ménage', 'Équipe de nettoyage', 'Remise en état après séjour'],
  },
  {
    icon: WrenchIcon,
    name: 'Maintenance & petits travaux',
    copy: 'Plomberie, électricité, serrurerie, dépannages et interventions urgentes.',
    color: '#C97A7A',
    examples: ['Plombier / électricien', 'Bricoleur multiservices', 'Astreinte urgence 24/7'],
  },
  {
    icon: ShirtIcon,
    name: 'Blanchisserie & linge',
    copy: 'Collecte, lavage, repassage et livraison du linge de maison et de toilette.',
    color: '#7BA3C2',
    examples: ['Pressing / laverie', 'Location de linge hôtelier', 'Collecte & livraison'],
  },
  {
    icon: LeafIcon,
    name: 'Jardin & piscine',
    copy: 'Entretien des espaces verts, nettoyage et traitement des piscines.',
    color: '#6FA96A',
    examples: ['Jardinier / paysagiste', 'Pisciniste', 'Traitement de l’eau'],
  },
  {
    icon: KeyRoundIcon,
    name: 'Accueil & conciergerie',
    copy: 'Check-in / check-out en personne, remise des clés, assistance voyageurs.',
    color: '#D4A574',
    examples: ['Agent d’accueil', 'Remise de clés', 'Conciergerie de proximité'],
  },
  {
    icon: ChefHatIcon,
    name: 'Chef & expériences',
    copy: 'Chef à domicile, traiteur, transferts et activités vendus aux voyageurs.',
    color: '#B5651D',
    examples: ['Chef à domicile', 'Chauffeur / transferts', 'Guide & activités'],
  },
];

export interface ProviderStepDef {
  icon: ComponentType<{ className?: string }>;
  title: string;
  copy: string;
}

/** Parcours prestataire, de l'inscription au paiement. */
export const PROVIDER_STEPS: ProviderStepDef[] = [
  {
    icon: ClipboardCheckIcon,
    title: 'Créez votre profil',
    copy: 'Métier, zone d’intervention, tarifs, disponibilités et pièces justificatives. Validation sous 48 h.',
  },
  {
    icon: MapPinIcon,
    title: 'Recevez des missions',
    copy: 'Les hôtes et conciergeries autour de vous vous proposent des interventions. Zéro prospection.',
  },
  {
    icon: SmartphoneIcon,
    title: 'Intervenez & prouvez',
    copy: 'Check-list mobile, photos avant / après et validation en un geste depuis votre téléphone.',
  },
  {
    icon: BanknoteIcon,
    title: 'Soyez payé, sans relance',
    copy: 'Paiement déclenché à la preuve, viré par la plateforme. Fini les factures qui traînent.',
  },
];

export interface ProviderBenefitDef {
  icon: ComponentType<{ className?: string }>;
  title: string;
  copy: string;
}

/** Arguments pour rejoindre le réseau. */
export const PROVIDER_BENEFITS: ProviderBenefitDef[] = [
  {
    icon: CalendarDaysIcon,
    title: 'Un carnet qui se remplit',
    copy: 'Un flux régulier de missions près de chez vous, sans budget pub ni démarchage.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Paiement garanti',
    copy: 'Le règlement est sécurisé par Baitly et déclenché à la preuve de réalisation.',
  },
  {
    icon: StarIcon,
    title: 'Une réputation qui compte',
    copy: 'Chaque mission bien faite nourrit votre note et vous ouvre plus de demandes.',
  },
  {
    icon: SmartphoneIcon,
    title: 'Tout depuis le mobile',
    copy: 'Planning, itinéraire, check-lists et preuves photo dans une seule application.',
  },
];

export const RESOURCES = [
  { icon: BarChart3Icon, name: 'Baromètre STR Maroc', copy: 'ADR, occupation et saisonnalité par ville — données agrégées Baitly.', tag: 'Bientôt' },
  { icon: LandmarkIcon, name: 'Calculateur de revenus', copy: 'Estimez le potentiel locatif d’un bien à Marrakech, Casablanca, Agadir…', tag: 'Bientôt' },
  { icon: MapPinIcon, name: 'Guide des obligations Maroc', copy: 'Fiche police, taxe de séjour, loi 80-14 : la carte complète, à jour.', tag: 'Guide' },
  { icon: SparklesIcon, name: 'Académie Baitly', copy: 'Formation courte au revenue management et aux opérations, FR/AR.', tag: 'Bientôt' },
  { icon: GlobeIcon, name: 'Blog', copy: 'Conseils métier, nouveautés produit, retours de conciergeries.', tag: 'Blog' },
  { icon: FileSignatureIcon, name: 'Glossaire FR/AR', copy: 'ADR, RevPAR, pacing… le vocabulaire du métier, dans les deux langues.', tag: 'Glossaire' },
];
