import apiClient from '../apiClient';

// ─── Admin types ──────────────────────────────────────────────────────────────

/** Livret tel que renvoye par l'API admin (`/welcome-guides`). */
export interface WelcomeGuide {
  id: number;
  propertyId: number | null;
  propertyName: string | null;
  language: string;
  title: string;
  /** JSON string : tableau de {@link GuideSection}. */
  sections: string;
  /** JSON string : tableau de {@link GuidePoi} ("autour de moi"). */
  pois: string;
  /** JSON string : tableau de {@link GuideActivity} (activités curées par l'hôte). */
  curatedActivities: string;
  brandingColor: string;
  logoUrl: string | null;
  published: boolean;
  chatbotEnabled: boolean;
  guestbookEnabled: boolean;
  activitiesEnabled: boolean;
  createdAt: string;
}

/** Payload de creation / mise a jour d'un livret. */
export interface WelcomeGuideRequest {
  propertyId: number;
  title: string;
  language?: string;
  sections?: string;
  brandingColor?: string | null;
  logoUrl?: string | null;
  published?: boolean;
  chatbotEnabled?: boolean;
  guestbookEnabled?: boolean;
  activitiesEnabled?: boolean;
  pois?: string;
  curatedActivities?: string;
}

/** Resultat de generation d'un lien d'acces (token + URL publique). */
export interface WelcomeGuideTokenResult {
  token: string;
  link: string;
}

/** Lien de partage + QR code (data URL base64) en un appel. */
export interface WelcomeGuideShareResult {
  token: string;
  link: string;
  qrCode: string;
}

/** Entree de livre d'or (cote hote). */
export interface GuestbookEntry {
  id: number;
  authorName: string | null;
  message: string | null;
  rating: number | null;
  createdAt: string;
}

/** Payload de creation d'une entree de livre d'or (cote guest). */
export interface GuestbookEntryRequest {
  authorName: string;
  message: string;
  rating?: number | null;
}

/** Bloc editorial libre (message d'accueil, bons plans…). */
export interface GuideSection {
  id: string;
  title: string;
  body: string;
}

/** Point d'interet "autour de moi" (restaurant, transport, attraction…). */
export interface GuidePoi {
  id: string;
  /** Identifiant de catégorie (cf. catalogue POI front). */
  category: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  note: string;
}

/** Suggestion de POI auto-populée (OpenStreetMap) autour du logement. */
export interface PoiSuggestion {
  category: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
}

/** Activité curée par l'hôte sur son livret (manuelle aujourd'hui ; pool fournisseur à terme). */
export interface GuideActivity {
  id: string;
  /** 'MANUAL' aujourd'hui ; 'VIATOR' | 'GETYOURGUIDE' | 'KLOOK' quand importée du pool fournisseur. */
  source: string;
  externalId: string | null;
  title: string;
  imageUrl: string | null;
  price: string | null;
  bookingUrl: string;
  description: string;
  /** Mise en avant (affichée en premier, badge). */
  featured: boolean;
}

// ─── Analytics (cote hote) ────────────────────────────────────────────────────

/** Evenements guest captures cote client (chat/livre d'or sont captures cote serveur). */
export type GuideEventType = 'GUIDE_OPENED' | 'ACTIVITY_CLICK' | 'CHECKIN_CLICK';

export interface GuideStatsDaily {
  date: string;
  count: number;
}

export interface GuideStatsLabeled {
  label: string;
  count: number;
}

/** Statistiques agregees d'un livret (compteurs + tendance + top activites). */
export interface WelcomeGuideStats {
  totalOpens: number;
  chatMessages: number;
  guestbookEntries: number;
  activityClicks: number;
  checkinClicks: number;
  dailyOpens: GuideStatsDaily[];
  topActivities: GuideStatsLabeled[];
}

// ─── Public payload (page guest /guide/:token) ────────────────────────────────

