import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Modes de calcul de la taxe de séjour (miroir de TouristTaxConfig.TaxCalculationMode). */
export type TaxCalculationMode = 'PER_PERSON_PER_NIGHT' | 'PERCENTAGE_OF_RATE' | 'FLAT_PER_NIGHT';

/**
 * Barème de taxe de séjour saisi par l'organisation.
 * `propertyId` null = barème par défaut de l'org (sinon override par bien).
 * `percentageRate` est une FRACTION (0.05 = 5 %) — convertir pour l'affichage.
 */
export interface TouristTaxConfig {
  id: number;
  organizationId: number;
  propertyId: number | null;
  communeName: string;
  communeCode: string | null;
  calculationMode: TaxCalculationMode;
  ratePerPerson: number | null;
  percentageRate: number | null;
  capPerPersonNight: number | null;
  departmentalSurchargePct: number | null;
  regionalSurchargePct: number | null;
  exemptMinors: boolean;
  maxNights: number | null;
  childrenExemptUnder: number | null;
  enabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Payload d'upsert (l'org est imposée par le backend via le TenantContext). */
export interface TouristTaxConfigRequest {
  propertyId: number | null;
  communeName: string;
  communeCode?: string | null;
  calculationMode: TaxCalculationMode;
  ratePerPerson?: number | null;
  percentageRate?: number | null;
  capPerPersonNight?: number | null;
  departmentalSurchargePct?: number | null;
  regionalSurchargePct?: number | null;
  exemptMinors?: boolean | null;
  maxNights?: number | null;
  childrenExemptUnder?: number | null;
  enabled?: boolean | null;
}

export interface TouristTaxReportLine {
  reservationId: number;
  propertyId: number | null;
  propertyName: string | null;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  taxablePersons: number;
  communeName: string;
  calculationMode: TaxCalculationMode;
  baseAmount: number;
  surchargeAmount: number;
  taxAmount: number;
  currency: string;
}

export interface TouristTaxReport {
  from: string;
  to: string;
  lines: TouristTaxReportLine[];
  totalTax: number;
  reservationCount: number;
  missingConfigCount: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const touristTaxApi = {
  /** Liste des barèmes de l'organisation (défaut org + overrides par bien). */
  getConfigs(): Promise<TouristTaxConfig[]> {
    return apiClient.get<TouristTaxConfig[]>('/tourist-tax');
  },

  /** Upsert d'un barème (clé naturelle : propertyId, null = défaut org). */
  saveConfig(request: TouristTaxConfigRequest): Promise<TouristTaxConfig> {
    return apiClient.put<TouristTaxConfig>('/tourist-tax', request);
  },

  deleteConfig(id: number): Promise<void> {
    return apiClient.delete(`/tourist-tax/configs/${id}`);
  },

  /** Rapport de période (réservations confirmées par date de check-out). */
  getReport(from: string, to: string): Promise<TouristTaxReport> {
    return apiClient.get<TouristTaxReport>('/tourist-tax/report', { params: { from, to } });
  },

  /** Télécharge l'export CSV de la période (Content-Disposition attachment). */
  async downloadCsv(from: string, to: string): Promise<void> {
    const endpoint = `/tourist-tax/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${endpoint}`;
    const token = getAccessToken();

    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors du téléchargement`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `taxe-sejour_${from}_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
  },
};
