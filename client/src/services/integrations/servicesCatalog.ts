/**
 * Catalogue des services tiers integrables a Baitly.
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
  | 'noise_monitoring'
  | 'automation'
  | 'guest_experience';

/**
 * Tag commercial du service. Affiche comme un petit chip a cote du nom.
 *   - proprietary : solution Baitly native (incluse / sans abonnement)
 *   - free        : gratuit / inclus dans l'abonnement Baitly
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
  /** Cle de la courte description affichee sous le nom dans la card. */
  shortKey: string;
  /** Cle de la description longue du tooltip. */
  tooltipKey: string;
  /** URL officielle du service (ouverte au click "En savoir plus"). */
  websiteUrl: string;
  /** Cle des modalites d'acces : compte developpeur, partenariat, etc. */
  accessKey: string;
  /** Si true, l'integration a un backend cable. Sinon catalogue info uniquement. */
  available: boolean;
  /** Region(s) cible(es) — affiche en chip discret. */
  region?: 'FR' | 'EU' | 'MA' | 'KSA' | 'MENA' | 'Global';
  /** Tag commercial optionnel (proprietary/free/partner/external). */
  tag?: ServiceTag;
  /**
   * Route interne Baitly si le service est natif/proprietaire. Si presente,
   * le modal affiche "Configurer dans Baitly" qui navigate vers cette route
   * (au lieu de "Visiter le site").
   */
  internalRoute?: string;
}

