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
  brandingColor: string;
  logoUrl: string | null;
  published: boolean;
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

/** Bloc editorial libre (autour de moi, message d'accueil, bons plans…). */
export interface GuideSection {
  id: string;
  title: string;
  body: string;
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
  property: PublicGuideProperty | null;
  practical: PublicGuidePractical | null;
  stay: PublicGuideStay | null;
  checkIn: PublicGuideCheckIn | null;
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
