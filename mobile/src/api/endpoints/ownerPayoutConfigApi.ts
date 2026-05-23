/**
 * Owner Payout Config API — methode de versement et coordonnees bancaires
 * d'un proprietaire (IBAN masque, Wise recipient, Open Banking consent).
 *
 * Backend : `OwnerPayoutConfigController` (`/api/owner-payout-config`).
 * Cote ownership : valide via le JWT, l'utilisateur doit etre admin ou le owner lui-meme.
 */
import { apiClient } from '../apiClient';
import type { PayoutMethod } from './payoutsApi';

export interface OwnerPayoutConfigDto {
  id: number | null;
  ownerId: number;
  payoutMethod: PayoutMethod | null;
  stripeConnectedAccountId: string | null;
  stripeOnboardingComplete: boolean;
  maskedIban: string | null;
  bic: string | null;
  bankAccountHolder: string | null;
  verified: boolean;
  wiseConfigured: boolean;
  openBankingProvider: string | null;
  openBankingConsentActive: boolean;
  openBankingConsentExpiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const ownerPayoutConfigApi = {
  /** Config du proprietaire connecte (self-service). */
  getMyConfig() {
    return apiClient.get<OwnerPayoutConfigDto>('/owner-payout-config/me');
  },

  /** Config d'un proprietaire specifique (admin ou self uniquement). */
  getConfig(ownerId: number) {
    return apiClient.get<OwnerPayoutConfigDto>(`/owner-payout-config/${ownerId}`);
  },
};
