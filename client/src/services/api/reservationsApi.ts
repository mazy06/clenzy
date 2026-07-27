import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'checked_out';
export type ReservationSource =
  | 'airbnb' | 'booking' | 'vrbo' | 'expedia'
  // Longue traine : pas d'adapter dedie, ces canaux arrivent par flux iCal.
  | 'agoda' | 'hotels_com' | 'hometogo' | 'mabeet' | 'rentelly' | 'gathern'
  | 'direct' | 'other';

export interface Reservation {
  id: number;
  propertyId: number;
  propertyName: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  /** Photo de profil du voyageur (avatar de la brique planning). Absente →
   *  repli sur les initiales. */
  guestAvatarUrl?: string;
  guestCount: number;
  /** Ventilation adultes/enfants (0314). Absente = ventilation inconnue
   *  (la taxe de séjour retombe sur guestCount). */
  adultsCount?: number;
  childrenCount?: number;
  checkIn: string;      // ISO date string (YYYY-MM-DD)
  checkOut: string;     // ISO date string (YYYY-MM-DD)
  checkInTime?: string;  // Heure check-in (HH:mm)
  checkOutTime?: string; // Heure check-out (HH:mm)
  status: ReservationStatus;
  source: ReservationSource;
  sourceName?: string;
  /**
   * Le canal a-t-il déjà encaissé ce séjour ? Décidé et figé à l'écriture côté
   * serveur (`reservations.payment_collection`) — ne plus le redéduire de
   * `source`, c'est cette déduction dispersée qui avait laissé les séjours
   * Channex avec un solde dû sur de l'argent déjà perçu.
   *
   * Toujours renseigné par l'API (`ReservationMapper`), et garanti NOT NULL en
   * base depuis le changeset 0368. Optionnel dans le type uniquement pour les
   * réponses mises en cache avant son déploiement : absent = « le PMS
   * encaisse », comme côté serveur. Plus aucune déduction depuis `source`.
   */
  collectedByChannel?: boolean;
  confirmationCode?: string;
  totalPrice: number;
  notes?: string;
  // Payment link tracking
  paymentLinkSentAt?: string;  // ISO datetime string
  paymentLinkEmail?: string;   // Email used for the last payment link
  hiddenFromPlanning?: boolean;
  // Payment status (from Stripe)
  paymentStatus?: string;      // PAID, PENDING, PROCESSING, FAILED, etc.
  paidAt?: string;             // ISO datetime string
}

export interface ReservationFilters {
  propertyIds?: number[];
  status?: ReservationStatus;
  source?: ReservationSource;
  from?: string;
  to?: string;
}

/** Filtres du mode paginé serveur (écran liste). `search` porte sur le nom du
 *  guest, le code de confirmation et le nom du logement (côté SQL). */
export interface ReservationPageFilters extends ReservationFilters {
  page: number;
  size: number;
  search?: string;
}

