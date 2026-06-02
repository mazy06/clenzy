import apiClient from '../apiClient';

export interface WaitlistSignup {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  propertyCount: string | null;
  city: string | null;
  source: string | null;
  brevoSynced: boolean;
  createdAt: string;
}

export interface WaitlistStats {
  total: number;
  founderSpots: number;
  founderSpotsLeft: number;
}

/** Consultation / export de la waitlist — SUPER_ADMIN / SUPER_MANAGER. */
export const waitlistApi = {
  list(): Promise<WaitlistSignup[]> {
    return apiClient.get<WaitlistSignup[]>('/admin/waitlist');
  },
  stats(): Promise<WaitlistStats> {
    return apiClient.get<WaitlistStats>('/admin/waitlist/stats');
  },
};
