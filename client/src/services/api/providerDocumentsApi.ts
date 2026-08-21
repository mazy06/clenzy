import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';

// ─── Justificatifs professionnels des intervenants ──────────────────────────
// Kbis, attestation de vigilance URSSAF, RC pro, identite. Le binaire vit dans
// PhotoStorageService cote serveur ; l'API ne rend que des metadonnees.

export type ProviderDocumentType =
  | 'COMPANY_REGISTRATION'
  | 'URSSAF_VIGILANCE'
  | 'LIABILITY_INSURANCE'
  | 'IDENTITY'
  | 'OTHER';

export type ProviderDocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProviderDocument {
  id: number;
  documentType: ProviderDocumentType;
  fileName: string;
  contentType: string | null;
  fileSize: number | null;
  /** Date d'expiration declaree — obligatoire pour la vigilance URSSAF. */
  expiresAt: string | null;
  status: ProviderDocumentStatus;
  /** Motif de refus, a rendre a l'intervenant pour qu'il sache quoi corriger. */
  reviewNote: string | null;
  /** Validee ET non perimee : c'est ce qui compte pour travailler. */
  currentlyValid: boolean;
  createdAt: string;
}

/** Pieces sans lesquelles un intervenant ne peut pas travailler legalement. */
export const REQUIRED_PROVIDER_DOCUMENTS: ProviderDocumentType[] = [
  'COMPANY_REGISTRATION',
  'URSSAF_VIGILANCE',
  'LIABILITY_INSURANCE',
];

export const providerDocumentsApi = {
  listMine(): Promise<ProviderDocument[]> {
    return apiClient.get<ProviderDocument[]>('/provider-documents/me');
  },

  upload(documentType: ProviderDocumentType, file: File, expiresAt?: string | null): Promise<ProviderDocument> {
    const form = new FormData();
    form.append('documentType', documentType);
    form.append('file', file);
    if (expiresAt) form.append('expiresAt', expiresAt);
    // `upload` et non `post` : c'est le point d'entree multipart du client.
    return apiClient.upload<ProviderDocument>('/provider-documents/me', form);
  },

  remove(id: number): Promise<void> {
    return apiClient.delete<void>(`/provider-documents/me/${id}`);
  },

  /** URL de consultation — le serveur sert la piece en `inline`. */
  downloadUrl(id: number): string {
    return `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/provider-documents/me/${id}/download`;
  },
};
