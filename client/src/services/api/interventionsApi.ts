import apiClient from '../apiClient';
import { extractApiList } from '../../types';
import type { PaginatedResponse } from '../apiClient';
import type { InterventionDetailsData } from '../../modules/interventions/interventionUtils';

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
  /** Prix conseil plateforme (moteur ménage) snapshoté à la création. */
  recommendedCost?: number;
  actualCost?: number;
  notes?: string;
  photosUrl?: string;
  beforePhotosUrls?: string;
  afterPhotosUrls?: string;
  beforePhotoIds?: string;
  afterPhotoIds?: string;
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
  /** Prix conseil plateforme (moteur ménage) snapshoté à la création. */
  recommendedCost?: number;
  notes: string;
  photos: string;
  progressPercentage: number;
}

export interface InterventionListParams {
  [key: string]: string | number | boolean | undefined | null;
  propertyId?: number;
  page?: number;
  size?: number;
  sort?: string;
  type?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const interventionsApi = {
  /**
   * Toutes les interventions, filtrables.
   *
   * L'endpoint renvoie une PAGE Spring : la liste est dépliée ici pour que le
   * type annoncé dise la vérité. Il promettait un tableau alors qu'il rendait un
   * objet — le commentaire de `getPage` ci-dessous l'avouait, en renvoyant la
   * responsabilité aux appelants. Pour obtenir le total serveur, c'est `getPage`.
   */
  async getAll(params?: InterventionListParams): Promise<Intervention[]> {
    return extractApiList<Intervention>(await apiClient.get<unknown>('/interventions', { params }));
  },

  /**
   * Liste paginée SERVEUR (Spring Data Page brute, avec totalElements).
   * Contrairement à getAll, qui ne rend que la liste, cette méthode expose la
   * page complète pour piloter la pagination UI par le total serveur. Les filtres
   * type/status/priority/propertyId/startDate/endDate sont appliqués en SQL
   * par le backend (GET /api/interventions).
   */
  getPage(params: InterventionListParams = {}): Promise<PaginatedResponse<Intervention>> {
    const page = Number(params.page ?? 0);
    const size = Number(params.size ?? 20);
    return apiClient.get<PaginatedResponse<Intervention>>('/interventions', { params });
  },

  getById(id: number) {
    return apiClient.get<InterventionDetailsData>(`/interventions/${id}`);
  },

  create(data: InterventionFormData) {
    return apiClient.post<Intervention>('/interventions', data);
  },

  update(id: number, data: Partial<InterventionFormData>) {
    return apiClient.put<Intervention>(`/interventions/${id}`, data);
  },

  // Édite le montant : nouveau montant (SET), remise en € (DISCOUNT_AMOUNT) ou en
  // % (DISCOUNT_PERCENT). Le montant final est recalculé côté serveur.
  updateAmount(id: number, mode: 'SET' | 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENT', value: number) {
    return apiClient.put<Intervention>(`/interventions/${id}/amount`, { mode, value });
  },

  delete(id: number) {
    return apiClient.delete(`/interventions/${id}`);
  },

  start(id: number) {
    return apiClient.put<InterventionDetailsData>(`/interventions/${id}/start`);
  },

  updateProgress(id: number, progressPercentage: number) {
    return apiClient.put<InterventionDetailsData>(`/interventions/${id}/progress`, undefined, {
      params: { progressPercentage },
    });
  },

  complete(id: number) {
    return apiClient.put<InterventionDetailsData>(`/interventions/${id}/complete`);
  },

  reopen(id: number) {
    return apiClient.put<InterventionDetailsData>(`/interventions/${id}/reopen`);
  },

  updateCompletedSteps(id: number, completedSteps: string) {
    return apiClient.put<InterventionDetailsData>(`/interventions/${id}/completed-steps`, undefined, {
      params: { completedSteps },
    });
  },

  updateNotes(id: number, notes: string) {
    return apiClient.put<InterventionDetailsData>(`/interventions/${id}/notes`, undefined, {
      params: { notes },
    });
  },

  updateValidatedRooms(id: number, validatedRooms: string) {
    return apiClient.put<InterventionDetailsData>(`/interventions/${id}/validated-rooms`, undefined, {
      params: { validatedRooms },
    });
  },

  uploadPhotos(id: number, photos: File[], photoType: 'before' | 'after') {
    const formData = new FormData();
    photos.forEach((photo) => formData.append('photos', photo));
    formData.append('photoType', photoType);
    return apiClient.upload<InterventionDetailsData>(`/interventions/${id}/photos`, formData);
  },

  deletePhoto(id: number, photoId: number) {
    return apiClient.delete<InterventionDetailsData>(`/interventions/${id}/photos/${photoId}`);
  },

  assign(id: number, userId?: number, teamId?: number) {
    const params: Record<string, number> = {};
    if (userId) params.userId = userId;
    if (teamId) params.teamId = teamId;
    return apiClient.put<Intervention>(`/interventions/${id}/assign`, undefined, { params });
  },

  /** Check team member availability for a given intervention */
  checkTeamAvailability(teamId: number, interventionId: number) {
    return apiClient.get<TeamAvailabilityResponse>('/interventions/team-availability', {
      params: { teamId, interventionId },
    });
  },

  /** Check team member availability for a given date range (for service request conflict detection) */
  checkTeamAvailabilityByDate(teamId: number, date: string, durationHours?: number) {
    return apiClient.get<TeamAvailabilityResponse>('/interventions/team-availability', {
      params: { teamId, date, durationHours },
    });
  },

  /** Check individual user availability for a given date range */
  checkUserAvailabilityByDate(userId: number, date: string, durationHours?: number) {
    return apiClient.get<UserAvailabilityResponse>('/interventions/user-availability', {
      params: { userId, date, durationHours },
    });
  },
};

export interface TeamMemberAvailability {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  available: boolean;
  conflictCount: number;
}

export interface TeamAvailabilityResponse {
  teamId: number;
  teamName: string;
  interventionType: string;
  memberCount: number;
  members: TeamMemberAvailability[];
  teamConflictCount: number;
  allAvailable: boolean;
  rangeStart: string;
  rangeEnd: string;
}

export interface UserAvailabilityResponse {
  userId: number;
  firstName: string;
  lastName: string;
  available: boolean;
  conflictCount: number;
  rangeStart: string;
  rangeEnd: string;
}
