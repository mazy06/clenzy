import apiClient from '../apiClient';
import type { ApiError } from '../apiClient';

// ─── Admin types ──────────────────────────────────────────────────────────────

/**
 * Reference legere d'une reservation rattachee a un livret.
 * Mappe `WelcomeGuidePublicDto.ReservationRef` cote serveur : `checkIn`/`checkOut`
 * sont des dates ISO (`YYYY-MM-DD`), `status` le statut de la reservation.
 */
export interface GuideReservationRef {
  id: number;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
}

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
  /** Thème visuel du livret côté guest (atelier | noir | jardin | azur | corail | brume | minuit). */
  theme: string;
  /** Photos de couverture (hero) : JSON array d'ids de PropertyPhoto (carrousel). */
  heroPhotoIds: string;
  /** Mot d'accueil personnel de l'hôte (affiché en serif italique sous le hero). */
  welcomeMessage: string | null;
  /** Signature de la note d'accueil (ex: « Camille & Antoine »). */
  hostNames: string | null;
  logoUrl: string | null;
  published: boolean;
  chatbotEnabled: boolean;
  guestbookEnabled: boolean;
  activitiesEnabled: boolean;
  upsellsEnabled: boolean;
  /** Sélection des services affichés (JSON array d'ids) ; null = tous. */
  upsellOfferIds: string | null;
  createdAt: string;
  /** Réservation rattachée au livret (null = orphelin → le voyageur voit « non disponible »). */
  reservation: GuideReservationRef | null;
}

