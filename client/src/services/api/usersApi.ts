import apiClient from '../apiClient';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status?: string;
  createdAt?: string;
  // Profil host (donnees du formulaire de devis)
  companyName?: string;
  forfait?: string;
  city?: string;
  postalCode?: string;
  propertyType?: string;
  propertyCount?: number;
  surface?: number;
  guestCapacity?: number;
  // Donnees supplementaires du formulaire de devis
  bookingFrequency?: string;
  cleaningSchedule?: string;
  calendarSync?: string;
  services?: string;       // Séparé par virgule
  servicesDevis?: string;  // Séparé par virgule
  deferredPayment?: boolean;
  // Organisation rattachee
  organizationId?: number;
  organizationName?: string;
}

export interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: string;
}

export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  captchaRequired: boolean;
  failedAttempts: number;
}

export const usersApi = {
  getAll(params?: { role?: string }) {
    return apiClient.get<User[]>('/users', { params });
  },
  getById(id: number) {
    return apiClient.get<User>(`/users/${id}`);
  },
  create(data: UserFormData) {
    return apiClient.post<User>('/users', data);
  },
  update(id: number, data: Partial<UserFormData>) {
    return apiClient.put<User>(`/users/${id}`, data);
  },
  delete(id: number) {
    return apiClient.delete(`/users/${id}`);
  },
  // ─── Lockout management (admin) ─────────────────────
  getLockoutStatus(userId: number) {
    return apiClient.get<LockoutStatus>(`/users/${userId}/lockout-status`);
  },
  unlockUser(userId: number) {
    return apiClient.post<{ success: boolean; message: string }>(`/users/${userId}/unlock`, {});
  },
};
