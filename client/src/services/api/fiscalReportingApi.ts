import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VatBreakdown {
  taxCategory: string;
  taxName: string;
  taxRate: number;
  baseAmount: number;
  taxAmount: number;
  lineCount: number;
}

export interface VatSummary {
  countryCode: string;
  currency: string;
  period: string;
  totalHt: number;
  totalTax: number;
  totalTtc: number;
  invoiceCount: number;
  breakdown: VatBreakdown[];
  issuers?: { issuerKey: string; sellerName: string | null; summary: VatSummary }[];
}

// ─── API ────────────────────────────────────────────────────────────────────

export const fiscalReportingApi = {
  async getVatSummary(from: string, to: string, country?: string): Promise<VatSummary> {
    return apiClient.get<VatSummary>('/fiscal-reports/vat-summary', {
      params: { from, to, ...(country ? { country } : {}) },
    });
  },

  async getMonthlyVatSummary(year: number, month: number, country?: string): Promise<VatSummary> {
    return apiClient.get<VatSummary>('/fiscal-reports/vat-summary/monthly', {
      params: { year, month, ...(country ? { country } : {}) },
    });
  },

  async getQuarterlyVatSummary(year: number, quarter: number, country?: string): Promise<VatSummary> {
    return apiClient.get<VatSummary>('/fiscal-reports/vat-summary/quarterly', {
      params: { year, quarter, ...(country ? { country } : {}) },
    });
  },

  async getAnnualVatSummary(year: number, country?: string): Promise<VatSummary> {
    return apiClient.get<VatSummary>('/fiscal-reports/vat-summary/annual', {
      params: { year, ...(country ? { country } : {}) },
    });
  },
};
