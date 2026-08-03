import apiClient from '../apiClient';

/** Licence/autorisation d'un logement (fiche logement > Conformité, vague M-A). */
export interface PropertyLicense {
  id: number;
  propertyId: number;
  licenseType: 'SHORT_TERM_RENTAL' | 'TOURISM_REGISTRATION' | 'SAFETY_CERT' | 'OTHER';
  licenseNumber: string | null;
  issuedBy: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  renewalLeadDays: number;
  documentRef: string | null;
  notes: string | null;
}

export type PropertyLicenseRequest = Omit<PropertyLicense, 'id' | 'propertyId'>;

export const propertyLicensesApi = {
  list(propertyId: number): Promise<PropertyLicense[]> {
    return apiClient.get<PropertyLicense[]>(`/properties/${propertyId}/licenses`);
  },
  create(propertyId: number, request: PropertyLicenseRequest): Promise<PropertyLicense> {
    return apiClient.post<PropertyLicense>(`/properties/${propertyId}/licenses`, request);
  },
  update(propertyId: number, id: number, request: PropertyLicenseRequest): Promise<PropertyLicense> {
    return apiClient.put<PropertyLicense>(`/properties/${propertyId}/licenses/${id}`, request);
  },
  remove(propertyId: number, id: number): Promise<void> {
    return apiClient.delete<void>(`/properties/${propertyId}/licenses/${id}`);
  },
};
