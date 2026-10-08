import apiClient from '../apiClient';
import type { Invoice } from './invoicesApi';
export type VerificationState = 'TO_CHECK' | 'BLOCKED' | 'CHECKED' | 'COPY';
export interface VerificationIssue { code: string; message: string }
export interface DocumentReview { id: number; state: VerificationState; sourceHash: string; version: string; issues: VerificationIssue[]; actor: string; checkedAt: string; current: boolean }
export interface DocumentVerification { state: VerificationState; sourceHash: string; issues: VerificationIssue[]; history: DocumentReview[]; pdfArchived: boolean }
export interface VerificationRow { invoice: Invoice; state: VerificationState; issueCount: number; pdfArchived: boolean }
export type InvoiceDraft = Pick<Invoice, 'sellerName' | 'sellerAddress' | 'sellerTaxId' | 'buyerName' | 'buyerAddress' | 'buyerTaxId' | 'legalMentions' | 'dueDate'> & { sourceHash: string };
export const baitlyDocumentVerificationApi = {
  list: () => apiClient.get<VerificationRow[]>('/document-verification'),
  get: (id: number) => apiClient.get<DocumentVerification>(`/document-verification/${id}`),
  check: (id: number) => apiClient.post<DocumentVerification>(`/document-verification/${id}/check`),
  update: (id: number, data: InvoiceDraft) => apiClient.put<DocumentVerification>(`/document-verification/${id}/draft`, data),
};
