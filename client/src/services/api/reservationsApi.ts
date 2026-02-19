import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'checked_out';
export type ReservationSource = 'airbnb' | 'booking' | 'direct' | 'other';

export interface Reservation {
  id: number;
  propertyId: number;
  propertyName: string;
  guestName: string;
  guestCount: number;
  checkIn: string;      // ISO date string (YYYY-MM-DD)
  checkOut: string;     // ISO date string (YYYY-MM-DD)
  checkInTime?: string;  // Heure check-in (HH:mm)
  checkOutTime?: string; // Heure check-out (HH:mm)
  status: ReservationStatus;
  source: ReservationSource;
  totalPrice: number;
  notes?: string;
}

export interface ReservationFilters {
  propertyIds?: number[];
  status?: ReservationStatus;
  from?: string;
  to?: string;
}

// ─── Planning Intervention Types ────────────────────────────────────────────
// TODO: Remplacer par les données réelles issues de l'API interventions backend.
// Ces types sont spécifiques au planning Gantt et seront alimentés par les
// interventions backend + les auto-générations post-séjour.

export type PlanningInterventionType = 'cleaning' | 'maintenance';
export type PlanningInterventionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

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
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  confirmed: '#4A9B8E',   // teal (thème success)
  pending: '#D4A574',     // ambre chaud (thème warning)
  cancelled: '#d32f2f',   // red (conservé)
  checked_in: '#6B8A9A',  // bleu-gris (thème primary)
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
  direct: 'Direct',
  other: 'Autre',
};

export const INTERVENTION_TYPE_COLORS: Record<PlanningInterventionType, string> = {
  cleaning: '#9B7FC4',    // violet doux — distinct du bleu-gris checked_in
  maintenance: '#7EBAD0', // bleu ciel clair — distinct de pending (#D4A574)
};

export const INTERVENTION_TYPE_LABELS: Record<PlanningInterventionType, string> = {
  cleaning: 'Ménage',
  maintenance: 'Maintenance',
};

export const INTERVENTION_STATUS_COLORS: Record<PlanningInterventionStatus, string> = {
  scheduled: '#7BA3C2',   // bleu harmonieux (thème info) — statut planifié
  in_progress: '#6B8A9A', // bleu-gris (thème primary) — en cours
  completed: '#4A9B8E',   // teal (thème success) — terminé
  cancelled: '#9e9e9e',   // grey — annulé
};

