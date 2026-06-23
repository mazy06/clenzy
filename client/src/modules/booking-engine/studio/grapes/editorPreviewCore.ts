import { BaitlyBookingCore } from '../../sdk/core/BaitlyBookingCore';
import type { MountContext } from '../../sdk/primitives/mountPrimitive';
import type { BaitlyBookingConfig, WidgetProperty, WidgetState, PriceBreakdown, PropertyTypeInfo, DayAvailability } from '../../sdk/types';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';
import { API_CONFIG } from '../../../../config/api';

/**
 * Cœur d'APERÇU ÉDITEUR : un seul `BaitlyBookingCore` PARTAGÉ par tous les widgets d'une page dans le
 * Studio (≠ ancien montage isolé par bloc) → les widgets « se parlent » dans l'éditeur (choisir des
 * dates remplit le Récap, sélectionner un logement remplit le Détail, etc.).
 *
 * Spécificités éditeur :
 *  - `persist: false` + `start()` JAMAIS appelé → AUCUN appel réseau (l'éditeur ne touche pas l'API booking) ;
 *  - état seedé de DONNÉES DE DÉMO (logements) + PRIX DE DÉMO recalculé au choix des dates / du logement.
 * Le site PUBLIÉ, lui, utilise le vrai cœur (API + pricing serveur) via `bootstrap.hydrateBookingMarkers`.
 */

/** Image placeholder (data URI, aucun réseau) pour les cartes de logement de démo. */
const DEMO_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#e6e3dd"/>' +
      '<text x="50%" y="50%" fill="#a8a29a" font-family="sans-serif" font-size="22" text-anchor="middle" dominant-baseline="middle">Photo</text></svg>',
  );

/** Logements de démo (aperçu éditeur uniquement). */
const DEMO_PROPERTIES: WidgetProperty[] = [
  { id: 9001, name: 'Riad El Fenn', type: 'Riad', city: 'Marrakech', country: 'Maroc', bedroomCount: 4, bathroomCount: 3, maxGuests: 8, priceFrom: 180, cleaningFee: 40, minimumNights: 2, currency: 'EUR', mainPhotoUrl: DEMO_IMG, amenities: ['Wifi', 'Piscine', 'Climatisation', 'Petit-déjeuner', 'Terrasse'], checkInTime: '15:00', checkOutTime: '11:00', totalBookings: 128, availableDays30: 12 },
  { id: 9002, name: 'Dar Yasmine', type: 'Riad', city: 'Marrakech', country: 'Maroc', bedroomCount: 3, bathroomCount: 2, maxGuests: 6, priceFrom: 140, cleaningFee: 35, minimumNights: 2, currency: 'EUR', mainPhotoUrl: DEMO_IMG, amenities: ['Wifi', 'Hammam', 'Climatisation', 'Terrasse'], checkInTime: '15:00', checkOutTime: '11:00', totalBookings: 86, availableDays30: 18 },
  { id: 9003, name: 'Villa Palmeraie', type: 'Villa', city: 'Marrakech', country: 'Maroc', bedroomCount: 5, bathroomCount: 5, maxGuests: 10, priceFrom: 320, cleaningFee: 80, minimumNights: 3, currency: 'EUR', mainPhotoUrl: DEMO_IMG, amenities: ['Wifi', 'Piscine privée', 'Jardin', 'Climatisation', 'Parking'], checkInTime: '16:00', checkOutTime: '10:00', totalBookings: 54, availableDays30: 9 },
];

/** Types de logement de démo dérivés des logements de démo (pour le filtre « Type de logement »). */
function deriveDemoTypes(props: WidgetProperty[]): PropertyTypeInfo[] {
  const byCode = new Map<string, { count: number; minPrice: number }>();
  for (const p of props) {
    const code = p.type || 'Autre';
    const price = p.priceFrom ?? 0;
    const cur = byCode.get(code);
    if (cur) { cur.count += 1; cur.minPrice = Math.min(cur.minPrice, price); }
    else byCode.set(code, { count: 1, minPrice: price });
  }
  return [...byCode.entries()].map(([code, v]) => ({ code, label: code, count: v.count, minPrice: v.minPrice || null }));
}

/**
 * Disponibilité de DÉMO (aperçu éditeur) : ~90 jours, tous disponibles, prix nuitée = le plus bas parmi
 * les logements de démo (≈ ce que renvoie le calendrier agrégé au runtime). Le cœur démo n'est jamais
 * `start()` → pas de fetch ; on seed pour que le calendrier affiche des prix dans le builder.
 */
