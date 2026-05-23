/**
 * Catalogue des services tiers integrables a Clenzy.
 *
 * <h2>Role</h2>
 * <p>Source de verite unique pour la vitrine des services dans l'onglet
 * Integrations. Chaque entree decrit un service avec son metadata visuel,
 * une description, l'URL du site officiel, et les modalites d'acces
 * (compte developpeur, partenariat, etc.) — utilisees dans les tooltips au
 * survol des cards.</p>
 *
 * <h2>Statut</h2>
 * <p>Les services "available: true" ont leur backend cable (ou seront
 * cables prochainement). Les "available: false" sont en catalogue
 * informatif uniquement — click ouvre un modal avec lien vers le site.</p>
 */

export type ServiceCategory =
  | 'messaging'
  | 'market_intelligence'
  | 'tax_automation'
  | 'insurance'
  | 'cleaning_operations'
  | 'smart_locks_iot'
  | 'activities_affiliate'
  | 'reviews_reputation'
  | 'marketing_crm'
  | 'key_management'
  | 'noise_monitoring';

/**
 * Tag commercial du service. Affiche comme un petit chip a cote du nom.
 *   - proprietary : solution Clenzy native (incluse / sans abonnement)
 *   - free        : gratuit / inclus dans l'abonnement Clenzy
 *   - partner     : accord commercial / certifie partenaire
 *   - external    : service tiers independant (default, pas affiche)
 */
export type ServiceTag = 'proprietary' | 'free' | 'partner' | 'external';

export interface CatalogService {
  id: string;
  name: string;
  category: ServiceCategory;
  /** Couleur de marque pour le tile (info factuelle publique). */
  brandColor: string;
  /** Couleur du texte sur le tile (white ou dark selon contraste). */
  brandTextColor: string;
  /** Courte description affichee sous le nom dans la card. */
  shortDescription: string;
  /** Description longue pour le tooltip au survol. */
  tooltipDescription: string;
  /** URL officielle du service (ouverte au click "En savoir plus"). */
  websiteUrl: string;
  /** Modalites d'acces : compte developpeur, partenariat, etc. */
  accessModality: string;
  /** Si true, l'integration a un backend cable. Sinon catalogue info uniquement. */
  available: boolean;
  /** Region(s) cible(es) — affiche en chip discret. */
  region?: 'FR' | 'EU' | 'MA' | 'KSA' | 'MENA' | 'Global';
  /** Tag commercial optionnel (proprietary/free/partner/external). */
  tag?: ServiceTag;
  /**
   * Route interne Clenzy si le service est natif/proprietaire. Si presente,
   * le modal affiche "Configurer dans Clenzy" qui navigate vers cette route
   * (au lieu de "Visiter le site").
   */
  internalRoute?: string;
}