export const INTERVENTION_STATUS_LABELS: Record<PlanningInterventionStatus, string> = {
  scheduled: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

// ─── Mock Data ───────────────────────────────────────────────────────────────
// Le mode mock est contrôlé dynamiquement via localStorage.
// L'admin peut l'activer/désactiver depuis Paramètres → Développement.

const MOCK_STORAGE_KEY = 'clenzy_planning_mock';
const ANALYTICS_MOCK_KEY = 'clenzy_analytics_mock';

function isoDate(year: number, month: number, day: number): string {
  return new Date(year, month, day).toISOString().split('T')[0];
}

function generateMockReservations(): Reservation[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  // Heures typiques : check-in entre 14h-16h, check-out entre 10h-11h
  const checkInTimes = ['14:00', '15:00', '16:00', '14:30', '15:30'];
  const checkOutTimes = ['10:00', '11:00', '10:30', '11:00', '10:00'];

  const res: Reservation[] = [
    // ─── Property 1 : Studio Montmartre ─────────────────────────────
    { id: 1, propertyId: 1, propertyName: 'Studio Montmartre', guestName: 'Jean Dupont', guestCount: 2, checkIn: isoDate(y, m, d - 8), checkOut: isoDate(y, m, d - 4), status: 'checked_out', source: 'airbnb', totalPrice: 360 },
    { id: 2, propertyId: 1, propertyName: 'Studio Montmartre', guestName: 'Marie Leroy', guestCount: 1, checkIn: isoDate(y, m, d - 3), checkOut: isoDate(y, m, d + 2), status: 'checked_in', source: 'booking', totalPrice: 450 },
    { id: 3, propertyId: 1, propertyName: 'Studio Montmartre', guestName: 'Hans Muller', guestCount: 2, checkIn: isoDate(y, m, d + 4), checkOut: isoDate(y, m, d + 8), status: 'confirmed', source: 'airbnb', totalPrice: 380 },
    { id: 4, propertyId: 1, propertyName: 'Studio Montmartre', guestName: 'Emily Brown', guestCount: 2, checkIn: isoDate(y, m, d + 10), checkOut: isoDate(y, m, d + 15), status: 'confirmed', source: 'booking', totalPrice: 520 },
    { id: 5, propertyId: 1, propertyName: 'Studio Montmartre', guestName: 'Kenji Sato', guestCount: 1, checkIn: isoDate(y, m, d + 18), checkOut: isoDate(y, m, d + 22), status: 'pending', source: 'airbnb', totalPrice: 340 },

    // ─── Property 2 : Appart. Marais ────────────────────────────────
    { id: 6, propertyId: 2, propertyName: 'Appart. Marais', guestName: 'Sophie Martin', guestCount: 3, checkIn: isoDate(y, m, d - 6), checkOut: isoDate(y, m, d - 1), status: 'checked_out', source: 'direct', totalPrice: 780 },
    { id: 7, propertyId: 2, propertyName: 'Appart. Marais', guestName: 'Carlos Garcia', guestCount: 2, checkIn: isoDate(y, m, d + 1), checkOut: isoDate(y, m, d + 5), status: 'confirmed', source: 'airbnb', totalPrice: 640 },
    { id: 8, propertyId: 2, propertyName: 'Appart. Marais', guestName: 'Anna Smith', guestCount: 4, checkIn: isoDate(y, m, d + 7), checkOut: isoDate(y, m, d + 13), status: 'confirmed', source: 'booking', totalPrice: 1120 },
    { id: 9, propertyId: 2, propertyName: 'Appart. Marais', guestName: 'Paolo Verdi', guestCount: 2, checkIn: isoDate(y, m, d + 16), checkOut: isoDate(y, m, d + 20), status: 'pending', source: 'airbnb', totalPrice: 680 },

    // ─── Property 3 : Loft Bastille ─────────────────────────────────
    { id: 10, propertyId: 3, propertyName: 'Loft Bastille', guestName: 'Pierre Morel', guestCount: 2, checkIn: isoDate(y, m, d - 10), checkOut: isoDate(y, m, d - 6), status: 'checked_out', source: 'airbnb', totalPrice: 560 },
    { id: 11, propertyId: 3, propertyName: 'Loft Bastille', guestName: 'Yuki Tanaka', guestCount: 2, checkIn: isoDate(y, m, d - 4), checkOut: isoDate(y, m, d + 1), status: 'checked_in', source: 'booking', totalPrice: 700 },
    { id: 12, propertyId: 3, propertyName: 'Loft Bastille', guestName: 'Luca Rossi', guestCount: 3, checkIn: isoDate(y, m, d + 3), checkOut: isoDate(y, m, d + 8), status: 'confirmed', source: 'direct', totalPrice: 850 },
    { id: 13, propertyId: 3, propertyName: 'Loft Bastille', guestName: 'Chen Wei', guestCount: 2, checkIn: isoDate(y, m, d + 11), checkOut: isoDate(y, m, d + 16), status: 'confirmed', source: 'airbnb', totalPrice: 750 },
    { id: 14, propertyId: 3, propertyName: 'Loft Bastille', guestName: 'David Kim', guestCount: 4, checkIn: isoDate(y, m, d + 19), checkOut: isoDate(y, m, d + 25), status: 'pending', source: 'booking', totalPrice: 1050 },

    // ─── Property 4 : Maison Vincennes ──────────────────────────────
    { id: 15, propertyId: 4, propertyName: 'Maison Vincennes', guestName: 'Emma Johnson', guestCount: 5, checkIn: isoDate(y, m, d - 5), checkOut: isoDate(y, m, d - 1), status: 'checked_out', source: 'airbnb', totalPrice: 1400 },
    { id: 16, propertyId: 4, propertyName: 'Maison Vincennes', guestName: 'Ahmed Hassan', guestCount: 4, checkIn: isoDate(y, m, d + 1), checkOut: isoDate(y, m, d + 8), status: 'confirmed', source: 'airbnb', totalPrice: 1260 },
    { id: 17, propertyId: 4, propertyName: 'Maison Vincennes', guestName: 'Julia Wagner', guestCount: 6, checkIn: isoDate(y, m, d + 12), checkOut: isoDate(y, m, d + 19), status: 'confirmed', source: 'direct', totalPrice: 1680 },
    { id: 18, propertyId: 4, propertyName: 'Maison Vincennes', guestName: 'Tom Wilson', guestCount: 3, checkIn: isoDate(y, m, d + 22), checkOut: isoDate(y, m, d + 28), status: 'pending', source: 'booking', totalPrice: 1100 },

    // ─── Property 5 : Studio Saint-Germain ──────────────────────────
    { id: 19, propertyId: 5, propertyName: 'Studio Saint-Germain', guestName: 'Lisa Chen', guestCount: 1, checkIn: isoDate(y, m, d - 7), checkOut: isoDate(y, m, d - 3), status: 'checked_out', source: 'booking', totalPrice: 490 },
    { id: 20, propertyId: 5, propertyName: 'Studio Saint-Germain', guestName: 'Roberto Silva', guestCount: 2, checkIn: isoDate(y, m, d - 1), checkOut: isoDate(y, m, d + 3), status: 'checked_in', source: 'airbnb', totalPrice: 520 },
    { id: 21, propertyId: 5, propertyName: 'Studio Saint-Germain', guestName: 'Mia Andersson', guestCount: 1, checkIn: isoDate(y, m, d + 5), checkOut: isoDate(y, m, d + 9), status: 'confirmed', source: 'direct', totalPrice: 440 },
    { id: 22, propertyId: 5, propertyName: 'Studio Saint-Germain', guestName: 'Fatima Al-Rashid', guestCount: 2, checkIn: isoDate(y, m, d + 12), checkOut: isoDate(y, m, d + 16), status: 'confirmed', source: 'airbnb', totalPrice: 560 },

    // ─── Property 6 : Appart. Opera ─────────────────────────────────
    { id: 23, propertyId: 6, propertyName: 'Appart. Opera', guestName: 'Sarah Williams', guestCount: 2, checkIn: isoDate(y, m, d - 4), checkOut: isoDate(y, m, d), status: 'checked_out', source: 'direct', totalPrice: 680 },
    { id: 24, propertyId: 6, propertyName: 'Appart. Opera', guestName: 'Klaus Fischer', guestCount: 3, checkIn: isoDate(y, m, d + 2), checkOut: isoDate(y, m, d + 7), status: 'confirmed', source: 'airbnb', totalPrice: 900 },
    { id: 25, propertyId: 6, propertyName: 'Appart. Opera', guestName: 'Maria Gonzalez', guestCount: 2, checkIn: isoDate(y, m, d + 10), checkOut: isoDate(y, m, d + 14), status: 'confirmed', source: 'booking', totalPrice: 750 },
    { id: 26, propertyId: 6, propertyName: 'Appart. Opera', guestName: 'Raj Patel', guestCount: 2, checkIn: isoDate(y, m, d + 17), checkOut: isoDate(y, m, d + 22), status: 'pending', source: 'airbnb', totalPrice: 880 },
    { id: 27, propertyId: 6, propertyName: 'Appart. Opera', guestName: 'Nina Johansson', guestCount: 1, checkIn: isoDate(y, m, d + 25), checkOut: isoDate(y, m, d + 29), status: 'cancelled', source: 'booking', totalPrice: 620 },

    // ─── Property 7 : Villa Neuilly ─────────────────────────────────
    { id: 28, propertyId: 7, propertyName: 'Villa Neuilly', guestName: 'James Taylor', guestCount: 6, checkIn: isoDate(y, m, d - 9), checkOut: isoDate(y, m, d - 3), status: 'checked_out', source: 'airbnb', totalPrice: 2100 },
    { id: 29, propertyId: 7, propertyName: 'Villa Neuilly', guestName: 'Olga Petrov', guestCount: 4, checkIn: isoDate(y, m, d - 1), checkOut: isoDate(y, m, d + 5), status: 'checked_in', source: 'booking', totalPrice: 1800 },
    { id: 30, propertyId: 7, propertyName: 'Villa Neuilly', guestName: 'Marco Bianchi', guestCount: 5, checkIn: isoDate(y, m, d + 8), checkOut: isoDate(y, m, d + 15), status: 'confirmed', source: 'airbnb', totalPrice: 2400 },
    { id: 31, propertyId: 7, propertyName: 'Villa Neuilly', guestName: 'Sophie Dubois', guestCount: 8, checkIn: isoDate(y, m, d + 18), checkOut: isoDate(y, m, d + 26), status: 'confirmed', source: 'direct', totalPrice: 3200 },

    // ─── Property 8 : Duplex Châtelet ───────────────────────────────
    { id: 32, propertyId: 8, propertyName: 'Duplex Châtelet', guestName: 'Oliver Davis', guestCount: 3, checkIn: isoDate(y, m, d - 3), checkOut: isoDate(y, m, d + 2), status: 'checked_in', source: 'airbnb', totalPrice: 950 },
    { id: 33, propertyId: 8, propertyName: 'Duplex Châtelet', guestName: 'Léa Bernard', guestCount: 2, checkIn: isoDate(y, m, d + 4), checkOut: isoDate(y, m, d + 9), status: 'confirmed', source: 'booking', totalPrice: 870 },
    { id: 34, propertyId: 8, propertyName: 'Duplex Châtelet', guestName: 'Michael Brown', guestCount: 4, checkIn: isoDate(y, m, d + 13), checkOut: isoDate(y, m, d + 18), status: 'confirmed', source: 'direct', totalPrice: 1150 },

    // ─── Property 9 : T2 Nation ─────────────────────────────────────
    { id: 35, propertyId: 9, propertyName: 'T2 Nation', guestName: 'Isabelle Roux', guestCount: 2, checkIn: isoDate(y, m, d - 6), checkOut: isoDate(y, m, d - 2), status: 'checked_out', source: 'airbnb', totalPrice: 420 },
    { id: 36, propertyId: 9, propertyName: 'T2 Nation', guestName: 'George Miller', guestCount: 1, checkIn: isoDate(y, m, d), checkOut: isoDate(y, m, d + 4), status: 'checked_in', source: 'booking', totalPrice: 380 },
    { id: 37, propertyId: 9, propertyName: 'T2 Nation', guestName: 'Ana Costa', guestCount: 2, checkIn: isoDate(y, m, d + 6), checkOut: isoDate(y, m, d + 11), status: 'confirmed', source: 'airbnb', totalPrice: 490 },
    { id: 38, propertyId: 9, propertyName: 'T2 Nation', guestName: 'Thomas Eriksen', guestCount: 3, checkIn: isoDate(y, m, d + 14), checkOut: isoDate(y, m, d + 19), status: 'pending', source: 'direct', totalPrice: 550 },

    // ─── Property 10 : Penthouse Trocadéro ──────────────────────────
    { id: 39, propertyId: 10, propertyName: 'Penthouse Trocadéro', guestName: 'Alexander Ivanov', guestCount: 4, checkIn: isoDate(y, m, d - 5), checkOut: isoDate(y, m, d + 1), status: 'checked_in', source: 'airbnb', totalPrice: 3500 },
    { id: 40, propertyId: 10, propertyName: 'Penthouse Trocadéro', guestName: 'Priya Sharma', guestCount: 2, checkIn: isoDate(y, m, d + 4), checkOut: isoDate(y, m, d + 10), status: 'confirmed', source: 'booking', totalPrice: 3100 },
    { id: 41, propertyId: 10, propertyName: 'Penthouse Trocadéro', guestName: 'Victoria Lane', guestCount: 6, checkIn: isoDate(y, m, d + 14), checkOut: isoDate(y, m, d + 21), status: 'confirmed', source: 'direct', totalPrice: 4200 },
  ];

  // Ajouter les heures de check-in/check-out à chaque réservation
  return res.map((r, i) => ({
    ...r,
    checkInTime: checkInTimes[i % checkInTimes.length],
    checkOutTime: checkOutTimes[i % checkOutTimes.length],
  }));
}

/**
 * Génère automatiquement les interventions de ménage après chaque check-out
 * + des interventions de maintenance manuelles dispersées.
 * TODO: Remplacer par les données réelles de l'API interventions backend.
 */
function generateMockPlanningInterventions(): PlanningIntervention[] {
  const reservations = generateMockReservations();
  const interventions: PlanningIntervention[] = [];
  let idCounter = 1000;

  // --- Ménage automatique après chaque séjour (check-out confirmé ou futur) ---
  // On exclut les réservations annulées
  const nonCancelledReservations = reservations.filter((r) => r.status !== 'cancelled');

  const cleaningStaff = [
    'Fatou Diallo', 'Carmen Lopez', 'Nathalie Blanc',
    'Amina Keita', 'Lucie Moreau',
  ];

  nonCancelledReservations.forEach((r, idx) => {
    const checkOutDate = r.checkOut;
    // Le ménage commence le jour du check-out (après départ) et dure 1 jour
    // Pour les grandes propriétés (guestCount >= 5), ça prend 2 jours
    const durationDays = r.guestCount >= 5 ? 2 : 1;
    const endDate = new Date(checkOutDate);
    endDate.setDate(endDate.getDate() + durationDays);
    const endDateStr = endDate.toISOString().split('T')[0];

    // Déterminer le statut selon la date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const coDate = new Date(checkOutDate);
    coDate.setHours(0, 0, 0, 0);

    let interventionStatus: PlanningInterventionStatus;
    if (coDate > today) {
      interventionStatus = 'scheduled';
    } else if (coDate.getTime() === today.getTime()) {
      interventionStatus = 'in_progress';
    } else {
      interventionStatus = 'completed';
    }

    // Heure de début : après le check-out du voyageur (11h ou 12h)
    // Durée : 3h pour petit logement, 6h pour grand
    const estHours = r.guestCount >= 5 ? 6 : 3;
    const cleanStartHour = r.guestCount >= 5 ? 11 : 12;
    const cleanEndHour = cleanStartHour + estHours;
    const cleanStartTime = `${cleanStartHour.toString().padStart(2, '0')}:00`;
    const cleanEndTime = `${Math.min(cleanEndHour, 23).toString().padStart(2, '0')}:00`;

    interventions.push({
      id: idCounter++,
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      type: 'cleaning',
      title: `Ménage après séjour ${r.guestName}`,
      assigneeName: cleaningStaff[idx % cleaningStaff.length],
      startDate: checkOutDate,
      endDate: endDateStr,
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      status: interventionStatus,
      linkedReservationId: r.id,
      estimatedDurationHours: estHours,
      notes: r.guestCount >= 5 ? 'Grand ménage complet — linge + deep clean' : undefined,
    });
  });

  // --- Interventions de maintenance manuelles ---
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  const maintenanceInterventions: PlanningIntervention[] = [
    {
      id: idCounter++,
      propertyId: 1,
      propertyName: 'Studio Montmartre',
      type: 'maintenance',
      title: 'Réparation fuite robinet cuisine',
      assigneeName: 'Marc Dupuis',
      startDate: isoDate(y, m, d - 4),
      endDate: isoDate(y, m, d - 3),
      startTime: '09:00',
      endTime: '11:00',
      status: 'completed',
      estimatedDurationHours: 2,
      notes: 'Joint à remplacer',
    },
    {
      id: idCounter++,
      propertyId: 3,
      propertyName: 'Loft Bastille',
      type: 'maintenance',
      title: 'Entretien chaudière annuel',
      assigneeName: 'Sté Chauffage Pro',
      startDate: isoDate(y, m, d + 2),
      endDate: isoDate(y, m, d + 2),
      startTime: '08:00',
      endTime: '12:00',
      status: 'scheduled',
      estimatedDurationHours: 4,
      notes: 'Contrat annuel — vérification complète',
    },
    {
      id: idCounter++,
      propertyId: 4,
      propertyName: 'Maison Vincennes',
      type: 'maintenance',
      title: 'Remplacement serrure porte entrée',
      assigneeName: 'Serrurier Express',
      startDate: isoDate(y, m, d + 10),
      endDate: isoDate(y, m, d + 10),
      startTime: '14:00',
      endTime: '16:00',
      status: 'scheduled',
      estimatedDurationHours: 2,
    },
    {
      id: idCounter++,
      propertyId: 7,
      propertyName: 'Villa Neuilly',
      type: 'maintenance',
      title: 'Entretien jardin et piscine',
      assigneeName: 'Jardins & Co',
      startDate: isoDate(y, m, d + 6),
      endDate: isoDate(y, m, d + 7),
      startTime: '08:00',
      endTime: '16:00',
      status: 'scheduled',
      estimatedDurationHours: 8,
      notes: 'Tonte + taille haies + traitement piscine',
    },
    {
      id: idCounter++,
      propertyId: 2,
      propertyName: 'Appart. Marais',
      type: 'maintenance',
      title: 'Réparation volet roulant chambre',
      assigneeName: 'Marc Dupuis',
      startDate: isoDate(y, m, d - 1),
      endDate: isoDate(y, m, d),
      startTime: '10:00',
      endTime: '13:00',
      status: 'in_progress',
      estimatedDurationHours: 3,
    },
    {
      id: idCounter++,
      propertyId: 5,
      propertyName: 'Studio Saint-Germain',
      type: 'maintenance',
      title: 'Remplacement ballon eau chaude',
      assigneeName: 'Plomberie Parisienne',
      startDate: isoDate(y, m, d + 10),
      endDate: isoDate(y, m, d + 11),
      startTime: '09:00',
      endTime: '14:00',
      status: 'scheduled',
      estimatedDurationHours: 5,
      notes: 'Coordonner avec propriétaire pour accès',
    },
    {
      id: idCounter++,
      propertyId: 6,
      propertyName: 'Appart. Opera',
      type: 'maintenance',
      title: 'Peinture salon (rafraîchissement)',
      assigneeName: 'Déco & Peinture SARL',
      startDate: isoDate(y, m, d + 8),
      endDate: isoDate(y, m, d + 9),
      startTime: '08:00',
      endTime: '18:00',
      status: 'scheduled',
      estimatedDurationHours: 12,
      notes: 'Couleur : Blanc Cassé RAL 9010',
    },
    {
      id: idCounter++,
      propertyId: 8,
      propertyName: 'Duplex Châtelet',
      type: 'maintenance',
      title: 'Diagnostic électrique',
      assigneeName: 'Elec Service',
      startDate: isoDate(y, m, d + 10),
      endDate: isoDate(y, m, d + 10),
      startTime: '09:00',
      endTime: '12:00',
      status: 'scheduled',
      estimatedDurationHours: 3,
    },
    {
      id: idCounter++,
      propertyId: 10,
      propertyName: 'Penthouse Trocadéro',
      type: 'maintenance',
      title: 'Révision climatisation',
      assigneeName: 'Clim Confort',
      startDate: isoDate(y, m, d + 2),
      endDate: isoDate(y, m, d + 3),
      startTime: '08:30',
      endTime: '14:30',
      status: 'scheduled',
      estimatedDurationHours: 6,
      notes: 'Vérification 3 unités + recharge fluide',
    },
    {
      id: idCounter++,
      propertyId: 9,
      propertyName: 'T2 Nation',
      type: 'maintenance',
      title: 'Détartrage machine à laver',
      assigneeName: 'SAV Electroménager',
      startDate: isoDate(y, m, d + 5),
      endDate: isoDate(y, m, d + 5),
      startTime: '15:00',
      endTime: '16:00',
      status: 'scheduled',
      estimatedDurationHours: 1,
    },
  ];

  return [...interventions, ...maintenanceInterventions];
}

// ─── Mock Properties (extraites des réservations) ───────────────────────────
// TODO: Supprimer quand l'API Airbnb sera connectée.

export interface MockPlanningProperty {
  id: number;
  name: string;
  address: string;
  city: string;
  ownerName?: string;
}

function getMockPropertiesFromReservations(): MockPlanningProperty[] {
  const reservations = generateMockReservations();
  const seen = new Map<number, MockPlanningProperty>();

  const mockCities: Record<number, string> = {
    1: 'Paris 18e', 2: 'Paris 3e', 3: 'Paris 11e', 4: 'Vincennes',
    5: 'Paris 6e', 6: 'Paris 9e', 7: 'Neuilly-sur-Seine', 8: 'Paris 1er',
    9: 'Paris 12e', 10: 'Paris 16e',
  };

  reservations.forEach((r) => {
    if (!seen.has(r.propertyId)) {
      seen.set(r.propertyId, {
        id: r.propertyId,
        name: r.propertyName,
        address: '',
        city: mockCities[r.propertyId] || 'Paris',
      });
    }
  });

  return Array.from(seen.values()).sort((a, b) => a.id - b.id);
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const reservationsApi = {
  /** Indique si on est en mode mock planning (data hardcodées). */
  isMockMode(): boolean {
    return localStorage.getItem(MOCK_STORAGE_KEY) === 'true';
  },

  /** Active ou désactive le mode mock planning (persisté en localStorage). */
  setMockMode(enabled: boolean): void {
    localStorage.setItem(MOCK_STORAGE_KEY, enabled ? 'true' : 'false');
  },

  /** Indique si le mode mock analytics est actif. */
  isAnalyticsMockMode(): boolean {
    return localStorage.getItem(ANALYTICS_MOCK_KEY) === 'true';
  },

  /** Active ou désactive le mode mock analytics (persisté en localStorage). */
  setAnalyticsMockMode(enabled: boolean): void {
    localStorage.setItem(ANALYTICS_MOCK_KEY, enabled ? 'true' : 'false');
  },

  /** Retourne les propriétés mock pour le planning (uniquement en mode mock). */
  getMockProperties(): MockPlanningProperty[] {
    return getMockPropertiesFromReservations();
  },

  async getAll(filters?: ReservationFilters): Promise<Reservation[]> {
    if (localStorage.getItem(MOCK_STORAGE_KEY) === 'true' || localStorage.getItem(ANALYTICS_MOCK_KEY) === 'true') {
      let data = generateMockReservations();

      if (filters?.propertyIds && filters.propertyIds.length > 0) {
        data = data.filter((r) => filters.propertyIds!.includes(r.propertyId));
      }
      if (filters?.status) {
        data = data.filter((r) => r.status === filters.status);
      }
      if (filters?.from) {
        data = data.filter((r) => r.checkOut >= filters.from!);
      }
      if (filters?.to) {
        data = data.filter((r) => r.checkIn <= filters.to!);
      }

      // Simulate network delay
      return new Promise((resolve) => setTimeout(() => resolve(data), 300));
    }

    // API réelle — passer les paramètres au format attendu par Spring
    const params: Record<string, string | number | boolean | null | undefined> = {};
    if (filters?.propertyIds && filters.propertyIds.length > 0) {
      params.propertyIds = filters.propertyIds.join(',');
    }
    if (filters?.status) params.status = filters.status;
    if (filters?.from) params.from = filters.from;
    if (filters?.to) params.to = filters.to;

    return apiClient.get<Reservation[]>('/reservations', { params });
  },

  async getByProperty(propertyId: number): Promise<Reservation[]> {
    if (localStorage.getItem(MOCK_STORAGE_KEY) === 'true') {
      const data = generateMockReservations().filter((r) => r.propertyId === propertyId);
      return new Promise((resolve) => setTimeout(() => resolve(data), 200));
    }

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
    if (localStorage.getItem(MOCK_STORAGE_KEY) === 'true') {
      let data = generateMockPlanningInterventions();

      if (filters?.propertyIds && filters.propertyIds.length > 0) {
        data = data.filter((i) => filters.propertyIds!.includes(i.propertyId));
      }
      if (filters?.type) {
        data = data.filter((i) => i.type === filters.type);
      }
      if (filters?.from) {
        data = data.filter((i) => i.endDate >= filters.from!);
      }
      if (filters?.to) {
        data = data.filter((i) => i.startDate <= filters.to!);
      }

      return new Promise((resolve) => setTimeout(() => resolve(data), 200));
    }

    // Pas encore d'endpoint backend dedié pour les interventions de planning
    // Retourner un tableau vide — les réservations sont le contenu principal du planning
    try {
      const params: Record<string, string | number | boolean | null | undefined> = {};
      if (filters?.propertyIds && filters.propertyIds.length > 0) {
        params.propertyIds = filters.propertyIds.join(',');
      }
      if (filters?.from) params.from = filters.from;
      if (filters?.to) params.to = filters.to;
      if (filters?.type) params.type = filters.type;

      return await apiClient.get<PlanningIntervention[]>('/interventions/planning', { params });
    } catch {
      return [];
    }
  },
};
