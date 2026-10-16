import { baitlyDataMode, canUseBaitlyDemo } from '@/config/baitlyDataMode';
import type { CatalogPage, CatalogProvider, CatalogReview, ServiceCategory } from './api';
import reviewSnapshot from './baitlyDemoReviews.json';

/** Explicit local preview, never an automatic fallback for an empty real catalog. */
export function isBaitlyDemoCatalogEnabled() {
  return canUseBaitlyDemo() && baitlyDataMode() === 'demo';
}

export const baitlyDemoCategories: ServiceCategory[] = [
  { code: 'cleaning', labelFr: 'Ménage', labelEn: 'Cleaning', items: [] },
  { code: 'laundry', labelFr: 'Blanchisserie', labelEn: 'Laundry', items: [] },
  { code: 'maintenance', labelFr: 'Maintenance', labelEn: 'Maintenance', items: [] },
  { code: 'exterior', labelFr: 'Jardin', labelEn: 'Garden', items: [] },
  { code: 'pool', labelFr: 'Piscine', labelEn: 'Pool', items: [] },
];

// Synthetic profiles use negative IDs so they cannot target a real provider.
export const baitlyDemoProviders: CatalogProvider[] = [
  { id: -1, displayName: 'Dar Zellige', headline: 'Ménage et blanchisserie', categoryCodes: ['cleaning', 'laundry'],
    priceFrom: 350, offers: [
      { id: -11, categoryCode: 'cleaning', label: 'Ménage de départ', pricingModel: 'FIXED', amount: 350, currency: 'MAD', active: true },
      { id: -12, categoryCode: 'laundry', label: 'Linge de maison', pricingModel: 'FIXED', amount: 120, currency: 'MAD', active: true },
    ] },
  { id: -2, displayName: 'Piscines Ourika', headline: 'Entretien et remise en service', categoryCodes: ['pool'], priceFrom: 450,
    offers: [{ id: -21, categoryCode: 'pool', label: 'Entretien de piscine', pricingModel: 'FIXED', amount: 450, currency: 'MAD', active: true }] },
  { id: -3, displayName: 'Jardins de l’Atlas', headline: 'Jardin et espaces extérieurs', categoryCodes: ['exterior'], priceFrom: 250,
    offers: [{ id: -31, categoryCode: 'exterior', label: 'Entretien du jardin', pricingModel: 'FIXED', amount: 250, currency: 'MAD', active: true }] },
  { id: -4, displayName: 'Riad Services', headline: 'Maintenance et petits travaux', categoryCodes: ['maintenance'], priceFrom: null,
    offers: [{ id: -41, categoryCode: 'maintenance', label: 'Petits travaux', pricingModel: 'ON_QUOTE', active: true }] },
  { id: -5, displayName: 'Blanchisserie Atlas', headline: 'Collecte et entretien du linge', categoryCodes: ['laundry'], priceFrom: 180,
    offers: [{ id: -51, categoryCode: 'laundry', label: 'Collecte et lavage', pricingModel: 'FIXED', amount: 180, currency: 'MAD', active: true }] },
].map((profile, index) => {
  const demoReviews = (reviewSnapshot as CatalogReview[]).filter(review => review.demo && review.providerId === profile.id);
  return { ...profile, demoReviews, ratingCount: demoReviews.length,
  ratingAvg: demoReviews.length ? demoReviews.reduce((sum, review) => sum + review.rating, 0) / demoReviews.length : null,
  baseCity: 'Marrakech', baseCountryCode: 'MA', coverageCities: ['Marrakech'], languages: ['fr', 'ar'],
  travelRadiusKm: [15, 25, 12, 10, 8][index],
  demoPosition: [{ latitude: 31.632, longitude: -7.989 }, { latitude: 31.589, longitude: -7.955 },
    { latitude: 31.654, longitude: -8.015 }, { latitude: 31.625, longitude: -8.036 },
    { latitude: 31.607, longitude: -7.999 }][index],
  currency: 'MAD', verified: false, own: false, demo: true };
});

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

export function baitlyDemoCatalog(query: string, category: string, page: number, city = ''): CatalogPage<CatalogProvider> {
  const filtered = baitlyDemoProviders.filter(p => (!category || p.categoryCodes.includes(category))
    && (!city || normalize(p.baseCity ?? '').includes(normalize(city)))
    && (!query || normalize([p.displayName, p.headline, p.baseCity, ...p.coverageCities, ...p.offers.map(o => o.label)].join(' ')).includes(normalize(query))));
  return { items: filtered.slice(page * 20, (page + 1) * 20), page, size: 20,
    totalElements: filtered.length, totalPages: Math.ceil(filtered.length / 20) };
}

export function baitlyDemoProvider(id: number): CatalogProvider {
  const provider = baitlyDemoProviders.find(p => p.id === id);
  if (!provider) throw new Error('Profil de démonstration Baitly introuvable');
  return provider;
}
