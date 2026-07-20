/**
 * Index plat de TOUS les services integrables, utilise pour la recherche
 * autocomplete et le filtre par categorie dans le header de la tab
 * Integrations.
 *
 * <h2>Pourquoi ce fichier</h2>
 * <p>Les services sont eparpilles dans plusieurs sources (PROVIDER_META de
 * chaque domaine, CATALOG_SERVICES, OTA_CHANNELS, SERVICE_TOOLTIPS). Ce
 * fichier consolide tout en une liste plate searchable + une liste de
 * categories pour le dropdown filtre.</p>
 */

export interface ServiceIndexEntry {
  /** Identifiant unique (matche SERVICE_TOOLTIPS keys quand applicable). */
  id: string;
  /** Nom affiche. */
  name: string;
  /** ID de la categorie (sert au scroll-to + filtre). */
  categoryId: string;
  /** Label de la categorie (affiche dans l'autocomplete groupe). */
  categoryLabel: string;
}

export interface CategoryDef {
  id: string;
  label: string;
  /** ID de l'element DOM pour scroll-to (utilise dans IntegrationsSection). */
  domId: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'signature',            label: 'Signature électronique',     domId: 'section-signature' },
  { id: 'pricing',              label: 'Tarification dynamique',     domId: 'section-pricing' },
  { id: 'accounting',           label: 'Comptabilité',                domId: 'section-accounting' },
  { id: 'compliance',           label: 'Conformité légale',           domId: 'section-compliance' },
  { id: 'kyc',                  label: 'Vérification d\'identité',    domId: 'section-kyc' },
  { id: 'channel_manager',      label: 'Channel Manager middleware',  domId: 'section-channel-manager' },
  { id: 'ota',                  label: 'Canaux OTAs',                 domId: 'section-ota' },
  { id: 'messaging',            label: 'Messagerie',                  domId: 'section-messaging' },
  { id: 'market_intelligence',  label: 'Intelligence de marché',      domId: 'section-market-intelligence' },
  { id: 'tax_automation',       label: 'Fiscalité / Taxe de séjour',  domId: 'section-tax' },
  { id: 'insurance',            label: 'Assurance',                   domId: 'section-insurance' },
  { id: 'cleaning_operations',  label: 'Ménage & opérations',         domId: 'section-cleaning' },
  { id: 'smart_locks_iot',      label: 'Serrures connectées & IoT',   domId: 'section-smart-locks' },
  { id: 'key_management',       label: 'Gestion des clés',            domId: 'section-key-management' },
  { id: 'noise_monitoring',     label: 'Monitoring sonore',           domId: 'section-noise' },
  { id: 'activities_affiliate', label: 'Activités & affiliation',     domId: 'section-activities' },
  { id: 'reviews_reputation',   label: 'Avis & réputation',           domId: 'section-reviews' },
  { id: 'marketing_crm',        label: 'Marketing & CRM',             domId: 'section-marketing' },
];

const CATEGORY_BY_ID: Record<string, CategoryDef> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/**
 * Helper interne : construit une entree d'index a partir d'un service.
 */
function entry(id: string, name: string, categoryId: string): ServiceIndexEntry {
  const cat = CATEGORY_BY_ID[categoryId];
  return {
    id,
    name,
    categoryId,
    categoryLabel: cat?.label ?? categoryId,
  };
}

