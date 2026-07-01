import { BaitlyBookingCore } from '../../sdk/core/BaitlyBookingCore';
import type { MountContext } from '../../sdk/primitives/mountPrimitive';
import type { BaitlyBookingConfig, WidgetProperty, WidgetState, PriceBreakdown, PropertyTypeInfo, DayAvailability } from '../../sdk/types';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';
import { propertiesApi, type Property } from '../../../../services/api/propertiesApi';
import { reviewsApi } from '../../../../services/api/reviewsApi';
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

/** Placeholders DISTINCTS (data URI) pour la galerie de démo (photo principale + miniatures). */
const mkPhoto = (n: number, fill: string): string =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${fill}"/><text x="50%" y="50%" fill="#8a7c6f" font-family="sans-serif" font-size="20" text-anchor="middle" dominant-baseline="middle">Photo ${n}</text></svg>`,
  );
const DEMO_PHOTOS: string[] = [mkPhoto(1, '#e6ddce'), mkPhoto(2, '#dcd0bd'), mkPhoto(3, '#d4c4ad'), mkPhoto(4, '#cabb9f')];

/**
 * Logements de démo (aperçu éditeur, mode MOCK). Miroir EXACT du jeu de démo backend
 * ({@code BookingMockDataProvider}, ids 9001..9006) → le canvas en MOCK montre le même catalogue
 * que le site PUBLIÉ en MOCK. En mode REAL, ce jeu est remplacé par les vraies propriétés du tenant.
 */
const DEMO_PROPERTIES: WidgetProperty[] = [
  { id: 9001, name: 'Villa Azur', type: 'VILLA', city: 'Nice', country: 'France', bedroomCount: 4, bathroomCount: 3, maxGuests: 8, priceFrom: 450, cleaningFee: 50, minimumNights: 2, currency: 'EUR', mainPhotoUrl: DEMO_IMG, photoUrls: DEMO_PHOTOS, amenities: ['wifi', 'piscine', 'clim', 'parking', 'lave-vaisselle'], checkInTime: '15:00', checkOutTime: '11:00', description: 'Villa lumineuse avec piscine privée et vue mer, à deux pas des plages de Nice.', rating: 4.9, reviewCount: 38, totalBookings: null, availableDays30: null },
  { id: 9002, name: 'Appartement Le Marais', type: 'APARTMENT', city: 'Paris', country: 'France', bedroomCount: 2, bathroomCount: 1, maxGuests: 4, priceFrom: 180, cleaningFee: 50, minimumNights: 2, currency: 'EUR', mainPhotoUrl: DEMO_IMG, photoUrls: DEMO_PHOTOS, amenities: ['wifi', 'clim', 'ascenseur'], checkInTime: '15:00', checkOutTime: '11:00', description: 'Appartement de charme au cœur du Marais, entièrement rénové, idéal pour découvrir Paris à pied.', rating: 4.9, reviewCount: 38, totalBookings: null, availableDays30: null },
  { id: 9003, name: 'Riad El Fenn', type: 'RIAD', city: 'Marrakech', country: 'France', bedroomCount: 5, bathroomCount: 4, maxGuests: 10, priceFrom: 220, cleaningFee: 50, minimumNights: 2, currency: 'EUR', mainPhotoUrl: DEMO_IMG, photoUrls: DEMO_PHOTOS, amenities: ['wifi', 'piscine', 'clim', 'petit-dejeuner'], checkInTime: '15:00', checkOutTime: '11:00', description: 'Riad authentique avec patio et piscine, au calme dans la médina de Marrakech.', rating: 4.9, reviewCount: 38, totalBookings: null, availableDays30: null },
  { id: 9004, name: 'Studio Vieux-Port', type: 'STUDIO', city: 'Marseille', country: 'France', bedroomCount: 1, bathroomCount: 1, maxGuests: 2, priceFrom: 120, cleaningFee: 50, minimumNights: 2, currency: 'EUR', mainPhotoUrl: DEMO_IMG, photoUrls: DEMO_PHOTOS, amenities: ['wifi', 'clim'], checkInTime: '15:00', checkOutTime: '11:00', description: 'Studio cosy face au Vieux-Port, parfait pour un séjour citadin à Marseille.', rating: 4.9, reviewCount: 38, totalBookings: null, availableDays30: null },
  { id: 9005, name: 'Loft Industriel', type: 'LOFT', city: 'Lyon', country: 'France', bedroomCount: 3, bathroomCount: 2, maxGuests: 6, priceFrom: 260, cleaningFee: 50, minimumNights: 2, currency: 'EUR', mainPhotoUrl: DEMO_IMG, photoUrls: DEMO_PHOTOS, amenities: ['wifi', 'parking', 'lave-vaisselle', 'ascenseur'], checkInTime: '15:00', checkOutTime: '11:00', description: 'Loft spacieux au style industriel, lumineux et central, au cœur de Lyon.', rating: 4.9, reviewCount: 38, totalBookings: null, availableDays30: null },
  { id: 9006, name: 'Gîte des Lavandes', type: 'COTTAGE', city: 'Aix-en-Provence', country: 'France', bedroomCount: 3, bathroomCount: 2, maxGuests: 6, priceFrom: 160, cleaningFee: 50, minimumNights: 2, currency: 'EUR', mainPhotoUrl: DEMO_IMG, photoUrls: DEMO_PHOTOS, amenities: ['wifi', 'parking', 'barbecue'], checkInTime: '15:00', checkOutTime: '11:00', description: 'Gîte provençal au calme, jardin et barbecue, entre vignes et lavandes près d\'Aix.', rating: 4.9, reviewCount: 38, totalBookings: null, availableDays30: null },
];