/** Payload de creation / mise a jour d'un livret. */
export interface WelcomeGuideRequest {
  propertyId: number;
  title: string;
  language?: string;
  sections?: string;
  brandingColor?: string | null;
  theme?: string;
  /** JSON array d'ids de PropertyPhoto (carrousel hero). */
  heroPhotoIds?: string;
  welcomeMessage?: string | null;
  hostNames?: string | null;
  logoUrl?: string | null;
  published?: boolean;
  chatbotEnabled?: boolean;
  guestbookEnabled?: boolean;
  activitiesEnabled?: boolean;
  upsellsEnabled?: boolean;
  upsellOfferIds?: string | null;
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

/** Mise en page d'une section (sous-page guest). */
export type GuideSectionLayout = 'text' | 'steps' | 'rules' | 'list';

/** Élément structuré d'une section (équipement how-to, règle, ligne transport…). */
export interface GuideSectionItem {
  id: string;
  /** Nom d'icône lucide (cf. guideIcons). */
  icon: string;
  label: string;
  /** Détail (layout 'list' — ex: « Lignes 6 & 9 · 3 min »). */
  detail: string;
  /** Étapes how-to (layout 'steps' — accordéon). */
  steps: string[];
}

/**
 * Section du livret = une entrée de navigation « Explorer le livret » → sous-page.
 * Le `layout` détermine le rendu : texte, accordéons (steps), liste d'icônes (rules),
 * ou liste icône+détail (list). Stocké en JSONB pass-through (pas de validation backend).
 */
export interface GuideSection {
  id: string;
  /** Nom d'icône lucide du badge de navigation. */
  icon: string;
  title: string;
  /** Sous-titre affiché dans la liste de navigation. */
  subtitle: string;
  layout: GuideSectionLayout;
  /** Contenu texte (layout 'text'). */
  body: string;
  /** Éléments structurés (layouts 'steps' | 'rules' | 'list'). */
  items: GuideSectionItem[];
}

/** Point d'interet "autour de moi" (restaurant, transport, attraction…). */
export interface GuidePoi {
  id: string;
  /** Identifiant de catégorie (cf. catalogue POI front). */
  category: string;
  name: string;
  /** Sous-titre / type (ex: « Bistrot français »). */
  type: string;
  address: string;
  lat: number | null;
  lng: number | null;
  note: string;
  /** Mis en avant (badge « Coup de cœur »). */
  featured: boolean;
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
  /** JSON [{key, caption}] — photos d'indication d'accès (servies via le token). */
  arrivalPhotos: string | null;
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

/** Données auto-remplies d'un logement pour l'aperçu live de la config (sans token). */
export interface GuidePreviewData {
  property: PublicGuideProperty | null;
  practical: PublicGuidePractical | null;
  stay: PublicGuideStay | null;
  /** Réservation active ou à venir du logement = celle à laquelle le livret serait rattaché à la création. */
  currentReservation: GuideReservationRef | null;
}

export interface PublicGuide {
  title: string;
  language: string;
  brandingColor: string | null;
  /** Thème visuel du livret (atelier | noir | jardin | azur | corail | brume | minuit). */
  theme: string;
  /** URLs des photos de couverture (carrousel) : absolues si externes, sinon passthrough token-scopé. */
  heroImageUrls: string[];
  /** Mot d'accueil personnel de l'hôte. */
  welcomeMessage: string | null;
  /** Signature de la note d'accueil. */
  hostNames: string | null;
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
  upsellsEnabled: boolean;
  /** false = livret non disponible (réservation absente ou révolue) → écran guest dédié. */
  available: boolean;
  /** Raison d'indisponibilité quand `available=false` : 'NO_RESERVATION' | 'EXPIRED'. */
  unavailableReason: string | null;
}

// ─── API admin ────────────────────────────────────────────────────────────────

/** Corps de la réponse 409 lors d'une création de livret en doublon (un livret existe déjà pour la réservation). */
export interface GuideAlreadyExistsBody {
  error: 'GUIDE_ALREADY_EXISTS';
  existingGuideId: number;
  reservationId: number;
  message: string;
}

/**
 * Erreur typée « un livret existe déjà pour cette réservation » (HTTP 409).
 * Permet au formulaire de distinguer ce cas (→ confirmation d'écrasement) d'une
 * erreur générique. {@link isGuideConflict} la reconnaît.
 */
export class GuideAlreadyExistsError extends Error {
  readonly existingGuideId: number;
  readonly reservationId: number;
  constructor(body: GuideAlreadyExistsBody) {
    super(body.message);
    this.name = 'GuideAlreadyExistsError';
    this.existingGuideId = body.existingGuideId;
    this.reservationId = body.reservationId;
  }
}

/** Vrai si l'erreur est le conflit 409 « livret déjà existant » (à traiter par confirmation d'écrasement). */
export function isGuideConflict(err: unknown): err is GuideAlreadyExistsError {
  return err instanceof GuideAlreadyExistsError;
}

/** Extrait le corps 409 typé d'une {@link ApiError} (apiClient stocke le JSON parsé dans `details`). */
function asGuideConflict(err: unknown): GuideAlreadyExistsBody | null {
  const apiErr = err as ApiError | undefined;
  if (!apiErr || apiErr.status !== 409) return null;
  const body = apiErr.details as Partial<GuideAlreadyExistsBody> | undefined;
  return body && body.error === 'GUIDE_ALREADY_EXISTS' && typeof body.existingGuideId === 'number'
    ? (body as GuideAlreadyExistsBody)
    : null;
}

export const welcomeGuideApi = {
  list: () => apiClient.get<WelcomeGuide[]>('/welcome-guides'),
  getById: (id: number) => apiClient.get<WelcomeGuide>(`/welcome-guides/${id}`),
  /**
   * Crée un livret (staff uniquement). Si un livret existe déjà pour la réservation résolue,
   * le backend répond 409 → on relance une {@link GuideAlreadyExistsError} typée (le formulaire
   * propose alors d'écraser via `overwrite: true`). Toute autre erreur est repropagée telle quelle.
   */
  create: async (data: WelcomeGuideRequest, overwrite = false): Promise<WelcomeGuide> => {
    try {
      return await apiClient.post<WelcomeGuide>('/welcome-guides', data, { params: { overwrite } });
    } catch (err) {
      const conflict = asGuideConflict(err);
      if (conflict) throw new GuideAlreadyExistsError(conflict);
      throw err;
    }
  },
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

  /** Données auto-remplies d'un logement (adresse, wifi, digicode, horaires) pour l'aperçu live. */
  propertyPreview: (propertyId: number) =>
    apiClient.get<GuidePreviewData>(`/welcome-guides/property-preview/${propertyId}`),
};

// ─── Helpers serialisation des sections editoriales ───────────────────────────

const SECTION_LAYOUTS: readonly GuideSectionLayout[] = ['text', 'steps', 'rules', 'list'];

function parseSectionItems(raw: unknown): GuideSectionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
    .map((it, i) => ({
      id: typeof it.id === 'string' ? it.id : `it-${i}`,
      icon: typeof it.icon === 'string' ? it.icon : '',
      label: typeof it.label === 'string' ? it.label : '',
      detail: typeof it.detail === 'string' ? it.detail : '',
      steps: Array.isArray(it.steps) ? it.steps.filter((x): x is string => typeof x === 'string') : [],
    }));
}

export function parseSections(json: string | null | undefined): GuideSection[] {
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s, i) => ({
        id: typeof s.id === 'string' ? s.id : `s-${i}`,
        icon: typeof s.icon === 'string' ? s.icon : '',
        title: typeof s.title === 'string' ? s.title : '',
        subtitle: typeof s.subtitle === 'string' ? s.subtitle : '',
        layout: SECTION_LAYOUTS.includes(s.layout as GuideSectionLayout) ? (s.layout as GuideSectionLayout) : 'text',
        body: typeof s.body === 'string' ? s.body : '',
        items: parseSectionItems(s.items),
      }));
  } catch {
    return [];
  }
}

export function serializeSections(sections: GuideSection[]): string {
  return JSON.stringify(
    sections.map(({ id, icon, title, subtitle, layout, body, items }) => ({
      id,
      icon,
      title,
      subtitle,
      layout,
      body,
      items: items.map(({ id: itemId, icon: itemIcon, label, detail, steps }) => ({
        id: itemId,
        icon: itemIcon,
        label,
        detail,
        steps,
      })),
    })),
  );
}

/** Parse le JSON array d'ids de photos de couverture ('[1,2,3]') en number[]. */
export function parseHeroPhotoIds(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const arr: unknown = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
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
        type: typeof p.type === 'string' ? p.type : '',
        address: typeof p.address === 'string' ? p.address : '',
        lat: typeof p.lat === 'number' ? p.lat : null,
        lng: typeof p.lng === 'number' ? p.lng : null,
        note: typeof p.note === 'string' ? p.note : '',
        featured: p.featured === true,
      }));
  } catch {
    return [];
  }
}

export function serializePois(pois: GuidePoi[]): string {
  return JSON.stringify(
    pois.map(({ id, category, name, type, address, lat, lng, note, featured }) => ({
      id,
      category,
      name,
      type,
      address,
      lat,
      lng,
      note,
      featured,
    })),
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
