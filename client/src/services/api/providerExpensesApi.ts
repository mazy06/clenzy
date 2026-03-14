import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExpenseStatus = 'DRAFT' | 'APPROVED' | 'INCLUDED' | 'PAID' | 'CANCELLED';
export type ExpenseCategory = 'CLEANING' | 'MAINTENANCE' | 'LAUNDRY' | 'SUPPLIES' | 'LANDSCAPING' | 'OTHER';

export interface ProviderExpense {
  id: number;
  providerId: number | null;
  providerName: string | null;
  propertyId: number | null;
  propertyName: string | null;
  interventionId: number | null;
  ownerPayoutId: number | null;
  description: string;
  amountHt: number;
  taxRate: number;
  taxAmount: number;
  amountTtc: number;
  currency: string;
  category: ExpenseCategory;
  expenseDate: string;
  status: ExpenseStatus;
  invoiceReference: string | null;
  receiptPath: string | null;
  notes: string | null;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderExpenseRequest {
  providerId: number;
  propertyId: number;
  interventionId?: number | null;
  description: string;
  amountHt: number;
  taxRate: number;
  category: ExpenseCategory;
  expenseDate: string;
  invoiceReference?: string | null;
  notes?: string | null;
}

export const EXPENSE_STATUS_COLORS: Record<ExpenseStatus, string> = {
  DRAFT: '#D4A574',
  APPROVED: '#1976d2',
  INCLUDED: '#7B1FA2',
  PAID: '#4A9B8E',
  CANCELLED: '#9e9e9e',
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  CLEANING: '#26A69A',
  MAINTENANCE: '#FF7043',
  LAUNDRY: '#42A5F5',
  SUPPLIES: '#AB47BC',
  LANDSCAPING: '#66BB6A',
  OTHER: '#78909C',
};

// ─── API ────────────────────────────────────────────────────────────────────

export const providerExpensesApi = {
  async getAll(params?: {
    providerId?: number;
    propertyId?: number;
    status?: ExpenseStatus;
  }): Promise<ProviderExpense[]> {
    return apiClient.get<ProviderExpense[]>('/provider-expenses', { params });
  },

  async getById(id: number): Promise<ProviderExpense> {
    return apiClient.get<ProviderExpense>(`/provider-expenses/${id}`);
  },

  async create(data: CreateProviderExpenseRequest): Promise<ProviderExpense> {
    return apiClient.post<ProviderExpense>('/provider-expenses', data);
  },

  async update(id: number, data: CreateProviderExpenseRequest): Promise<ProviderExpense> {
    return apiClient.put<ProviderExpense>(`/provider-expenses/${id}`, data);
  },

  async approve(id: number): Promise<ProviderExpense> {
    return apiClient.post<ProviderExpense>(`/provider-expenses/${id}/approve`);
  },

  async cancel(id: number): Promise<ProviderExpense> {
    return apiClient.post<ProviderExpense>(`/provider-expenses/${id}/cancel`);
  },

  async markAsPaid(id: number, paymentReference?: string): Promise<ProviderExpense> {
    return apiClient.post<ProviderExpense>(`/provider-expenses/${id}/pay`, undefined, {
      params: paymentReference ? { paymentReference } : {},
    });
  },

  async uploadReceipt(id: number, file: File): Promise<ProviderExpense> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<ProviderExpense>(`/provider-expenses/${id}/receipt`, formData);
  },

  async deleteReceipt(id: number): Promise<ProviderExpense> {
    return apiClient.delete<ProviderExpense>(`/provider-expenses/${id}/receipt`);
  },

  getReceiptDownloadUrl(id: number): string {
    return `/api/provider-expenses/${id}/receipt`;
  },
};
