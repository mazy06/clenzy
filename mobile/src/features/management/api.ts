import { apiClient } from '@/api/apiClient';
import { API_CONFIG } from '@/config/api';

export interface OwnerMandate {
  id: number; propertyId: number; contractNumber: string; status: string;
  startDate: string | null; endDate: string | null;
  signatureStatus: string | null; signatureToken: string | null;
}
export interface MandateSignature {
  status: 'PENDING' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';
  contractNumber: string; contractType: string; propertyName: string; ownerName: string;
  commissionRate: number | null; startDate: string | null; endDate: string | null;
  paymentModel: string; policeDeclarationBy: string; touristTaxBy: string; licenceHeldBy: string;
  documentAvailable: boolean; signedAt: string | null; signedByName: string | null;
  expiresAt: string | null; consentText: string;
}
export const isSignatureToken = (token: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
function signaturePath(token: string) {
  if (!isSignatureToken(token)) throw new Error('Invalid signature link');
  return `/public/contract-signature/${token}`;
}
export const managementApi = {
  list: (signal?: AbortSignal) => apiClient.get<OwnerMandate[]>('/mobile/owner-mandates', { signal }),
  view: (token: string, signal?: AbortSignal) => apiClient.get<MandateSignature>(signaturePath(token), { skipAuth: true, signal }),
  sign: (token: string, signerName: string) => apiClient.post<MandateSignature>(`${signaturePath(token)}/sign`,
    { signerName: signerName.trim(), consent: true }, { skipAuth: true }),
  documentUrl: (token: string) => `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${signaturePath(token)}/document`,
};