/**
 * URL photo chargeable dans un `<img>` SANS auth : l'URL admin `/api/properties/{pid}/photos/{phId}/data`
 * exige un Bearer (impossible en `<img>`) → on la réécrit vers l'endpoint PUBLIC keyless
 * `/api/public/property-photos/{pid}/{phId}` (même source que le booking engine publié). Les URLs externes
 * (OTA, déjà absolues) sont conservées telles quelles.
 */
function toPublicPhotoUrl(adminUrl: string | null | undefined): string | null {
  if (!adminUrl) return null;
  if (/^https?:\/\//i.test(adminUrl)) return adminUrl; // déjà absolue/externe (OTA)
  // L'API est servie par le backend (API_CONFIG.BASE_URL), pas par l'origine de l'app (proxy absent en dev).
  const root = API_CONFIG.BASE_URL.replace(/\/$/, '');
  const m = adminUrl.match(/\/properties\/(\d+)\/photos\/(\d+)/);
  return m ? `${root}/api/public/property-photos/${m[1]}/${m[2]}` : null;
}

/** Mappe une propriété réelle du tenant (API admin) vers la forme widget, pour l'aperçu éditeur en mode REAL. */
function mapPropertyToWidget(p: Property, currency: string): WidgetProperty {
  return {
    id: p.id,
    name: p.name,
    type: p.type ?? null,
    city: p.city ?? null,
    country: p.country ?? null,
    bedroomCount: p.bedroomCount ?? null,
    bathroomCount: p.bathroomCount ?? null,
    maxGuests: p.maxGuests ?? null,
    priceFrom: p.nightlyPrice ?? null,
    cleaningFee: p.cleaningBasePrice ?? null,
    minimumNights: p.minimumNights ?? null,
    currency,
    // Photo via l'endpoint PUBLIC keyless (chargeable en <img> sans Bearer). Pas de photo → placeholder démo.
    mainPhotoUrl: toPublicPhotoUrl(p.coverPhotoUrl || p.photoUrls?.[0]) ?? DEMO_IMG,
    photoUrls: (p.photoUrls ?? []).map((u) => toPublicPhotoUrl(u)).filter((u): u is string => Boolean(u)),
    amenities: p.amenities ?? null,
    checkInTime: p.defaultCheckInTime ?? null,
    checkOutTime: p.defaultCheckOutTime ?? null,
    description: p.description ?? null,
    rating: null,
    reviewCount: 0,
    totalBookings: null,
    availableDays30: null,
  };
}

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
  /** Re-seede l'aperçu pour le mode courant (REAL → vraies propriétés du tenant, MOCK → démo). */
  reseed: (config: BookingEngineConfig | null) => void;
  destroy: () => void;
}

