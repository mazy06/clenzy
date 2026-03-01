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
}

// ─── API ────────────────────────────────────────────────────────────────────

export const fiscalReportingApi = {
  async getVatSummary(from: string, to: string): Promise<VatSummary> {
    return apiClient.get<VatSummary>('/fiscal/vat-summary', {
      params: { from, to },
    });
  },

  async getMonthlyVatSummary(year: number, month: number): Promise<VatSummary> {
    return apiClient.get<VatSummary>(`/fiscal/vat-summary/monthly/${year}/${month}`);
  },

  async getQuarterlyVatSummary(year: number, quarter: number): Promise<VatSummary> {
    return apiClient.get<VatSummary>(`/fiscal/vat-summary/quarterly/${year}/${quarter}`);
  },

  async getAnnualVatSummary(year: number): Promise<VatSummary> {
    return apiClient.get<VatSummary>(`/fiscal/vat-summary/annual/${year}`);
  },
};
