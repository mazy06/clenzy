/**
 * Metadata des tooltips pour TOUS les services d'integration affiches dans
 * l'onglet Integrations (Signature, Pricing, Accounting, Compliance, KYC,
 * Channel Manager, OTAs).
 *
 * <h2>Source de verite unique</h2>
 * <p>Cle = provider ID (en majuscules pour la plupart, lowercase pour les
 * OTAs qui suivent leur convention). Permet a chaque card de looker up
 * sa tooltip data sans duplication.</p>
 *
 * <h2>Format aligne sur servicesCatalog.ts</h2>
 * <p>Memes champs (description, accessModality, websiteUrl, region) pour
 * que le composant {@code ServiceTooltip} puisse render uniformement les
 * tooltips de tout l'ecran.</p>
 */

export interface ServiceTooltipData {
  /** Cles i18n — les libelles vivent dans `serviceTooltips.<id>.*`. */
  descriptionKey: string;
  accessKey: string;
  websiteUrl: string;
  region?: 'FR' | 'EU' | 'MA' | 'KSA' | 'MENA' | 'Global';
}

export const SERVICE_TOOLTIPS: Record<string, ServiceTooltipData> = {
  // ─── Signature electronique (Phase 2 : implémentés, à brancher) ─────────
  YOUSIGN: {
    descriptionKey: 'serviceTooltips.YOUSIGN.description',
    accessKey: 'serviceTooltips.YOUSIGN.access',
    websiteUrl: 'https://yousign.com',
    region: 'FR',
  },
  DOCUSEAL: {
    descriptionKey: 'serviceTooltips.DOCUSEAL.description',
    accessKey: 'serviceTooltips.DOCUSEAL.access',
    websiteUrl: 'https://www.docuseal.com',
    region: 'Global',
  },
  PENNYLANE: {
    descriptionKey: 'serviceTooltips.PENNYLANE.description',
    accessKey: 'serviceTooltips.PENNYLANE.access',
    websiteUrl: 'https://developers.pennylane.com',
    region: 'FR',
  },

  // ─── Intelligence de marché (sources actives) ──────────────────────────
  AIRBTICS: {
    descriptionKey: 'serviceTooltips.AIRBTICS.description',
    accessKey: 'serviceTooltips.AIRBTICS.access',
    websiteUrl: 'https://airbtics.com',
    region: 'Global',
  },
  AIRROI: {
    descriptionKey: 'serviceTooltips.AIRROI.description',
    accessKey: 'serviceTooltips.AIRROI.access',
    websiteUrl: 'https://www.airroi.com',
    region: 'Global',
  },

  // ─── Comptabilite (OAuth2) ─────────────────────────────────────────────
  QUICKBOOKS: {
    descriptionKey: 'serviceTooltips.QUICKBOOKS.description',
    accessKey: 'serviceTooltips.QUICKBOOKS.access',
    websiteUrl: 'https://developer.intuit.com',
    region: 'Global',
  },
  XERO: {
    descriptionKey: 'serviceTooltips.XERO.description',
    accessKey: 'serviceTooltips.XERO.access',
    websiteUrl: 'https://developer.xero.com',
    region: 'EU',
  },
  SAGE: {
    descriptionKey: 'serviceTooltips.SAGE.description',
    accessKey: 'serviceTooltips.SAGE.access',
    websiteUrl: 'https://developer.sage.com',
    region: 'EU',
  },

  // ─── Conformite legale (declaration voyageurs) ─────────────────────────
  CHEKIN: {
    descriptionKey: 'serviceTooltips.CHEKIN.description',
    accessKey: 'serviceTooltips.CHEKIN.access',
    websiteUrl: 'https://chekin.com',
    region: 'EU',
  },
  POLICE_MA: {
    descriptionKey: 'serviceTooltips.POLICE_MA.description',
    accessKey: 'serviceTooltips.POLICE_MA.access',
    websiteUrl: 'https://www.dgsn.gov.ma',
    region: 'MA',
  },
  ABSHER_KSA: {
    descriptionKey: 'serviceTooltips.ABSHER_KSA.description',
    accessKey: 'serviceTooltips.ABSHER_KSA.access',
    websiteUrl: 'https://www.absher.sa',
    region: 'KSA',
  },
  SHOMOOS: {
    descriptionKey: 'serviceTooltips.SHOMOOS.description',
    accessKey: 'serviceTooltips.SHOMOOS.access',
    websiteUrl: 'https://shomoos.com.sa',
    region: 'KSA',
  },

  // ─── KYC / Verification d'identite ─────────────────────────────────────
  SUMSUB: {
    descriptionKey: 'serviceTooltips.SUMSUB.description',
    accessKey: 'serviceTooltips.SUMSUB.access',
    websiteUrl: 'https://sumsub.com',
    region: 'MENA',
  },
  VERIFF: {
    descriptionKey: 'serviceTooltips.VERIFF.description',
    accessKey: 'serviceTooltips.VERIFF.access',
    websiteUrl: 'https://www.veriff.com',
    region: 'EU',
  },
  ONFIDO: {
    descriptionKey: 'serviceTooltips.ONFIDO.description',
    accessKey: 'serviceTooltips.ONFIDO.access',
    websiteUrl: 'https://onfido.com',
    region: 'Global',
  },

  // ─── Channel Manager middleware ────────────────────────────────────────
  SITEMINDER: {
    descriptionKey: 'serviceTooltips.SITEMINDER.description',
    accessKey: 'serviceTooltips.SITEMINDER.access',
    websiteUrl: 'https://www.siteminder.com',
    region: 'Global',
  },
  HOSTAWAY: {
    descriptionKey: 'serviceTooltips.HOSTAWAY.description',
    accessKey: 'serviceTooltips.HOSTAWAY.access',
    websiteUrl: 'https://www.hostaway.com',
    region: 'Global',
  },
  RENTALS_UNITED: {
    descriptionKey: 'serviceTooltips.RENTALS_UNITED.description',
    accessKey: 'serviceTooltips.RENTALS_UNITED.access',
    websiteUrl: 'https://rentalsunited.com',
    region: 'EU',
  },
  CHANNEX: {
    descriptionKey: 'serviceTooltips.CHANNEX.description',
    accessKey: 'serviceTooltips.CHANNEX.access',
    websiteUrl: 'https://channex.io',
    region: 'Global',
  },

  // ─── OTAs (channels de reservation) ────────────────────────────────────
  airbnb: {
    descriptionKey: 'serviceTooltips.airbnb.description',
    accessKey: 'serviceTooltips.airbnb.access',
    websiteUrl: 'https://partners.airbnb.com',
    region: 'Global',
  },
  booking: {
    descriptionKey: 'serviceTooltips.booking.description',
    accessKey: 'serviceTooltips.booking.access',
    websiteUrl: 'https://connect.booking.com',
    region: 'Global',
  },
  expedia: {
    descriptionKey: 'serviceTooltips.expedia.description',
    accessKey: 'serviceTooltips.expedia.access',
    websiteUrl: 'https://welcome.expediagroup.com',
    region: 'Global',
  },
  hotels: {
    descriptionKey: 'serviceTooltips.hotels.description',
    accessKey: 'serviceTooltips.hotels.access',
    websiteUrl: 'https://www.hotels.com',
    region: 'Global',
  },
  agoda: {
    descriptionKey: 'serviceTooltips.agoda.description',
    accessKey: 'serviceTooltips.agoda.access',
    websiteUrl: 'https://partnerhub.agoda.com',
    region: 'MENA',
  },
  tripcom: {
    descriptionKey: 'serviceTooltips.tripcom.description',
    accessKey: 'serviceTooltips.tripcom.access',
    websiteUrl: 'https://www.trip.com',
    region: 'MENA',
  },
  vrbo: {
    descriptionKey: 'serviceTooltips.vrbo.description',
    accessKey: 'serviceTooltips.vrbo.access',
    websiteUrl: 'https://www.vrbo.com',
    region: 'Global',
  },
  abritel: {
    descriptionKey: 'serviceTooltips.abritel.description',
    accessKey: 'serviceTooltips.abritel.access',
    websiteUrl: 'https://www.abritel.fr',
    region: 'FR',
  },
  hometogo: {
    descriptionKey: 'serviceTooltips.hometogo.description',
    accessKey: 'serviceTooltips.hometogo.access',
    websiteUrl: 'https://www.hometogo.com',
    region: 'EU',
  },
  gathern: {
    descriptionKey: 'serviceTooltips.gathern.description',
    accessKey: 'serviceTooltips.gathern.access',
    websiteUrl: 'https://gathern.co',
    region: 'KSA',
  },
  rentelly: {
    descriptionKey: 'serviceTooltips.rentelly.description',
    accessKey: 'serviceTooltips.rentelly.access',
    websiteUrl: 'https://rentelly.com',
    region: 'MENA',
  },
  kease: {
    descriptionKey: 'serviceTooltips.kease.description',
    accessKey: 'serviceTooltips.kease.access',
    websiteUrl: 'https://kease.app',
    region: 'MENA',
  },
  stay: {
    descriptionKey: 'serviceTooltips.stay.description',
    accessKey: 'serviceTooltips.stay.access',
    websiteUrl: 'https://stay.sa',
    region: 'KSA',
  },
  mabeet: {
    descriptionKey: 'serviceTooltips.mabeet.description',
    accessKey: 'serviceTooltips.mabeet.access',
    websiteUrl: 'https://mabeet.com',
    region: 'KSA',
  },
  almosafer: {
    descriptionKey: 'serviceTooltips.almosafer.description',
    accessKey: 'serviceTooltips.almosafer.access',
    websiteUrl: 'https://www.almosafer.com',
    region: 'KSA',
  },
  tajawal: {
    descriptionKey: 'serviceTooltips.tajawal.description',
    accessKey: 'serviceTooltips.tajawal.access',
    websiteUrl: 'https://www.tajawal.com',
    region: 'MENA',
  },
  wego: {
    descriptionKey: 'serviceTooltips.wego.description',
    accessKey: 'serviceTooltips.wego.access',
    websiteUrl: 'https://www.wego.com',
    region: 'MENA',
  },

  // ─── Objets connectes (IoT) ────────────────────────────────────────────
  TUYA: {
    descriptionKey: 'serviceTooltips.TUYA.description',
    accessKey: 'serviceTooltips.TUYA.access',
    websiteUrl: 'https://iot.tuya.com',
    region: 'Global',
  },
  MINUT: {
    descriptionKey: 'serviceTooltips.MINUT.description',
    accessKey: 'serviceTooltips.MINUT.access',
    websiteUrl: 'https://www.minut.com',
    region: 'EU',
  },

  // ─── Marketing / Emailing ──────────────────────────────────────────────
  BREVO: {
    descriptionKey: 'serviceTooltips.BREVO.description',
    accessKey: 'serviceTooltips.BREVO.access',
    websiteUrl: 'https://www.brevo.com',
    region: 'FR',
  },
};