/** Crée le cœur d'aperçu éditeur (partagé) + son `MountContext`, seedé selon le mode (démo ou réel). */
export function createEditorPreview(config: BookingEngineConfig | null): EditorPreview {
  const lang = (['fr', 'en', 'ar'].includes(config?.defaultLanguage ?? '') ? config?.defaultLanguage : 'fr') as 'fr' | 'en' | 'ar';
  const core = new BaitlyBookingCore({
    apiKey: `editor-preview-${config?.apiKey ?? 'x'}`,
    baseUrl: API_CONFIG.BASE_URL,
    language: lang,
    defaults: { adults: 2, children: 0, displayCurrency: config?.defaultCurrency || 'EUR' },
    persist: false, // éditeur : aucune persistance sessionStorage
  });

  let destroyed = false;
  let lastMode: 'REAL' | 'MOCK' | null = null;

  // Seede la liste de logements dans le cœur partagé (+ types/dispo dérivés). start() n'est jamais appelé :
  // le seul appel réseau possible est la lecture des biens du tenant en mode REAL (cf. applyMode).
  const seedProps = (props: WidgetProperty[]): void => {
    if (destroyed) return;
    core.state.set({
      properties: props,
      selectedPropertyId: props[0]?.id,
      propertyTypes: deriveDemoTypes(props),
      availability: buildDemoAvailability(props),
    }, 'stateChange');
  };

  // Enrichit la NOTE (rating/reviewCount) des logements réels depuis les stats d'avis : l'API admin
  // /properties ne porte PAS la note (calculée seulement sur le chemin PUBLIC `getProperties`). Sans ça,
  // la ligne note (PropertySummary détail) et le badge `booking-rating` restent vides en aperçu REAL.
  // Best-effort, par logement (1 appel /reviews/stats chacun) ; on met à jour `properties` sans toucher
  // la sélection. NB : approximation aperçu (stats admin) ; le site publié reste la source publique.
  const enrichWithReviewStats = (props: WidgetProperty[]): void => {
    void Promise.all(props.map((p) =>
      reviewsApi.getStats(p.id).then(
        (s) => ({ id: p.id, rating: s.totalReviews > 0 ? s.averageRating : null, reviewCount: s.totalReviews }),
        () => null,
      ),
    )).then((rows) => {
      if (destroyed) return;
      const byId = new Map(
        rows.filter((r): r is { id: number; rating: number | null; reviewCount: number } => r != null)
          .map((r) => [r.id, r]),
      );
      if (byId.size === 0) return;
      const enriched = core.state.get().properties.map((p) => {
        const s = byId.get(p.id);
        return s ? { ...p, rating: s.rating, reviewCount: s.reviewCount } : p;
      });
      core.state.set({ properties: enriched }, 'stateChange');
    });
  };

  // Source de données de l'aperçu : MOCK → jeu de démo unifié ; REAL → vraies propriétés du tenant
  // (lecture admin one-shot). Idempotent via `lastMode` (évite un double-fetch entre l'init et l'effet
  // réactif du Studio). En cas d'échec REAL, on conserve la démo déjà affichée.
  const applyMode = (cfg: BookingEngineConfig | null): void => {
    const mode: 'REAL' | 'MOCK' = cfg?.dataSourceMode === 'REAL' ? 'REAL' : 'MOCK';
    if (mode === lastMode) return;
    lastMode = mode;
    if (mode === 'MOCK') { seedProps(DEMO_PROPERTIES); return; }
    const currency = cfg?.defaultCurrency || 'EUR';
    propertiesApi.getAll()
      .then((list) => {
        if (destroyed) return;
        const props = list.map((p) => mapPropertyToWidget(p, currency));
        seedProps(props); // paint immédiat (sans note)
        enrichWithReviewStats(props); // puis note réelle quand les stats d'avis reviennent
      })
      .catch(() => { /* lecture des biens impossible : on garde la démo */ });
  };

  // Seed démo immédiat (paint instantané), puis bascule éventuelle vers le réel si le mode est REAL.
  seedProps(DEMO_PROPERTIES);
  applyMode(config);

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
    reseed: (cfg) => applyMode(cfg),
    destroy: () => {
      destroyed = true;
      offDates();
      offProp();
      core.destroy();
    },
  };
}