export const CATALOG_SERVICES: CatalogService[] = [
  // ─── Messaging ────────────────────────────────────────────────────────────
  // WhatsApp est CONFIGURABLE depuis Baitly (available: true). La card est rendue
  // par IntegrationsWhatsAppConfig, qui intercepte le clic pour ouvrir un dialog
  // de config (sélecteur d'org + provider) au lieu de la modale info standard.
  {
    id: 'whatsapp_business',
    name: 'WhatsApp',
    category: 'messaging',
    brandColor: '#25D366',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.whatsapp_business.short',
    tooltipKey: 'servicesCatalog.whatsapp_business.tooltip',
    websiteUrl: 'https://business.whatsapp.com/products/business-platform',
    accessKey: 'servicesCatalog.whatsapp_business.access',
    available: true,
    region: 'Global',
  },

  // ─── Market Intelligence ──────────────────────────────────────────────────
  {
    id: 'airdna',
    name: 'AirDNA',
    category: 'market_intelligence',
    brandColor: '#FF4751',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.airdna.short',
    tooltipKey: 'servicesCatalog.airdna.tooltip',
    websiteUrl: 'https://www.airdna.co/',
    accessKey: 'servicesCatalog.airdna.access',
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
    shortKey: 'servicesCatalog.mytse.short',
    tooltipKey: 'servicesCatalog.mytse.tooltip',
    websiteUrl: 'https://www.mytse.fr/',
    accessKey: 'servicesCatalog.mytse.access',
    available: false,
    region: 'FR',
  },
  {
    id: 'avalara',
    name: 'Avalara MyLodgeTax',
    category: 'tax_automation',
    brandColor: '#FF6F0F',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.avalara.short',
    tooltipKey: 'servicesCatalog.avalara.tooltip',
    websiteUrl: 'https://www.avalara.com/us/en/products/mylodgetax.html',
    accessKey: 'servicesCatalog.avalara.access',
    available: false,
    region: 'Global',
  },

  {
    id: 'efacture_dgi_ma',
    name: 'e-Facture DGI Maroc',
    category: 'tax_automation',
    brandColor: '#C1272D',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.efacture_dgi_ma.short',
    tooltipKey: 'servicesCatalog.efacture_dgi_ma.tooltip',
    websiteUrl: 'https://www.tax.gov.ma/',
    accessKey: 'servicesCatalog.efacture_dgi_ma.access',
    available: false,
    region: 'MA',
  },

  // ─── Insurance ────────────────────────────────────────────────────────────
  {
    id: 'superhog',
    name: 'Superhog',
    category: 'insurance',
    brandColor: '#FF5C00',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.superhog.short',
    tooltipKey: 'servicesCatalog.superhog.tooltip',
    websiteUrl: 'https://superhog.com/',
    accessKey: 'servicesCatalog.superhog.access',
    available: false,
    region: 'EU',
  },
  {
    id: 'safely',
    name: 'Safely',
    category: 'insurance',
    brandColor: '#1B6F8C',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.safely.short',
    tooltipKey: 'servicesCatalog.safely.tooltip',
    websiteUrl: 'https://safely.com/',
    accessKey: 'servicesCatalog.safely.access',
    available: false,
    region: 'Global',
  },
  {
    id: 'axa_partners',
    name: 'AXA Partners',
    category: 'insurance',
    brandColor: '#00008F',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.axa_partners.short',
    tooltipKey: 'servicesCatalog.axa_partners.tooltip',
    websiteUrl: 'https://www.axapartners.com/',
    accessKey: 'servicesCatalog.axa_partners.access',
    available: false,
    region: 'EU',
  },
  {
    id: 'tawuniya',
    name: 'Tawuniya',
    category: 'insurance',
    brandColor: '#005A9C',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.tawuniya.short',
    tooltipKey: 'servicesCatalog.tawuniya.tooltip',
    websiteUrl: 'https://www.tawuniya.com/',
    accessKey: 'servicesCatalog.tawuniya.access',
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
    shortKey: 'servicesCatalog.turno.short',
    tooltipKey: 'servicesCatalog.turno.tooltip',
    websiteUrl: 'https://turno.com/',
    accessKey: 'servicesCatalog.turno.access',
    available: false,
    region: 'EU',
  },
  {
    id: 'properly',
    name: 'Properly',
    category: 'cleaning_operations',
    brandColor: '#0F766E',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.properly.short',
    tooltipKey: 'servicesCatalog.properly.tooltip',
    websiteUrl: 'https://getproperly.com/',
    accessKey: 'servicesCatalog.properly.access',
    available: false,
    region: 'Global',
  },
  {
    id: 'breezeway',
    name: 'Breezeway',
    category: 'cleaning_operations',
    brandColor: '#0EA5E9',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.breezeway.short',
    tooltipKey: 'servicesCatalog.breezeway.tooltip',
    websiteUrl: 'https://www.breezeway.io/',
    accessKey: 'servicesCatalog.breezeway.access',
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
    shortKey: 'servicesCatalog.igloohome.short',
    tooltipKey: 'servicesCatalog.igloohome.tooltip',
    websiteUrl: 'https://www.igloocompany.co/',
    accessKey: 'servicesCatalog.igloohome.access',
    available: false,
    region: 'MENA',
  },
  {
    id: 'ttlock',
    name: 'TTLock',
    category: 'smart_locks_iot',
    brandColor: '#FB923C',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.ttlock.short',
    tooltipKey: 'servicesCatalog.ttlock.tooltip',
    websiteUrl: 'https://www.ttlock.com/',
    accessKey: 'servicesCatalog.ttlock.access',
    available: false,
    region: 'MA',
  },
  {
    id: 'tuya_smart',
    name: 'Tuya Smart',
    category: 'smart_locks_iot',
    brandColor: '#FF4800',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.tuya_smart.short',
    tooltipKey: 'servicesCatalog.tuya_smart.tooltip',
    websiteUrl: 'https://iot.tuya.com/',
    accessKey: 'servicesCatalog.tuya_smart.access',
    available: false,
    region: 'Global',
  },
  {
    id: 'ecobee',
    name: 'Ecobee',
    category: 'smart_locks_iot',
    brandColor: '#0E4F7A',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.ecobee.short',
    tooltipKey: 'servicesCatalog.ecobee.tooltip',
    websiteUrl: 'https://www.ecobee.com/developers/',
    accessKey: 'servicesCatalog.ecobee.access',
    available: false,
    region: 'Global',
  },
  {
    id: 'resideo',
    name: 'Resideo (Honeywell)',
    category: 'smart_locks_iot',
    brandColor: '#E31837',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.resideo.short',
    tooltipKey: 'servicesCatalog.resideo.tooltip',
    websiteUrl: 'https://developer.honeywellhome.com/',
    accessKey: 'servicesCatalog.resideo.access',
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
    shortKey: 'servicesCatalog.getyourguide.short',
    tooltipKey: 'servicesCatalog.getyourguide.tooltip',
    websiteUrl: 'https://partner.getyourguide.com/',
    accessKey: 'servicesCatalog.getyourguide.access',
    available: true,
    region: 'EU',
  },
  {
    id: 'klook',
    name: 'Klook',
    category: 'activities_affiliate',
    brandColor: '#FF5722',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.klook.short',
    tooltipKey: 'servicesCatalog.klook.tooltip',
    websiteUrl: 'https://affiliate.klook.com/',
    accessKey: 'servicesCatalog.klook.access',
    available: true,
    region: 'MENA',
  },
  {
    id: 'viator',
    name: 'Viator',
    category: 'activities_affiliate',
    brandColor: '#328E04',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.viator.short',
    tooltipKey: 'servicesCatalog.viator.tooltip',
    websiteUrl: 'https://www.viatorpartners.com/',
    accessKey: 'servicesCatalog.viator.access',
    available: true,
    region: 'Global',
  },

  // ─── Reviews & Reputation ────────────────────────────────────────────────
  {
    id: 'revinate',
    name: 'Revinate',
    category: 'reviews_reputation',
    brandColor: '#D71F44',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.revinate.short',
    tooltipKey: 'servicesCatalog.revinate.tooltip',
    websiteUrl: 'https://www.revinate.com/',
    accessKey: 'servicesCatalog.revinate.access',
    available: false,
    region: 'Global',
  },
  {
    id: 'trustyou',
    name: 'TrustYou',
    category: 'reviews_reputation',
    brandColor: '#7C3AED',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.trustyou.short',
    tooltipKey: 'servicesCatalog.trustyou.tooltip',
    websiteUrl: 'https://www.trustyou.com/',
    accessKey: 'servicesCatalog.trustyou.access',
    available: false,
    region: 'EU',
  },
  {
    id: 'hijiffy',
    name: 'HiJiffy',
    category: 'reviews_reputation',
    brandColor: '#6D28D9',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.hijiffy.short',
    tooltipKey: 'servicesCatalog.hijiffy.tooltip',
    websiteUrl: 'https://www.hijiffy.com/',
    accessKey: 'servicesCatalog.hijiffy.access',
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
    shortKey: 'servicesCatalog.mailchimp.short',
    tooltipKey: 'servicesCatalog.mailchimp.tooltip',
    websiteUrl: 'https://mailchimp.com/developer/',
    accessKey: 'servicesCatalog.mailchimp.access',
    available: false,
    region: 'Global',
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    category: 'marketing_crm',
    brandColor: '#000000',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.klaviyo.short',
    tooltipKey: 'servicesCatalog.klaviyo.tooltip',
    websiteUrl: 'https://developers.klaviyo.com/',
    accessKey: 'servicesCatalog.klaviyo.access',
    available: false,
    region: 'Global',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    category: 'marketing_crm',
    brandColor: '#000000',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.pipedrive.short',
    tooltipKey: 'servicesCatalog.pipedrive.tooltip',
    websiteUrl: 'https://developers.pipedrive.com/',
    accessKey: 'servicesCatalog.pipedrive.access',
    available: false,
    region: 'Global',
  },

  // ─── Gestion des cles (key handover) ─────────────────────────────────────
  {
    id: 'clenzy_keyvault',
    name: 'Baitly KeyVault',
    category: 'key_management',
    brandColor: '#6B8A9A',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.clenzy_keyvault.short',
    tooltipKey: 'servicesCatalog.clenzy_keyvault.tooltip',
    websiteUrl: 'https://clenzy.fr',
    accessKey: 'servicesCatalog.clenzy_keyvault.access',
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
    shortKey: 'servicesCatalog.keynest.short',
    tooltipKey: 'servicesCatalog.keynest.tooltip',
    websiteUrl: 'https://keynest.com',
    accessKey: 'servicesCatalog.keynest.access',
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
    shortKey: 'servicesCatalog.nuki.short',
    tooltipKey: 'servicesCatalog.nuki.tooltip',
    websiteUrl: 'https://developer.nuki.io/',
    accessKey: 'servicesCatalog.nuki.access',
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
    shortKey: 'servicesCatalog.minut.short',
    tooltipKey: 'servicesCatalog.minut.tooltip',
    websiteUrl: 'https://www.minut.com/',
    accessKey: 'servicesCatalog.minut.access',
    available: false,
    region: 'Global',
    tag: 'partner',
  },
  {
    id: 'clenzy_hardware',
    name: 'Baitly Hardware',
    category: 'noise_monitoring',
    brandColor: '#4A9B8E',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.clenzy_hardware.short',
    tooltipKey: 'servicesCatalog.clenzy_hardware.tooltip',
    websiteUrl: 'https://clenzy.fr',
    accessKey: 'servicesCatalog.clenzy_hardware.access',
    available: true,
    region: 'Global',
    tag: 'proprietary',
    internalRoute: '/admin?tab=sound',
  },

  // ─── Automatisation & Webhooks ───────────────────────────────────────────
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'automation',
    brandColor: '#FF4F00',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.zapier.short',
    tooltipKey: 'servicesCatalog.zapier.tooltip',
    websiteUrl: 'https://zapier.com',
    accessKey: 'servicesCatalog.zapier.access',
    available: false,
    region: 'Global',
  },
  {
    id: 'make',
    name: 'Make',
    category: 'automation',
    brandColor: '#6D00CC',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.make.short',
    tooltipKey: 'servicesCatalog.make.tooltip',
    websiteUrl: 'https://www.make.com',
    accessKey: 'servicesCatalog.make.access',
    available: false,
    region: 'EU',
  },

  // ─── Expérience guest ────────────────────────────────────────────────────
  {
    id: 'duve',
    name: 'Duve',
    category: 'guest_experience',
    brandColor: '#2E5BFF',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.duve.short',
    tooltipKey: 'servicesCatalog.duve.tooltip',
    websiteUrl: 'https://www.duve.com',
    accessKey: 'servicesCatalog.duve.access',
    available: false,
    region: 'Global',
  },
  {
    id: 'enso_connect',
    name: 'Enso Connect',
    category: 'guest_experience',
    brandColor: '#0E1E3C',
    brandTextColor: '#FFFFFF',
    shortKey: 'servicesCatalog.enso_connect.short',
    tooltipKey: 'servicesCatalog.enso_connect.tooltip',
    websiteUrl: 'https://ensoconnect.com',
    accessKey: 'servicesCatalog.enso_connect.access',
    available: false,
    region: 'Global',
  },
];

/** Retourne les services d'une categorie donnee. */
export function getServicesByCategory(category: ServiceCategory): CatalogService[] {
  return CATALOG_SERVICES.filter((s) => s.category === category);
}