export interface PublicGuideProperty {
  name: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PublicGuidePractical {
  wifiName: string | null;
  wifiPassword: string | null;
  accessCode: string | null;
  parkingInfo: string | null;
  arrivalInstructions: string | null;
  departureInstructions: string | null;
  houseRules: string | null;
  emergencyContact: string | null;
  additionalNotes: string | null;
}

export interface PublicGuideStay {
  checkIn: string | null;
  checkOut: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  guestName: string | null;
  guestCount: number | null;
}

export interface PublicGuideCheckIn {
  link: string;
  status: string;
}

export interface PublicGuide {
  title: string;
  language: string;
  brandingColor: string | null;
  logoUrl: string | null;
  sections: string;
  pois: string;
  curatedActivities: string;
  property: PublicGuideProperty | null;
  practical: PublicGuidePractical | null;
  stay: PublicGuideStay | null;
  checkIn: PublicGuideCheckIn | null;
  chatbotEnabled: boolean;
  guestbookEnabled: boolean;
  activitiesEnabled: boolean;
}

// ─── API admin ────────────────────────────────────────────────────────────────

export const welcomeGuideApi = {
  list: () => apiClient.get<WelcomeGuide[]>('/welcome-guides'),
  getById: (id: number) => apiClient.get<WelcomeGuide>(`/welcome-guides/${id}`),
  create: (data: WelcomeGuideRequest) => apiClient.post<WelcomeGuide>('/welcome-guides', data),
  update: (id: number, data: WelcomeGuideRequest) =>
    apiClient.put<WelcomeGuide>(`/welcome-guides/${id}`, data),
  remove: (id: number) => apiClient.delete(`/welcome-guides/${id}`),
  /** Genere un lien de previsualisation/partage manuel (token sans reservation). */
  generateToken: (id: number) =>
    apiClient.post<WelcomeGuideTokenResult>(`/welcome-guides/${id}/token`),

  /** Lien de partage + QR code en un appel (apercu/partage manuel). */
  share: (id: number) =>
    apiClient.post<WelcomeGuideShareResult>(`/welcome-guides/${id}/share`),

  /** Liste des entrees de livre d'or d'un livret (cote hote). */
  listGuestbook: (id: number) =>
    apiClient.get<GuestbookEntry[]>(`/welcome-guides/${id}/guestbook`),

  /** Statistiques d'usage d'un livret (cote hote). */
  getStats: (id: number) =>
    apiClient.get<WelcomeGuideStats>(`/welcome-guides/${id}/stats`),

  /** Suggestions de POI « autour de moi » auto-populées (OSM) autour du logement. */
  suggestPois: (id: number) =>
    apiClient.get<PoiSuggestion[]>(`/welcome-guides/${id}/poi-suggestions`),
};

// ─── Helpers serialisation des sections editoriales ───────────────────────────

export function parseSections(json: string | null | undefined): GuideSection[] {
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s, i) => ({
        id: typeof s.id === 'string' ? s.id : `s-${i}`,
        title: typeof s.title === 'string' ? s.title : '',
        body: typeof s.body === 'string' ? s.body : '',
      }));
  } catch {
    return [];
  }
}

export function serializeSections(sections: GuideSection[]): string {
  return JSON.stringify(sections.map(({ id, title, body }) => ({ id, title, body })));
}

export function parsePois(json: string | null | undefined): GuidePoi[] {
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map((p, i) => ({
        id: typeof p.id === 'string' ? p.id : `poi-${i}`,
        category: typeof p.category === 'string' ? p.category : 'OTHER',
        name: typeof p.name === 'string' ? p.name : '',
        address: typeof p.address === 'string' ? p.address : '',
        lat: typeof p.lat === 'number' ? p.lat : null,
        lng: typeof p.lng === 'number' ? p.lng : null,
        note: typeof p.note === 'string' ? p.note : '',
      }));
  } catch {
    return [];
  }
}

export function serializePois(pois: GuidePoi[]): string {
  return JSON.stringify(
    pois.map(({ id, category, name, address, lat, lng, note }) => ({ id, category, name, address, lat, lng, note })),
  );
}

export function parseActivities(json: string | null | undefined): GuideActivity[] {
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .map((a, i) => ({
        id: typeof a.id === 'string' ? a.id : `act-${i}`,
        source: typeof a.source === 'string' ? a.source : 'MANUAL',
        externalId: typeof a.externalId === 'string' ? a.externalId : null,
        title: typeof a.title === 'string' ? a.title : '',
        imageUrl: typeof a.imageUrl === 'string' ? a.imageUrl : null,
        price: typeof a.price === 'string' ? a.price : null,
        bookingUrl: typeof a.bookingUrl === 'string' ? a.bookingUrl : '',
        description: typeof a.description === 'string' ? a.description : '',
        featured: a.featured === true,
      }));
  } catch {
    return [];
  }
}

export function serializeActivities(items: GuideActivity[]): string {
  return JSON.stringify(
    items.map(({ id, source, externalId, title, imageUrl, price, bookingUrl, description, featured }) => ({
      id,
      source,
      externalId,
      title,
      imageUrl,
      price,
      bookingUrl,
      description,
      featured,
    })),
  );
}
