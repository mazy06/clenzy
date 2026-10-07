import apiClient from '../apiClient';
export type FiscalParty = { postcode: string; city: string; legalId: string; routingId: string };
export type FiscalTerms = { processCode: string; recoveryCosts: string; latePenalties: string; discount: string };
export type FiscalPreparation = { seller: FiscalParty; buyer: FiscalParty; terms: FiscalTerms };
export type FiscalDocument = {
  state: 'TO_PREPARE' | 'LOCAL_VALIDATED' | 'REVIEW_REQUIRED'; sourceHash: string;
  documentHash: string | null; validation: string | null; archivedAt: string | null;
  data: FiscalPreparation | null; issues: string[]; transmissionIssues?: { code: string; message: string }[];
};
export type FiscalCheck = { valid: boolean; issues: { code: string; message: string }[]; transmissionIssues?: { code: string; message: string }[] };
export type FiscalRequest = { sourceHash: string; data: FiscalPreparation };
const path = (id: number) => `/invoices/${id}/fiscal-document`;
export const baitlyInvoiceFiscalApi = {
  get: (id: number) => apiClient.get<FiscalDocument>(path(id)),
  check: (id: number, request: FiscalRequest) => apiClient.post<FiscalCheck>(`${path(id)}/check`, request),
  archive: (id: number, request: FiscalRequest) => apiClient.post<FiscalDocument>(path(id), request),
  download: (id: number) => apiClient.get<Blob>(`${path(id)}/xml`, { responseType: 'blob' }),
};