/** Enveloppe Spring `Page` renvoyée par GET /reservations?page=N (mode opt-in). */
export interface ReservationPage {
  content: Reservation[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CreateReservationData {
  propertyId: number;
  guestName: string;
  guestId?: number;
  guestEmail?: string;
  guestPhone?: string;
  guestCount: number;
  adultsCount?: number;
  childrenCount?: number;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  status?: string;
  totalPrice?: number;
  cleaningFee?: number;
  touristTaxAmount?: number;
  confirmationCode?: string;
  createCleaning?: boolean;
  notes?: string;
}

export interface UpdateReservationData {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCount?: number;
  adultsCount?: number;
  childrenCount?: number;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  status?: string;
  totalPrice?: number;
  notes?: string;
  propertyId?: number;
  propertyName?: string;
}

// ─── Planning Intervention Types ────────────────────────────────────────────
// TODO: Remplacer par les données réelles issues de l'API interventions backend.
// Ces types sont spécifiques au planning Gantt et seront alimentés par les
// interventions backend + les auto-générations post-séjour.

export type PlanningInterventionType = 'cleaning' | 'maintenance';
export type PlanningInterventionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'pending' | 'assigned' | 'awaiting_payment' | 'awaiting_validation';

export interface PlanningIntervention {
  id: number;
  propertyId: number;
  propertyName: string;
  type: PlanningInterventionType;
  title: string;
  assigneeName: string;
  startDate: string;   // ISO date string (YYYY-MM-DD)
  endDate: string;     // ISO date string (YYYY-MM-DD)
  startTime?: string;  // Heure début (HH:mm)
  endTime?: string;    // Heure fin (HH:mm)
  status: PlanningInterventionStatus;
  linkedReservationId?: number;  // Si lié à un check-out
  estimatedDurationHours: number;
  notes?: string;
  // Extended fields for progress tracking and recap
  progressPercentage?: number;
  completedSteps?: string;       // Comma-separated: 'inspection,rooms,after_photos'
  validatedRooms?: string;       // Comma-separated room indices
  beforePhotosUrls?: string[] | string;
  afterPhotosUrls?: string[] | string;
  paymentStatus?: string;
  estimatedCost?: number;
  actualCost?: number;
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  confirmed: '#4A9B8E',   // teal (thème success)
  pending: '#D4A574',     // ambre chaud (thème warning)
  cancelled: '#d32f2f',   // red (conservé)
  checked_in: '#5FAB7E',  // vert sauge — voyageur sur place (in house), tonalité muted cohérente avec la palette
  checked_out: '#757575', // grey (conservé)
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: 'Confirmée',
  pending: 'En attente',
  cancelled: 'Annulée',
  checked_in: 'Check-in',
  checked_out: 'Check-out',
};

export const RESERVATION_SOURCE_LABELS: Record<ReservationSource, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  vrbo: 'Vrbo',
  expedia: 'Expedia',
  agoda: 'Agoda',
  hotels_com: 'Hotels.com',
  hometogo: 'HomeToGo',
  mabeet: 'Mabeet',
  rentelly: 'Rentelly',
  gathern: 'Gathern',
  direct: 'Direct',
  other: 'Autre',
};

/**
 * Canaux qui masquent l'adresse du voyageur derrière un relais.
 *
 * Propriété **distincte** de l'encaissement, même si les deux ensembles
 * coïncident aujourd'hui : un canal pourrait encaisser sans anonymiser, ou
 * l'inverse. Les confondre serait refaire l'erreur que ce chantier corrige.
 * Miroir de `ChannelSources.anonymizesGuestEmail` côté serveur.
 */
const ANONYMIZING_SOURCES = new Set([
  'airbnb',
  'booking',
  'vrbo',
  'expedia',
  'agoda',
  'hotels_com',
  'hometogo',
  'mabeet',
  'rentelly',
  'gathern',
  'other',
  'channex',
]);

/**
 * Le canal masque-t-il l'email du voyageur ?
 *
 * Décide du message affiché quand l'envoi automatique ne peut pas fonctionner :
 * « le canal ne l'expose pas » plutôt que « tu as oublié de le renseigner ».
 * Vrbo et Expedia anonymisent aussi — l'interface promettait à tort que la
 * messagerie automatique marcherait sur ces séjours.
 */
export function anonymizesGuestEmail(source: string | null | undefined): boolean {
  if (!source) return false;
  const key = source.toLowerCase();
  // Un flux iCal, quel que soit son nom, passe par un relais.
  return ANONYMIZING_SOURCES.has(key) || key.includes('ical');
}

/**
 * Le canal a-t-il déjà encaissé ce séjour ?
 *
 * Simple LECTURE du régime décidé et figé côté serveur. Le repli sur la
 * déduction depuis le nom du canal — le filet de la migration — a été retiré
 * avec le changeset 0368, qui rend la colonne NOT NULL : plus personne, des deux
 * côtés du réseau, ne redevine qui a encaissé à partir de qui a vendu.
 */
export function isCollectedByChannel(reservation: {
  collectedByChannel?: boolean | null;
  source?: string | null;
}): boolean {
  return reservation.collectedByChannel === true;
}

export const INTERVENTION_TYPE_COLORS: Record<PlanningInterventionType, string> = {
  cleaning: '#5083C9',    // bleu cobalt — distinct du bleu ciel maintenance
  maintenance: '#7EBAD0', // bleu ciel clair — distinct de pending (#D4A574)
};

export const INTERVENTION_TYPE_LABELS: Record<PlanningInterventionType, string> = {
  cleaning: 'Ménage',
  maintenance: 'Maintenance',
};

export const INTERVENTION_STATUS_COLORS: Record<PlanningInterventionStatus, string> = {
  scheduled: '#7BA3C2',           // bleu harmonieux (thème info) — statut planifié
  in_progress: '#6B8A9A',        // bleu-gris (thème primary) — en cours
  completed: '#4A9B8E',          // teal (thème success) — terminé
  cancelled: '#9e9e9e',          // grey — annulé
  pending: '#D4A574',            // ambre chaud — en attente
  assigned: '#7BA3C2',           // bleu — assigné
  awaiting_payment: '#F59E0B',   // orange — en attente de paiement
  awaiting_validation: '#8B5CF6', // violet — en attente de validation
};

export const INTERVENTION_STATUS_LABELS: Record<PlanningInterventionStatus, string> = {
  scheduled: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
  pending: 'En attente',
  assigned: 'Assignée',
  awaiting_payment: 'Attente paiement',
  awaiting_validation: 'Attente validation',
};

/** Convertit les filtres communs au format query params attendu par Spring. */
function toListParams(
  filters?: ReservationFilters,
): Record<string, string | number | boolean | null | undefined> {
  const params: Record<string, string | number | boolean | null | undefined> = {};
  if (filters?.propertyIds && filters.propertyIds.length > 0) {
    params.propertyIds = filters.propertyIds.join(',');
  }
  if (filters?.status) params.status = filters.status;
  if (filters?.source) params.source = filters.source;
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  return params;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const reservationsApi = {
  async getAll(filters?: ReservationFilters): Promise<Reservation[]> {
    return apiClient.get<Reservation[]>('/reservations', { params: toListParams(filters) });
  },

  /**
   * Mode paginé serveur (opt-in via ?page=N) — utilisé par l'écran liste.
   * Les filtres status/source et la recherche (guest, code de confirmation,
   * logement) sont appliqués en SQL ; les autres consommateurs (planning,
   * dashboards, analytics) restent sur `getAll`.
   */
  async getPage(filters: ReservationPageFilters): Promise<ReservationPage> {
    const params = toListParams(filters);
    params.page = filters.page;
    params.size = filters.size;
    if (filters.search?.trim()) params.search = filters.search.trim();
    return apiClient.get<ReservationPage>('/reservations', { params });
  },

  async getByProperty(propertyId: number): Promise<Reservation[]> {
    return apiClient.get<Reservation[]>(`/reservations/property/${propertyId}`);
  },

  /**
   * Récupère les interventions de planning (ménage + maintenance)
   * pour les propriétés spécifiées.
   * TODO: Remplacer par l'API interventions backend réelle.
   */
  async getPlanningInterventions(filters?: {
    propertyIds?: number[];
    type?: PlanningInterventionType;
    from?: string;
    to?: string;
  }): Promise<PlanningIntervention[]> {
    try {
      const params: Record<string, string | number | boolean | null | undefined> = {};
      if (filters?.propertyIds && filters.propertyIds.length > 0) {
        params.propertyIds = filters.propertyIds.join(',');
      }
      if (filters?.from) params.from = filters.from;
      if (filters?.to) params.to = filters.to;
      if (filters?.type) params.type = filters.type;

      return await apiClient.get<PlanningIntervention[]>('/interventions/planning', { params });
    } catch (error) {
      console.error('[Planning] Failed to fetch interventions:', error);
      return [];
    }
  },

  async getById(id: number): Promise<Reservation> {
    return apiClient.get<Reservation>(`/reservations/${id}`);
  },

  /** Recherche réservations par nom de guest ou de logement (autocomplete rattachement « à trier »). */
  async search(q: string): Promise<Reservation[]> {
    return apiClient.get<Reservation[]>('/reservations/search', { params: { q } });
  },

  async create(data: CreateReservationData): Promise<Reservation> {
    return apiClient.post<Reservation>('/reservations', data);
  },

  async update(id: number, data: UpdateReservationData): Promise<Reservation> {
    return apiClient.put<Reservation>(`/reservations/${id}`, data);
  },

  async cancel(id: number): Promise<void> {
    return apiClient.delete(`/reservations/${id}`);
  },

  async hideFromPlanning(id: number): Promise<Reservation> {
    return apiClient.patch<Reservation>(`/reservations/${id}/hide`);
  },

  /**
   * Envoie (ou renvoie) un lien de paiement Stripe par email au guest.
   * Si email est fourni, envoie à cette adresse ; sinon utilise l'email du guest.
   */
  async sendPaymentLink(id: number, email?: string): Promise<Reservation> {
    return apiClient.post<Reservation>(`/reservations/${id}/send-payment-link`, { email: email ?? null });
  },

  /**
   * Vérifie le statut du paiement directement auprès de Stripe.
   * Utile quand le webhook n'a pas été reçu (dev, timeout, etc.).
   * Confirme automatiquement le paiement si Stripe indique "paid".
   */
  async checkPaymentStatus(id: number): Promise<{ paymentStatus: string; paidAt?: string; message: string }> {
    return apiClient.post<{ paymentStatus: string; paidAt?: string; message: string }>(`/reservations/${id}/check-payment`);
  },
};
