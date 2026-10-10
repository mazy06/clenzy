/** Illustrations Baitly associées aux codes du référentiel métier. */
export const PROVIDER_SECTOR_IMAGES: Record<string, string> = {
  CLEANING: '/images/catalog/cleaning.webp',
  LAUNDRY: '/images/catalog/sector-laundry.webp',
  LINEN: '/images/catalog/sector-linen.webp',
  SUPPLIES: '/images/catalog/other-service.webp',
  KEYS: '/images/dashboard-kpis/adr.webp',
  LOGISTICS: '/images/catalog/sector-logistics.webp',
  SECURITY: '/images/catalog/sector-security.webp',
  CONCIERGE: '/images/catalog/sector-concierge.webp',
  MAINTENANCE: '/images/catalog/sector-maintenance.webp',
  LOCKSMITH: '/images/catalog/sector-locksmith.webp',
  EXTERIOR: '/images/catalog/sector-garden.webp',
  POOL: '/images/catalog/sector-pool.webp',
  PEST_CONTROL: '/images/catalog/sector-pest-control.webp',
  REGULATORY: '/images/catalog/sector-regulatory.webp',
  RENOVATION: '/images/catalog/sector-renovation.webp',
  CULINARY: '/images/catalog/via-cooking.webp',
  DRIVER: '/images/catalog/transfer.webp',
  MOBILITY: '/images/catalog/sector-vehicle-rental.webp',
  TOURIST_GUIDE: '/images/catalog/excursion-guide.webp',
  ACTIVITIES: '/images/catalog/gyg-balloon.webp',
  WELLNESS: '/images/catalog/sector-wellness.webp',
  CHILDCARE: '/images/catalog/sector-childcare.webp',
  PET_CARE: '/images/catalog/sector-pet-care.webp',
  EQUIPMENT_RENTAL: '/images/catalog/equipment.webp',
  PHOTOGRAPHY: '/images/catalog/sector-photography.webp',
  FURNISHING: '/images/catalog/sector-furnishing.webp',
  MARKETING: '/images/catalog/sector-marketing.webp',
  ADMIN_LEGAL: '/images/catalog/sector-legal.webp',
  ACCOUNTING: '/images/catalog/sector-accounting.webp',
  INSURANCE: '/images/catalog/sector-insurance.webp',
  UTILITIES: '/images/catalog/sector-utilities.webp',
  OTHER: '/images/catalog/provider.webp',
};

/** Le premier secteur connu définit le visuel ; un secteur futur reste lisible. */
export function providerSectorImage(categoryCodes: string[]): string {
  return categoryCodes.map(code => PROVIDER_SECTOR_IMAGES[code]).find(Boolean)
    ?? PROVIDER_SECTOR_IMAGES.OTHER;
}
