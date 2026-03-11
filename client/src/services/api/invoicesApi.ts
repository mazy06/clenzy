import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../storageService';

// ─── Types ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | 'CREDIT_NOTE';

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: '#D4A574',
  ISSUED: '#1976d2',
  PAID: '#4A9B8E',
  CANCELLED: '#9e9e9e',
  CREDIT_NOTE: '#f44336',
};

export interface InvoiceLine {
  id: number;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPriceHt: number;
  taxCategory: string;
  taxRate: number;
  taxAmount: number;
  totalHt: number;
  totalTtc: number;
}

export interface Invoice {
  id: number;
  organizationId: number;
  reservationId: number | null;
  interventionId: number | null;
  documentGenerationId: number | null;
  duplicateOfId: number | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  currency: string;
  countryCode: string;
  sellerName: string;
  sellerAddress: string | null;
  sellerTaxId: string | null;
  buyerName: string;
  buyerAddress: string | null;
  buyerTaxId: string | null;
  totalHt: number;
  totalTax: number;
  totalTtc: number;
  legalMentions: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  lines: InvoiceLine[];
  createdAt: string;
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  from?: string;
  to?: string;
  reservationId?: number;
}

export interface GenerateInvoiceRequest {
  reservationId: number;
}

export interface TemplateStatus {
  hasTemplate: boolean;
  templateName: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const invoicesApi = {
  async list(filters?: InvoiceFilters): Promise<Invoice[]> {
    const params: Record<string, string | number | boolean | null | undefined> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.from) params.from = filters.from;
    if (filters?.to) params.to = filters.to;
    if (filters?.reservationId) params.reservationId = filters.reservationId;
    return apiClient.get<Invoice[]>('/invoices', { params });
  },

  async get(id: number): Promise<Invoice> {
    return apiClient.get<Invoice>(`/invoices/${id}`);
  },

  async generateFromReservation(reservationId: number): Promise<Invoice> {
    return apiClient.post<Invoice>('/invoices/generate', { reservationId });
  },

  async issue(id: number): Promise<Invoice> {
    return apiClient.put<Invoice>(`/invoices/${id}/issue`);
  },

  async markPaid(id: number): Promise<Invoice> {
    return apiClient.put<Invoice>(`/invoices/${id}/pay`);
  },

  async cancel(id: number): Promise<Invoice> {
    return apiClient.put<Invoice>(`/invoices/${id}/cancel`);
  },

  async downloadPdf(id: number): Promise<Blob> {
    return apiClient.get<Blob>(`/invoices/${id}/pdf`);
  },

  async checkTemplateStatus(): Promise<TemplateStatus> {
    return apiClient.get<TemplateStatus>('/invoices/template-status');
  },

  async generateDuplicate(id: number): Promise<Invoice> {
    return apiClient.post<Invoice>(`/invoices/${id}/duplicate`);
  },

  /** Telecharger le PDF du document genere lie a la facture */
  async downloadDocumentPdf(generationId: number, filename: string) {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/documents/generations/${generationId}/download`;
    const token = getAccessToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors du telechargement`);
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },
};