export const ALL_SERVICES: ServiceIndexEntry[] = [
  // Signature electronique — Phase 2 : Yousign (QTSP) + DocuSeal (self-hosted),
  // implementes mais non branches (workflow interne actif par defaut).
  entry('YOUSIGN', 'Yousign', 'signature'),
  entry('DOCUSEAL', 'DocuSeal', 'signature'),

  // Comptabilite
  entry('PENNYLANE', 'Pennylane', 'accounting'),
  entry('QUICKBOOKS', 'QuickBooks', 'accounting'),
  entry('XERO', 'Xero', 'accounting'),
  entry('SAGE', 'Sage', 'accounting'),

  // Conformite legale
  entry('CHEKIN', 'Chekin', 'compliance'),
  entry('POLICE_MA', 'Police Maroc', 'compliance'),
  entry('ABSHER_KSA', 'Absher', 'compliance'),

  // KYC
  entry('SUMSUB', 'Sumsub', 'kyc'),
  entry('VERIFF', 'Veriff', 'kyc'),
  entry('ONFIDO', 'Onfido', 'kyc'),

  // Channel Manager middleware
  entry('CHANNEX', 'Channex', 'channel_manager'),
  entry('SITEMINDER', 'SiteMinder', 'channel_manager'),
  entry('HOSTAWAY', 'Hostaway', 'channel_manager'),
  entry('RENTALS_UNITED', 'Rentals United', 'channel_manager'),

  // OTAs (lowercase pour matcher otaChannels.ts)
  entry('airbnb', 'Airbnb', 'ota'),
  entry('booking', 'Booking.com', 'ota'),
  entry('expedia', 'Expedia', 'ota'),
  entry('hotels', 'Hotels.com', 'ota'),
  entry('agoda', 'Agoda', 'ota'),
  entry('tripcom', 'Trip.com', 'ota'),
  entry('vrbo', 'Vrbo', 'ota'),
  entry('abritel', 'Abritel', 'ota'),
  entry('hometogo', 'HomeToGo', 'ota'),
  entry('gathern', 'Gathern', 'ota'),
  entry('rentelly', 'Rentelly', 'ota'),
  entry('kease', 'Kease', 'ota'),
  entry('stay', 'Stay.sa', 'ota'),
  entry('mabeet', 'Mabeet', 'ota'),
  entry('almosafer', 'Almosafer', 'ota'),
  entry('tajawal', 'Tajawal', 'ota'),
  entry('wego', 'Wego', 'ota'),

  // Catalogue
  entry('whatsapp_business', 'WhatsApp Business Cloud', 'messaging'),
  entry('airdna', 'AirDNA', 'market_intelligence'),
  entry('mytse', 'MyTSE', 'tax_automation'),
  entry('avalara', 'Avalara MyLodgeTax', 'tax_automation'),
  entry('superhog', 'Superhog', 'insurance'),
  entry('safely', 'Safely', 'insurance'),
  entry('axa_partners', 'AXA Partners', 'insurance'),
  entry('tawuniya', 'Tawuniya', 'insurance'),
  entry('turno', 'Turno', 'cleaning_operations'),
  entry('properly', 'Properly', 'cleaning_operations'),
  entry('breezeway', 'Breezeway', 'cleaning_operations'),
  entry('igloohome', 'Igloohome', 'smart_locks_iot'),
  entry('ttlock', 'TTLock', 'smart_locks_iot'),
  entry('tuya_smart', 'Tuya Smart', 'smart_locks_iot'),
  entry('ecobee', 'Ecobee', 'smart_locks_iot'),
  entry('resideo', 'Resideo (Honeywell)', 'smart_locks_iot'),
  entry('nuki', 'Nuki', 'smart_locks_iot'),
  entry('clenzy_keyvault', 'Baitly KeyVault', 'key_management'),
  entry('keynest', 'KeyNest', 'key_management'),
  entry('minut', 'Minut', 'noise_monitoring'),
  entry('clenzy_hardware', 'Baitly Hardware', 'noise_monitoring'),
  entry('getyourguide', 'GetYourGuide', 'activities_affiliate'),
  entry('klook', 'Klook', 'activities_affiliate'),
  entry('viator', 'Viator', 'activities_affiliate'),
  entry('revinate', 'Revinate', 'reviews_reputation'),
  entry('trustyou', 'TrustYou', 'reviews_reputation'),
  entry('hijiffy', 'HiJiffy', 'reviews_reputation'),
  entry('mailchimp', 'Mailchimp', 'marketing_crm'),
  entry('klaviyo', 'Klaviyo', 'marketing_crm'),
  entry('pipedrive', 'Pipedrive', 'marketing_crm'),
];

/** Retourne le domId d'une categorie (pour scrollIntoView). */
export function getDomIdForCategory(categoryId: string): string | undefined {
  return CATEGORY_BY_ID[categoryId]?.domId;
}
