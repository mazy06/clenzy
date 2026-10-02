import apiClient from '../apiClient';

export type FrRentalUse = 'RESIDENCE_PRINCIPALE' | 'RESIDENCE_SECONDAIRE' | 'MEUBLE_DEDIE' | 'CHAMBRE_HOTES';

export type RegistrationVerdict = 'ABSENT' | 'VALID' | 'MALFORMED' | 'UNCHECKED' | 'COMMUNE_MISMATCH';

/** Profil réglementaire France d'un logement — tout est calculé par le serveur. */
export interface FrRegulatoryProfile {
  propertyId: number;
  countryCode: string | null;
  communeInseeCode: string | null;
  rentalUse: FrRentalUse | null;
  /** Licence « Enregistrement touristique » : source unique, modifiée via l'API des licences. */
  registrationNumber: string | null;
  registrationVerdict: RegistrationVerdict;
  registrationRequired: boolean;
  nightsCapEnabled: boolean;
  maxNightsPerYear: number;
  nightsRentedThisYear: number;
  nightsRemainingThisYear: number;
  policeFormEnabled: boolean;
}

/** La commune n'est pas modifiable : elle est déduite de l'adresse du logement. */
export interface FrRegulatoryProfileUpdate {
  rentalUse: FrRentalUse | null;
  maxNightsPerYear: number | null;
  policeFormEnabled: boolean | null;
}

/** Ligne de la synthèse « Conformité France » du portefeuille. */
export interface FrComplianceOverviewRow {
  propertyId: number;
  propertyName: string | null;
  profile: FrRegulatoryProfile;
  touristTaxConfigured: boolean;
}

export const frRegulatoryApi = {
  overview(): Promise<FrComplianceOverviewRow[]> {
    return apiClient.get<FrComplianceOverviewRow[]>('/regulatory/fr/overview');
  },
  get(propertyId: number): Promise<FrRegulatoryProfile> {
    return apiClient.get<FrRegulatoryProfile>(`/regulatory/properties/${propertyId}/fr-profile`);
  },
  update(propertyId: number, request: FrRegulatoryProfileUpdate): Promise<FrRegulatoryProfile> {
    return apiClient.put<FrRegulatoryProfile>(`/regulatory/properties/${propertyId}/fr-profile`, request);
  },
};
