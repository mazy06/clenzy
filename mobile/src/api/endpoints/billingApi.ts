import { apiClient, PaginatedResponse } from '../apiClient';

export interface PaymentDto {
  id: number;
  reservationId?: number;
  propertyId?: number;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  stripePaymentId?: string;
  guestName?: string;
  propertyName?: string;
  description?: string;
  createdAt: string;
  paidAt?: string;
}

export interface PaymentSummaryDto {
  totalRevenue: number;
  totalPending: number;
  totalRefunded: number;
  transactionCount: number;
  currency: string;
}

export interface InvoiceDto {
  id: number;
  invoiceNumber: string;
  reservationId?: number;
  propertyId?: number;
  propertyName?: string;
  guestName?: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
  dueDate?: string;
  paidAt?: string;
}

export interface RefundRequest {
  amount: number;
  reason: string;
}

export const billingApi = {
  getPaymentHistory(params?: Record<string, string>) {
    return apiClient.get<PaginatedResponse<PaymentDto>>('/payments/history', { params });
  },

  getPaymentSummary() {
    return apiClient.get<PaymentSummaryDto>('/payments/summary');
  },

  sendPaymentLink(reservationId: number) {
    return apiClient.post<void>(`/payments/send-link/${reservationId}`);
  },

  requestRefund(paymentId: number, request: RefundRequest) {
    return apiClient.post<PaymentDto>(`/payments/${paymentId}/refund`, request);
  },

  getInvoices(params?: Record<string, string>) {
    return apiClient.get<PaginatedResponse<InvoiceDto>>('/invoices', { params });
  },

  async downloadInvoice(id: number): Promise<string> {
    const data = await apiClient.get<{ url: string }>(`/invoices/${id}/download`);
    return data.url;
  },
};
