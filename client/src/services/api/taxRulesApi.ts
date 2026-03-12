import apiClient from '../apiClient';

// ─── Types (aligned with backend TaxRule entity) ─────────────────────────────

export interface TaxRule {
  id: number;
  countryCode: string;
  taxCategory: string;
  taxRate: number;       // 0.0000 – 1.0000 (backend format)
  taxName: string;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null;
  description: string | null;
  createdAt: string;
}

export interface TaxRuleRequest {
  countryCode: string;
  taxCategory: string;
  taxRate: number;       // 0.0000 – 1.0000
  taxName: string;
  effectiveFrom: string; // ISO date
  effectiveTo?: string | null;
  description?: string | null;
}

// ─── Tax categories (aligned with backend TaxCategory enum) ──────────────────

export const TAX_CATEGORIES = [
  'ACCOMMODATION',
  'STANDARD',
  'CLEANING',
  'FOOD',
  'TOURIST_TAX',
] as const;

export type TaxCategoryType = (typeof TAX_CATEGORIES)[number];

// ─── API ─────────────────────────────────────────────────────────────────────

export const taxRulesApi = {
  async getAll(): Promise<TaxRule[]> {
    return apiClient.get<TaxRule[]>('/tax-rules/all');
  },

  async getForCountry(countryCode: string): Promise<TaxRule[]> {
    return apiClient.get<TaxRule[]>(`/tax-rules/${countryCode}`);
  },

  async create(data: TaxRuleRequest): Promise<TaxRule> {
    return apiClient.post<TaxRule>('/tax-rules', data);
  },

  async update(id: number, data: TaxRuleRequest): Promise<TaxRule> {
    return apiClient.put<TaxRule>(`/tax-rules/${id}`, data);
  },

  async delete(id: number): Promise<void> {
    return apiClient.delete(`/tax-rules/${id}`);
  },
};