function buildDemoAvailability(props: WidgetProperty[]): Map<string, DayAvailability> {
  const minPrice = props.reduce((m, p) => (p.priceFrom != null ? Math.min(m, p.priceFrom) : m), Infinity);
  const map = new Map<string, DayAvailability>();
  if (!Number.isFinite(minPrice)) return map;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 90; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    map.set(ds, { date: ds, available: true, minPrice, minNights: 1 });
  }
  return map;
}

/** Nombre de nuits entre deux dates ISO (YYYY-MM-DD), au moins 1. */
function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** Devis de DÉMO (prix éditeur) à partir du logement sélectionné + dates. */
function buildDemoPricing(s: WidgetState, i18n: { t: (k: string) => string }): PriceBreakdown | null {
  const prop = s.properties.find((p) => p.id === s.selectedPropertyId) ?? s.properties[0];
  if (!prop || !s.checkIn || !s.checkOut) return null;
  const nights = nightsBetween(s.checkIn, s.checkOut);
  const nightly = prop.priceFrom ?? 120;
  const subtotal = nightly * nights;
  const cleaning = prop.cleaningFee ?? 0;
  const lines: PriceBreakdown['lines'] = [{ label: `${nights} ${i18n.t('cart.nights')}`, amount: subtotal, type: 'base' }];
  if (cleaning > 0) lines.push({ label: i18n.t('validation.cleaningFee'), amount: cleaning, type: 'fee' });
  return { nightlyRate: nightly, nights, subtotal, cleaningFee: cleaning, addonsTotal: 0, total: subtotal + cleaning, currency: prop.currency, lines };
}

export interface EditorPreview {
  ctx: MountContext;
  destroy: () => void;
}

/** Crée le cœur d'aperçu éditeur (partagé) + son `MountContext`, seedé de données de démo. */
export function createEditorPreview(config: BookingEngineConfig | null): EditorPreview {
  const lang = (['fr', 'en', 'ar'].includes(config?.defaultLanguage ?? '') ? config?.defaultLanguage : 'fr') as 'fr' | 'en' | 'ar';
  const core = new BaitlyBookingCore({
    apiKey: `editor-preview-${config?.apiKey ?? 'x'}`,
    baseUrl: API_CONFIG.BASE_URL,
    language: lang,
    defaults: { adults: 2, children: 0, displayCurrency: config?.defaultCurrency || 'EUR' },
    persist: false, // éditeur : aucune persistance sessionStorage
  });
  // start() N'EST PAS appelé → aucun effet réseau. On seed l'état de démo à la place.
  core.state.set({
    properties: DEMO_PROPERTIES,
    selectedPropertyId: DEMO_PROPERTIES[0].id,
    propertyTypes: deriveDemoTypes(DEMO_PROPERTIES),
    availability: buildDemoAvailability(DEMO_PROPERTIES),
  }, 'stateChange');

  // Prix de démo recalculé au choix des dates.
  const offDates = core.state.on('dateSelected', (s: WidgetState) => {
    core.state.set({ pricing: buildDemoPricing(s, core.i18n), pricingLoading: false }, 'priceUpdated');
  });
  // Recalcul si le logement change alors que des dates sont posées (guard anti-réentrance).
  let prevProp = core.state.get().selectedPropertyId;
  let applying = false;
  const offProp = core.state.on('stateChange', (s: WidgetState) => {
    if (applying || s.selectedPropertyId === prevProp) return;
    prevProp = s.selectedPropertyId;
    if (s.checkIn && s.checkOut) {
      applying = true;
      core.state.set({ pricing: buildDemoPricing(s, core.i18n) }, 'priceUpdated');
      applying = false;
    }
  });

  const ctx: MountContext = {
    core,
    i18n: core.i18n,
    theme: undefined, // headless : le skin du template gouverne le cosmétique
    preview: true, // neutralise navigation / paiement / envoi de demande dans l'éditeur

    config: {
      container: '',
      apiKey: config?.apiKey || 'editor-preview',
      baseUrl: API_CONFIG.BASE_URL,
      organizationId: config?.organizationId,
      language: lang,
      currency: config?.defaultCurrency,
      maxGuests: 10,
    } satisfies BaitlyBookingConfig,
  };

  return {
    ctx,
    destroy: () => {
      offDates();
      offProp();
      core.destroy();
    },
  };
}
