import apiClient from '../apiClient';

// ─── Types (aligned with backend FiscalProfileDto) ──────────────────────────

export type FiscalRegime = 'STANDARD' | 'MICRO_ENTERPRISE' | 'SIMPLIFIED';

export interface FiscalProfile {
  id: number | null;
  organizationId: number;
  countryCode: string;
  defaultCurrency: string;
  taxIdNumber: string | null;
  vatNumber: string | null;
  fiscalRegime: FiscalRegime;
  vatRegistered: boolean;
  vatDeclarationFrequency: string | null;
  invoiceLanguage: string | null;
  invoicePrefix: string | null;
  legalMentions: string | null;
  legalEntityName: string | null;
  legalAddress: string | null;
}

export interface FiscalProfileUpdate {
  countryCode: string;
  defaultCurrency: string;
  taxIdNumber?: string | null;
  vatNumber?: string | null;
  fiscalRegime: FiscalRegime;
  vatRegistered: boolean;
  vatDeclarationFrequency?: string | null;
  invoiceLanguage?: string | null;
  invoicePrefix?: string | null;
  legalMentions?: string | null;
  legalEntityName?: string | null;
  legalAddress?: string | null;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const fiscalProfileApi = {
  async get(country?: string): Promise<FiscalProfile> {
    return apiClient.get<FiscalProfile>(country ? `/fiscal-profile/countries/${encodeURIComponent(country)}` : '/fiscal-profile');
  },

  async update(data: FiscalProfileUpdate, country?: string): Promise<FiscalProfile> {
    return apiClient.put<FiscalProfile>(country ? `/fiscal-profile/countries/${encodeURIComponent(country)}` : '/fiscal-profile', data);
  },
};
