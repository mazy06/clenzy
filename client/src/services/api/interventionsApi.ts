import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  propertyType?: string;
  propertyName: string;
  propertyAddress: string;
  propertyCity?: string;
  propertyPostalCode?: string;
  propertyCountry?: string;
  requestorId: number;
  requestorName: string;
  assignedToId: number;
  assignedToType: 'user' | 'team';
  assignedToName: string;
  scheduledDate: string;
  estimatedDurationHours: number;
  actualDurationMinutes?: number;
  progressPercentage: number;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  photosUrl?: string;
  beforePhotosUrls?: string;
  afterPhotosUrls?: string;
  completedSteps?: string;
  validatedRooms?: string;
  paymentStatus?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InterventionFormData {
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  requestorId: number;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  scheduledDate: string;
  estimatedDurationHours: number;
  estimatedCost?: number;
  notes: string;
  photos: string;
  progressPercentage: number;
}

export interface InterventionListParams {
  [key: string]: string | number | boolean | undefined | null;
  propertyId?: number;
  size?: number;
  sort?: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const ANALYTICS_MOCK_KEY = 'clenzy_analytics_mock';

function isoDate(year: number, month: number, day: number): string {
  return new Date(year, month, day).toISOString().split('T')[0];
}

function generateMockInterventions(): Intervention[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const now = new Date().toISOString();

  return [
    // ─── Ménages (CLEANING) — 10 interventions ────────────────────────
    {
      id: 2001, title: 'Ménage après séjour Dupont', description: 'Nettoyage complet studio',
      type: 'CLEANING', status: 'COMPLETED', priority: 'MEDIUM',
      propertyId: 1, propertyName: 'Studio Montmartre', propertyAddress: '12 Rue Lepic',
      requestorId: 1, requestorName: 'Pierre Martin',
      assignedToId: 10, assignedToType: 'user', assignedToName: 'Fatou Diallo',
      scheduledDate: isoDate(y, m, d - 7), estimatedDurationHours: 2, progressPercentage: 100,
      estimatedCost: 45, actualCost: 45, createdAt: now,
    },
    {
      id: 2002, title: 'Ménage après séjour Martin', description: 'Nettoyage appartement 2 chambres',
      type: 'CLEANING', status: 'COMPLETED', priority: 'MEDIUM',
      propertyId: 2, propertyName: 'Appart. Marais', propertyAddress: '8 Rue de Turenne',
      requestorId: 1, requestorName: 'Pierre Martin',
      assignedToId: 11, assignedToType: 'user', assignedToName: 'Carmen Lopez',
      scheduledDate: isoDate(y, m, d - 5), estimatedDurationHours: 3, progressPercentage: 100,
      estimatedCost: 65, actualCost: 60, createdAt: now,
    },
    {
      id: 2003, title: 'Ménage après séjour Tanaka', description: 'Nettoyage loft',
      type: 'CLEANING', status: 'COMPLETED', priority: 'MEDIUM',
      propertyId: 3, propertyName: 'Loft Bastille', propertyAddress: '25 Rue de la Roquette',
      requestorId: 2, requestorName: 'Sophie Durand',
      assignedToId: 12, assignedToType: 'user', assignedToName: 'Nathalie Blanc',
      scheduledDate: isoDate(y, m, d - 9), estimatedDurationHours: 3, progressPercentage: 100,
      estimatedCost: 60, actualCost: 65, createdAt: now,
    },
    {
      id: 2004, title: 'Ménage après séjour Johnson', description: 'Grand ménage maison 4 chambres',
      type: 'CLEANING', status: 'COMPLETED', priority: 'HIGH',
      propertyId: 4, propertyName: 'Maison Vincennes', propertyAddress: '5 Avenue du Château',
      requestorId: 2, requestorName: 'Sophie Durand',
      assignedToId: 10, assignedToType: 'user', assignedToName: 'Fatou Diallo',
      scheduledDate: isoDate(y, m, d - 4), estimatedDurationHours: 5, progressPercentage: 100,
      estimatedCost: 90, actualCost: 95, createdAt: now,
    },
    {
      id: 2005, title: 'Ménage après séjour Chen', description: 'Nettoyage studio',
      type: 'CLEANING', status: 'COMPLETED', priority: 'MEDIUM',
      propertyId: 5, propertyName: 'Studio Saint-Germain', propertyAddress: '18 Rue de Seine',
      requestorId: 3, requestorName: 'Marie Lefevre',
      assignedToId: 13, assignedToType: 'user', assignedToName: 'Amina Keita',
      scheduledDate: isoDate(y, m, d - 6), estimatedDurationHours: 2, progressPercentage: 100,
      estimatedCost: 50, actualCost: 50, createdAt: now,
    },
    {
      id: 2006, title: 'Ménage après séjour Williams', description: 'Nettoyage appartement',
      type: 'CLEANING', status: 'COMPLETED', priority: 'MEDIUM',
      propertyId: 6, propertyName: 'Appart. Opera', propertyAddress: '3 Rue Scribe',
      requestorId: 3, requestorName: 'Marie Lefevre',
      assignedToId: 14, assignedToType: 'user', assignedToName: 'Lucie Moreau',
      scheduledDate: isoDate(y, m, d - 3), estimatedDurationHours: 3, progressPercentage: 100,
      estimatedCost: 65, actualCost: 60, createdAt: now,
    },
    {
      id: 2007, title: 'Ménage après séjour Taylor', description: 'Grand ménage villa avec extérieur',
      type: 'CLEANING', status: 'COMPLETED', priority: 'HIGH',
      propertyId: 7, propertyName: 'Villa Neuilly', propertyAddress: "42 Boulevard d'Inkermann",
      requestorId: 1, requestorName: 'Pierre Martin',
      assignedToId: 10, assignedToType: 'team', assignedToName: 'Équipe Premium',
      scheduledDate: isoDate(y, m, d - 8), estimatedDurationHours: 6, progressPercentage: 100,
      estimatedCost: 120, actualCost: 130, createdAt: now,
    },
    {
      id: 2008, title: 'Ménage après séjour Davis', description: 'Nettoyage duplex 2 niveaux',
      type: 'CLEANING', status: 'COMPLETED', priority: 'MEDIUM',
      propertyId: 8, propertyName: 'Duplex Châtelet', propertyAddress: '10 Rue de Rivoli',
      requestorId: 2, requestorName: 'Sophie Durand',
      assignedToId: 11, assignedToType: 'user', assignedToName: 'Carmen Lopez',
      scheduledDate: isoDate(y, m, d - 2), estimatedDurationHours: 4, progressPercentage: 100,
      estimatedCost: 75, actualCost: 70, createdAt: now,
    },
    {
      id: 2009, title: 'Ménage après séjour Roux', description: 'Nettoyage T2',
      type: 'CLEANING', status: 'COMPLETED', priority: 'LOW',
      propertyId: 9, propertyName: 'T2 Nation', propertyAddress: '22 Rue de Picpus',
      requestorId: 3, requestorName: 'Marie Lefevre',
      assignedToId: 12, assignedToType: 'user', assignedToName: 'Nathalie Blanc',
      scheduledDate: isoDate(y, m, d - 5), estimatedDurationHours: 2, progressPercentage: 100,
      estimatedCost: 45, actualCost: 45, createdAt: now,
    },
    {
      id: 2010, title: 'Ménage après séjour Ivanov', description: 'Nettoyage penthouse luxe',
      type: 'CLEANING', status: 'COMPLETED', priority: 'HIGH',
      propertyId: 10, propertyName: 'Penthouse Trocadéro', propertyAddress: '1 Place du Trocadéro',
      requestorId: 1, requestorName: 'Pierre Martin',
      assignedToId: 10, assignedToType: 'team', assignedToName: 'Équipe Premium',
      scheduledDate: isoDate(y, m, d - 4), estimatedDurationHours: 5, progressPercentage: 100,
      estimatedCost: 100, actualCost: 110, createdAt: now,
    },

    // ─── Maintenances — 3 interventions ───────────────────────────────
    {
      id: 2011, title: 'Réparation fuite robinet cuisine', description: 'Joint à remplacer',
      type: 'MAINTENANCE', status: 'COMPLETED', priority: 'HIGH',
      propertyId: 1, propertyName: 'Studio Montmartre', propertyAddress: '12 Rue Lepic',
      requestorId: 1, requestorName: 'Pierre Martin',
      assignedToId: 20, assignedToType: 'user', assignedToName: 'Marc Dupuis',
      scheduledDate: isoDate(y, m, d - 12), estimatedDurationHours: 2, progressPercentage: 100,
      estimatedCost: 150, actualCost: 140, createdAt: now,
    },
    {
      id: 2012, title: 'Remplacement serrure porte entrée', description: 'Serrure 5 points A2P',
      type: 'MAINTENANCE', status: 'SCHEDULED', priority: 'MEDIUM',
      propertyId: 4, propertyName: 'Maison Vincennes', propertyAddress: '5 Avenue du Château',
      requestorId: 2, requestorName: 'Sophie Durand',
      assignedToId: 21, assignedToType: 'user', assignedToName: 'Serrurier Express',
      scheduledDate: isoDate(y, m, d + 5), estimatedDurationHours: 2, progressPercentage: 0,
      estimatedCost: 280, createdAt: now,
    },
    {
      id: 2013, title: 'Entretien jardin et piscine', description: 'Tonte + taille haies + traitement piscine',
      type: 'MAINTENANCE', status: 'SCHEDULED', priority: 'LOW',
      propertyId: 7, propertyName: 'Villa Neuilly', propertyAddress: "42 Boulevard d'Inkermann",
      requestorId: 1, requestorName: 'Pierre Martin',
      assignedToId: 22, assignedToType: 'team', assignedToName: 'Jardins & Co',
      scheduledDate: isoDate(y, m, d + 8), estimatedDurationHours: 8, progressPercentage: 0,
      estimatedCost: 350, createdAt: now,
    },

    // ─── Nettoyages spéciaux (DEEP_CLEANING) — 2 interventions ───────
    {
      id: 2014, title: 'Nettoyage en profondeur loft', description: 'Deep clean complet + désinfection',
      type: 'DEEP_CLEANING', status: 'SCHEDULED', priority: 'MEDIUM',
      propertyId: 3, propertyName: 'Loft Bastille', propertyAddress: '25 Rue de la Roquette',
      requestorId: 2, requestorName: 'Sophie Durand',
      assignedToId: 10, assignedToType: 'team', assignedToName: 'Équipe Premium',
      scheduledDate: isoDate(y, m, d + 3), estimatedDurationHours: 5, progressPercentage: 0,
      estimatedCost: 180, createdAt: now,
    },
    {
      id: 2015, title: 'Nettoyage en profondeur penthouse', description: 'Deep clean + traitement marbres',
      type: 'DEEP_CLEANING', status: 'COMPLETED', priority: 'HIGH',
      propertyId: 10, propertyName: 'Penthouse Trocadéro', propertyAddress: '1 Place du Trocadéro',
      requestorId: 1, requestorName: 'Pierre Martin',
      assignedToId: 10, assignedToType: 'team', assignedToName: 'Équipe Premium',
      scheduledDate: isoDate(y, m, d - 1), estimatedDurationHours: 6, progressPercentage: 100,
      estimatedCost: 250, actualCost: 240, createdAt: now,
    },
  ];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const interventionsApi = {
  /** Indique si le mode mock analytics est actif. */
  isMockMode(): boolean {
    return localStorage.getItem(ANALYTICS_MOCK_KEY) === 'true';
  },

  /** Active ou désactive le mode mock analytics (persisté en localStorage). */
  setMockMode(enabled: boolean): void {
    localStorage.setItem(ANALYTICS_MOCK_KEY, enabled ? 'true' : 'false');
  },

  getAll(params?: InterventionListParams) {
    if (localStorage.getItem(ANALYTICS_MOCK_KEY) === 'true') {
      let data = generateMockInterventions();
      if (params?.propertyId) {
        data = data.filter((i) => i.propertyId === params.propertyId);
      }
      return Promise.resolve(data);
    }
    return apiClient.get<Intervention[]>('/interventions', { params });
  },

  getById(id: number) {
    return apiClient.get<Intervention>(`/interventions/${id}`);
  },

  create(data: InterventionFormData) {
    return apiClient.post<Intervention>('/interventions', data);
  },

  update(id: number, data: Partial<InterventionFormData>) {
    return apiClient.put<Intervention>(`/interventions/${id}`, data);
  },

  delete(id: number) {
    return apiClient.delete(`/interventions/${id}`);
  },

  start(id: number) {
    return apiClient.put<Intervention>(`/interventions/${id}/start`);
  },

  updateProgress(id: number, progressPercentage: number) {
    return apiClient.put<Intervention>(`/interventions/${id}/progress`, undefined, {
      params: { progressPercentage },
    });
  },

  reopen(id: number) {
    return apiClient.put<Intervention>(`/interventions/${id}/reopen`);
  },

  updateCompletedSteps(id: number, completedSteps: string) {
    return apiClient.put<Intervention>(`/interventions/${id}/completed-steps`, undefined, {
      params: { completedSteps },
    });
  },

  updateNotes(id: number, notes: string) {
    return apiClient.put<Intervention>(`/interventions/${id}/notes`, undefined, {
      params: { notes },
    });
  },

  updateValidatedRooms(id: number, validatedRooms: string) {
    return apiClient.put<Intervention>(`/interventions/${id}/validated-rooms`, undefined, {
      params: { validatedRooms },
    });
  },

  uploadPhotos(id: number, photos: File[], photoType: 'before' | 'after') {
    const formData = new FormData();
    photos.forEach((photo) => formData.append('photos', photo));
    formData.append('photoType', photoType);
    return apiClient.upload<Intervention>(`/interventions/${id}/photos`, formData);
  },

  assign(id: number, userId?: number, teamId?: number) {
    const params: Record<string, number> = {};
    if (userId) params.userId = userId;
    if (teamId) params.teamId = teamId;
    return apiClient.put<Intervention>(`/interventions/${id}/assign`, undefined, { params });
  },
};