export const CATALOG_SERVICES: CatalogService[] = [
  // ─── Messaging ────────────────────────────────────────────────────────────
  {
    id: 'whatsapp_business',
    name: 'WhatsApp Business Cloud',
    category: 'messaging',
    brandColor: '#25D366',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Messagerie native · API Cloud Meta',
    tooltipDescription:
      'API officielle Meta pour WhatsApp Business. Envoi de messages transactionnels (confirmation réservation, check-in, etc.), templates approuvés, médias enrichis. WhatsApp Catalog pour vendre des extras dans le chat. WhatsApp est le canal #1 au Maroc et en Arabie Saoudite (95 %+ de pénétration mobile).',
    websiteUrl: 'https://business.whatsapp.com/products/business-platform',
    accessModality: 'Créer un compte Meta Business → ajouter une app WhatsApp Business → obtenir un numéro vérifié + token permanent. Tarification au message (~0.005-0.05 € selon pays).',
    available: false,
    region: 'Global',
  },

  // ─── Market Intelligence ──────────────────────────────────────────────────
  {
    id: 'airdna',
    name: 'AirDNA',
    category: 'market_intelligence',
    brandColor: '#FF4751',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Données marché Airbnb / Vrbo',
    tooltipDescription:
      'Plateforme leader d\'analytics du marché location courte durée. Données ADR, occupancy rate, RevPAR par zone géographique. Couvre Marrakech, Casablanca, Riyadh, Djeddah, Paris, et tout le territoire français. Essentiel pour aider les hosts à décider d\'investir ou comparer leur performance à la concurrence locale.',
    websiteUrl: 'https://www.airdna.co/',
    accessModality: 'Souscrire un abonnement MarketMinder (à partir de ~20 €/mois par marché) → obtenir une API key Enterprise pour intégration PMS (contact commercial requis).',
    available: false,
    region: 'Global',
  },

  // ─── Tax automation / Taxe de séjour ─────────────────────────────────────
  {
    id: 'mytse',
    name: 'MyTSE',
    category: 'tax_automation',
    brandColor: '#1E40AF',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Taxe de séjour France',
    tooltipDescription:
      'Solution française pour automatiser le calcul, la collecte et la déclaration de la taxe de séjour auprès des communes. Conforme aux barèmes 2026 (par étoile / forfait par nuit). Reporting compatible avec les déclarations mensuelles obligatoires.',
    websiteUrl: 'https://www.mytse.fr/',
    accessModality: 'Création de compte gratuite, tarification au volume de nuitées déclarées. API key fournie après validation du compte hôte.',
    available: false,
    region: 'FR',
  },
  {
    id: 'avalara',
    name: 'Avalara MyLodgeTax',
    category: 'tax_automation',
    brandColor: '#FF6F0F',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Tax compliance global',
    tooltipDescription:
      'Plateforme américaine de tax compliance. MyLodgeTax automatise la collecte et le versement de la taxe de séjour pour les locations courte durée. Couvre 5 000+ juridictions dans le monde y compris France, Maroc, EAU.',
    websiteUrl: 'https://www.avalara.com/us/en/products/mylodgetax.html',
    accessModality: 'Compte Avalara Connect requis → API key fournie après contractualisation. Tarification basée sur le nombre de propriétés actives.',
    available: false,
    region: 'Global',
  },

  // ─── Insurance ────────────────────────────────────────────────────────────
  {
    id: 'superhog',
    name: 'Superhog',
    category: 'insurance',
    brandColor: '#FF5C00',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Guest screening + caution dommages',
    tooltipDescription:
      'Service britannique de vérification de guest et caution dommages pour la location courte durée. Screening biométrique + check ID + caution couvrant jusqu\'à 5M€ de dommages. Très utilisé par les gestionnaires premium en France et UK.',
    websiteUrl: 'https://superhog.com/',
    accessModality: 'Compte gestionnaire requis (validation des propriétés) → API key. Tarification par réservation (~3-8 €/stay) ou abonnement annuel.',
    available: false,
    region: 'EU',
  },
  {
    id: 'safely',
    name: 'Safely',
    category: 'insurance',
    brandColor: '#1B6F8C',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Guest screening + assurance',
    tooltipDescription:
      'Solution américaine équivalente à Superhog. Background check + assurance dommages (1M$) + assurance responsabilité civile. Pertinent pour les guests internationaux et les courts séjours premium.',
    websiteUrl: 'https://safely.com/',
    accessModality: 'Inscription en ligne, vérification du portefeuille de propriétés. Tarification par stay (~3-7 $). API REST fournie après onboarding.',
    available: false,
    region: 'Global',
  },
  {
    id: 'axa_partners',
    name: 'AXA Partners',
    category: 'insurance',
    brandColor: '#00008F',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Assurance voyage / annulation',
    tooltipDescription:
      'Bras assurance voyage du groupe AXA. Propose des contrats annulation, assistance médicale, et bagages — proposés à la réservation pour augmenter le revenu par stay (commission affiliée). Particulièrement pertinent FR/MA.',
    websiteUrl: 'https://www.axapartners.com/',
    accessModality: 'Contrat partenariat B2B requis (contact commercial). Intégration via API REST + portail de gestion des polices souscrites.',
    available: false,
    region: 'EU',
  },
  {
    id: 'tawuniya',
    name: 'Tawuniya',
    category: 'insurance',
    brandColor: '#005A9C',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Assurance leader Arabie Saoudite',
    tooltipDescription:
      'Assureur historique saoudien, leader sur le marché de l\'assurance voyage et dommages. Propose des polices spécifiques au tourisme (Vision 2030 du Royaume) et aux courts séjours.',
    websiteUrl: 'https://www.tawuniya.com/',
    accessModality: 'Partenariat B2B (contact direct via les agences ou portail entreprise). Documentation API disponible après accord.',
    available: false,
    region: 'KSA',
  },

  // ─── Cleaning & Operations ───────────────────────────────────────────────
  {
    id: 'turno',
    name: 'Turno',
    category: 'cleaning_operations',
    brandColor: '#4DA3FF',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Marketplace ménage STR',
    tooltipDescription:
      'Ex-TurnoverBnB. Marketplace nord-américaine et européenne de cleaners spécialisés location courte durée. Planning automatique entre réservations, checklists photo, paiement intégré. Croissant en France et au Maroc.',
    websiteUrl: 'https://turno.com/',
    accessModality: 'Compte gestionnaire gratuit. Marketplace gratuit (commission sur paiement cleaner). API REST ouverte aux PMS partenaires (demande sur le portail développeur).',
    available: false,
    region: 'EU',
  },
  {
    id: 'properly',
    name: 'Properly',
    category: 'cleaning_operations',
    brandColor: '#0F766E',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Checklists photo cleaners',
    tooltipDescription:
      'App de checklists visuelles pour les équipes ménage : chaque étape est validée par photo. Permet le contrôle qualité à distance + traçabilité réglementaire (dommages, état des lieux). Utilisée par Vacasa et autres acteurs majeurs.',
    websiteUrl: 'https://getproperly.com/',
    accessModality: 'Abonnement par propriété (~5-10 $/mois). API d\'intégration disponible pour les PMS partenaires.',
    available: false,
    region: 'Global',
  },
  {
    id: 'breezeway',
    name: 'Breezeway',
    category: 'cleaning_operations',
    brandColor: '#0EA5E9',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Operations + maintenance leader',
    tooltipDescription:
      'Plateforme opérations leader US/UK pour la location courte durée. Gère ménage, maintenance, inspections, communication équipes. Très polished — utilisée par les grosses conciergeries (Vacasa, Avantio).',
    websiteUrl: 'https://www.breezeway.io/',
    accessModality: 'Abonnement Pro (~ 8-15 $/propriété/mois selon plan). API d\'intégration PMS via leur portail partenaires.',
    available: false,
    region: 'Global',
  },

  // ─── Smart Locks & IoT ───────────────────────────────────────────────────
  {
    id: 'igloohome',
    name: 'Igloohome',
    category: 'smart_locks_iot',
    brandColor: '#1A1A1A',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Serrures Bluetooth · leader MENA',
    tooltipDescription:
      'Fabricant singapourien de serrures Bluetooth/PIN. Batterie longue durée (12-18 mois), pas besoin de WiFi permanent — important par +45 °C l\'été en Arabie. Très utilisé en MENA pour les courts séjours. Codes générés en avance et expirant automatiquement.',
    websiteUrl: 'https://www.igloocompany.co/',
    accessModality: 'Achat hardware (~200-400 €/serrure) → compte développeur Igloohome gratuit → API key pour génération de codes dynamiques.',
    available: false,
    region: 'MENA',
  },
  {
    id: 'ttlock',
    name: 'TTLock',
    category: 'smart_locks_iot',
    brandColor: '#FB923C',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Serrures économiques · MA/MENA',
    tooltipDescription:
      'Écosystème chinois de serrures Bluetooth low-cost (~50-150 €/serrure). Très populaire au Maroc et dans les locations économiques. API ouverte pour génération de codes PIN à durée limitée.',
    websiteUrl: 'https://www.ttlock.com/',
    accessModality: 'Compte développeur gratuit sur le portail TTLock (clientId + clientSecret). Achat hardware en parallèle.',
    available: false,
    region: 'MA',
  },
  {
    id: 'tuya_smart',
    name: 'Tuya Smart',
    category: 'smart_locks_iot',
    brandColor: '#FF4800',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Plateforme IoT universelle',
    tooltipDescription:
      'Plateforme cloud chinoise qui standardise +500 000 appareils IoT (serrures, thermostats, capteurs, prises connectées). Idéal pour gérer un parc hétérogène — toutes les marques white-label Amazon (e.g. Aqara, Eufy partiel) passent par Tuya.',
    websiteUrl: 'https://iot.tuya.com/',
    accessModality: 'Compte développeur gratuit (iot.tuya.com) → créer un projet → obtenir AccessId + AccessSecret. Quota API gratuit suffisant pour la plupart des PMS.',
    available: false,
    region: 'Global',
  },
  {
    id: 'ecobee',
    name: 'Ecobee',
    category: 'smart_locks_iot',
    brandColor: '#0E4F7A',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Thermostats smart · économies énergie',
    tooltipDescription:
      'Thermostats connectés haut de gamme (Canada). Programmation à distance, détection de présence, économies énergie moyennes 23 %. Utile pour les hosts qui ne veulent pas chauffer/climatiser inutilement entre les guests.',
    websiteUrl: 'https://www.ecobee.com/developers/',
    accessModality: 'Achat thermostat (~250-300 €). Inscription développeur gratuite, OAuth2 pour accéder à l\'API REST.',
    available: false,
    region: 'Global',
  },
  {
    id: 'resideo',
    name: 'Resideo (Honeywell)',
    category: 'smart_locks_iot',
    brandColor: '#E31837',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Thermostats commercial / multi-site',
    tooltipDescription:
      'Division domotique ex-Honeywell. Thermostats T6/T9, capteurs eau, détecteurs CO/fumée. Pertinent pour les conciergeries multi-propriétés cherchant une solution professionnelle uniforme.',
    websiteUrl: 'https://developer.honeywellhome.com/',
    accessModality: 'Compte développeur Honeywell Home (gratuit) → OAuth2. Achat hardware via distributeurs (Castorama, Leroy Merlin, etc.).',
    available: false,
    region: 'Global',
  },

  // ─── Activities & Affiliate ──────────────────────────────────────────────
  {
    id: 'getyourguide',
    name: 'GetYourGuide',
    category: 'activities_affiliate',
    brandColor: '#FF5C39',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Marketplace activités · ~15 % commission',
    tooltipDescription:
      'Leader européen des activités touristiques (Berlin). +200 destinations, billetterie monuments, expériences guidées. Cross-sell idéal pour vos guests : reverser via affiliation 15-20 % de commission sur chaque réservation activité.',
    websiteUrl: 'https://partner.getyourguide.com/',
    accessModality: 'Inscription Partner Program (gratuite) → validation manuelle (24-48h) → ID affilié + clé API. Pas de prérequis volume.',
    available: false,
    region: 'EU',
  },
  {
    id: 'klook',
    name: 'Klook',
    category: 'activities_affiliate',
    brandColor: '#FF5722',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Marketplace activités · focus Asie + KSA',
    tooltipDescription:
      'Concurrent direct de GetYourGuide, focus marché asiatique et MENA. Très utilisé par les touristes chinois et saoudiens. Commission affiliée 6-12 %. Couvre Riyadh, Djeddah, Dubaï, Marrakech.',
    websiteUrl: 'https://affiliate.klook.com/',
    accessModality: 'Programme affilié (signup en ligne) → API ouverte après approbation. Catalogues PHP/REST disponibles.',
    available: false,
    region: 'MENA',
  },
  {
    id: 'viator',
    name: 'Viator',
    category: 'activities_affiliate',
    brandColor: '#328E04',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Marketplace activités · TripAdvisor',
    tooltipDescription:
      'Filiale TripAdvisor. Catalogue ultra-large d\'activités et expériences. Commission affiliée 8 %. Présence forte FR/EU/Global.',
    websiteUrl: 'https://www.viatorpartners.com/',
    accessModality: 'Partner program (signup gratuit) → API key. Bibliothèques officielles JavaScript/Python disponibles.',
    available: false,
    region: 'Global',
  },

  // ─── Reviews & Reputation ────────────────────────────────────────────────
  {
    id: 'revinate',
    name: 'Revinate',
    category: 'reviews_reputation',
    brandColor: '#D71F44',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Hospitality reputation leader',
    tooltipDescription:
      'Plateforme reputation hôtelière premium. Agrégation reviews multi-canaux (Google, TripAdvisor, Booking, Airbnb), AI-powered insights, automated responses. Très utilisée par les hôtels indépendants et conciergeries premium.',
    websiteUrl: 'https://www.revinate.com/',
    accessModality: 'Contrat enterprise (à partir de ~3-5 k€/an). API REST + webhooks fournis après contractualisation.',
    available: false,
    region: 'Global',
  },
  {
    id: 'trustyou',
    name: 'TrustYou',
    category: 'reviews_reputation',
    brandColor: '#7C3AED',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Reviews aggregation · Munich',
    tooltipDescription:
      'Plateforme allemande d\'agrégation reviews. Sentiment analysis multilingue (incl. arabe), benchmarking concurrentiel, alertes en temps réel. Tarification SaaS abordable pour les conciergeries.',
    websiteUrl: 'https://www.trustyou.com/',
    accessModality: 'Abonnement à partir de ~50 €/propriété/mois. API et webhooks après contractualisation.',
    available: false,
    region: 'EU',
  },
  {
    id: 'hijiffy',
    name: 'HiJiffy',
    category: 'reviews_reputation',
    brandColor: '#6D28D9',
    brandTextColor: '#FFFFFF',
    shortDescription: 'AI guest communication',
    tooltipDescription:
      'Plateforme portugaise d\'IA conversationnelle pour l\'hospitality. Chatbot pré-stay (questions FAQ), in-stay (concierge AI), post-stay (review request automation). Concurrent direct de Hospitable.',
    websiteUrl: 'https://www.hijiffy.com/',
    accessModality: 'Abonnement par propriété (~20-40 €/mois selon plan). OAuth2 + webhooks pour intégration PMS.',
    available: false,
    region: 'EU',
  },

  // ─── Marketing & CRM ─────────────────────────────────────────────────────
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'marketing_crm',
    brandColor: '#FFE01B',
    brandTextColor: '#1F2A37',
    shortDescription: 'Email marketing · grand public',
    tooltipDescription:
      'Plateforme email marketing leader pour les TPE/PME. Campagnes drip, segmentation guest (returning, premium, family), templates responsive. Plan gratuit jusqu\'à 500 contacts — idéal pour les hosts indépendants.',
    websiteUrl: 'https://mailchimp.com/developer/',
    accessModality: 'Compte Mailchimp gratuit (500 contacts) → générer API key dans Account → Extras → API keys.',
    available: false,
    region: 'Global',
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    category: 'marketing_crm',
    brandColor: '#000000',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Email + SMS · e-commerce focus',
    tooltipDescription:
      'Concurrent premium de Mailchimp, axé conversion. Segmentation comportementale poussée, flows automation, A/B tests. Utilisé par les conciergeries DTC qui vendent des séjours en marque blanche.',
    websiteUrl: 'https://developers.klaviyo.com/',
    accessModality: 'Compte Klaviyo (gratuit jusqu\'à 250 contacts) → API key dans Settings → API Keys → Create Private Key.',
    available: false,
    region: 'Global',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    category: 'marketing_crm',
    brandColor: '#000000',
    brandTextColor: '#FFFFFF',
    shortDescription: 'CRM commercial · acquisition hosts',
    tooltipDescription:
      'CRM commercial visuel (pipelines Kanban). Pertinent pour les conciergeries qui cherchent à acquérir de nouveaux propriétaires : tracking leads, séquences emails, prévisions de signature.',
    websiteUrl: 'https://developers.pipedrive.com/',
    accessModality: 'Compte Pipedrive (essai 14j, à partir de ~15 €/utilisateur/mois). API key personnelle dans Personal Preferences → API.',
    available: false,
    region: 'Global',
  },

  // ─── Gestion des cles (key handover) ─────────────────────────────────────
  {
    id: 'clenzy_keyvault',
    name: 'Clenzy KeyVault',
    category: 'key_management',
    brandColor: '#6B8A9A',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Réseau de gardiens propriétaire',
    tooltipDescription:
      'Solution native Clenzy pour gérer votre propre réseau de gardiens de clés (commerçants, particuliers du quartier). Génération de codes à 6 chiffres avec durée de validité, page de vérification web sans appli, suivi en temps réel des mouvements. Alternative gratuite à KeyNest pour les conciergeries qui ont déjà leurs partenaires locaux.',
    websiteUrl: 'https://clenzy.fr',
    accessModality: 'Inclus dans votre abonnement Clenzy (partenaires & codes illimités). Configuration depuis Admin → Gestion des clés → Configurer un gardien.',
    available: true,
    region: 'Global',
    tag: 'free',
    internalRoute: '/admin?tab=keys',
  },
  {
    id: 'keynest',
    name: 'KeyNest',
    category: 'key_management',
    brandColor: '#FF7A00',
    brandTextColor: '#FFFFFF',
    shortDescription: '5 500+ points de dépôt en Europe',
    tooltipDescription:
      'Service professionnel de gardiennage de clés via un réseau de 5 500+ commerces partenaires en Europe (Paris, Londres, Madrid, Amsterdam, etc.). Intégration automatique des codes via API, notifications en temps réel par webhooks, compatible toutes plateformes de location.',
    websiteUrl: 'https://keynest.com',
    accessModality: 'Compte KeyNest Pro requis. Tarification : ~7,14 €/collecte ou abonnement (23,94 €/clé/mois annuel à 29,94 €/clé/mois mensuel). API key fournie après contractualisation.',
    available: false,
    region: 'EU',
    tag: 'partner',
  },

  // ─── Smart Locks complement ──────────────────────────────────────────────
  {
    id: 'nuki',
    name: 'Nuki',
    category: 'smart_locks_iot',
    brandColor: '#FF5C00',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Smart Lock 3.0/4.0 · Nuki Web API',
    tooltipDescription:
      'Fabricant autrichien leader du smart lock en Europe. Smart Lock 3.0 / 4.0 + Bridge WiFi/Bluetooth. Codes d\'accès temporaires via Nuki Web API, verrouillage automatique, logs d\'activité détaillés. Très utilisé dans les locations premium en France et UE.',
    websiteUrl: 'https://developer.nuki.io/',
    accessModality: 'Achat hardware (Smart Lock 4.0 ~250 € + Bridge ~100 €). Compte Nuki Web gratuit → générer un Web API token dans Settings → API. Auth par Bearer token.',
    available: false,
    region: 'EU',
    tag: 'external',
  },

  // ─── Monitoring sonore (noise monitoring) ───────────────────────────────
  {
    id: 'minut',
    name: 'Minut',
    category: 'noise_monitoring',
    brandColor: '#2D3142',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Capteur professionnel · Airbnb partner',
    tooltipDescription:
      'Capteur de bruit certifié suédois, partenaire Airbnb officiel. Mesure niveau sonore, qualité air, présence et température sans enregistrer audio (respect vie privée). Alertes automatiques aux voyageurs en cas de dépassement de seuil, app mobile dédiée, support 24/7.',
    websiteUrl: 'https://www.minut.com/',
    accessModality: 'Capteur (~149 €/unité) + abonnement (9,90 €/capteur/mois mensuel, ou 7,90 €/capteur/mois en annuel). API key fournie via Settings → Integrations dans le dashboard Minut.',
    available: false,
    region: 'Global',
    tag: 'partner',
  },
  {
    id: 'clenzy_hardware',
    name: 'Clenzy Hardware',
    category: 'noise_monitoring',
    brandColor: '#4A9B8E',
    brandTextColor: '#FFFFFF',
    shortDescription: 'Capteur OEM Tuya · sans abonnement',
    tooltipDescription:
      'Solution propriétaire Clenzy basée sur Tuya OEM. Capteur de bruit avec coût unique d\'achat (sans abonnement mensuel récurrent), intégration native dans la plateforme Clenzy, données en temps réel, aucune dépendance à un service externe. Alternative économique à Minut pour les conciergeries qui veulent maîtriser leur TCO.',
    websiteUrl: 'https://clenzy.fr',
    accessModality: 'Capteur Clenzy à acheter (coût unique, contactez le commercial pour un devis). Configuration plug-and-play depuis Admin → Nuisance sonore → Souscrire.',
    available: true,
    region: 'Global',
    tag: 'proprietary',
    internalRoute: '/admin?tab=sound',
  },
];

/** Retourne les services d'une categorie donnee. */
export function getServicesByCategory(category: ServiceCategory): CatalogService[] {
  return CATALOG_SERVICES.filter((s) => s.category === category);
}
