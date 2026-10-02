import apiClient from '../apiClient';
import type { TaxCalculationMode } from './touristTaxApi';

/** Catégories de la taxe de séjour marocaine (art. 70 loi 47-06 modifiée). */
export type MaTaxCategory =
  | 'RIAD_MAISON' | 'MAISON_HOTES' | 'HOTEL_1_2' | 'HOTEL_3' | 'HOTEL_4' | 'HOTEL_5' | 'CLUB' | 'VILLAGE_VACANCES'
  | 'RESIDENCE_TOURISTIQUE' | 'AUTRES';

/**
 * Barème proposé pour un logement (France ou Maroc) — une suggestion à confirmer.
 * `exact = false` : fourchette légale (tarif communal inconnu) ; `verified = false` :
 * source à confirmer auprès de la commune.
 */
export interface TouristTaxSuggestion {
  countryCode: 'FR' | 'MA';
  communeCode: string | null;
  communeName: string | null;
  category: string;
  calculationMode: TaxCalculationMode;
  ratePerPerson: number | null;
  /** Fraction (0.05 = 5 %). */
  percentageRate: number | null;
  capPerPersonNight: number | null;
  departmentalSurchargePct: number | null;
  regionalSurchargePct: number | null;
  childrenExemptUnder: number;
  minRate: number | null;
  maxRate: number | null;
  exact: boolean;
  verified: boolean;
  platformsCollect: boolean;
  currency: string;
  sourceLabel: string;
  sourceUrl: string | null;
}

export interface TouristTaxSuggestQuery {
  countryCode: string;
  city: string;
  category: string;
  address?: string;
  postalCode?: string;
}

export const touristTaxReferenceApi = {
  /** 404 si aucun tarif connu (commune sans taxe, adresse introuvable). */
  suggest(query: TouristTaxSuggestQuery): Promise<TouristTaxSuggestion> {
    return apiClient.get<TouristTaxSuggestion>('/tourist-tax-reference/suggest', {
      params: {
        countryCode: query.countryCode,
        city: query.city,
        category: query.category,
        address: query.address || undefined,
        postalCode: query.postalCode || undefined,
      },
    });
  },
};
