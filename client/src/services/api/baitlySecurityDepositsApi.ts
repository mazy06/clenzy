import apiClient, { type ApiError } from '../apiClient';

export interface BaitlySecurityDeposit {
  id: number;
  reservationId: number;
  amount: number;
  currency: string;
  status: 'PENDING' | 'HELD' | 'RELEASING' | 'RELEASED' | 'CAPTURING' | 'CAPTURED' | 'FAILED' | 'EXPIRED';
  capturedAmount: number | null;
  holdExpiresAt: string | null;
}

export const baitlySecurityDepositsApi = {
  async byReservation(id: number, signal?: AbortSignal): Promise<BaitlySecurityDeposit | null> {
    try {
      return await apiClient.get<BaitlySecurityDeposit>(`/security-deposits/by-reservation/${id}`, { signal });
    } catch (error) {
      if ((error as ApiError).status === 404) return null;
      throw error;
    }
  },
};
