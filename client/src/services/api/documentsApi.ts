import apiClient from '../apiClient';
import { PaginatedResponse } from '../apiClient';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../storageService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DocumentTemplateTag {
  id: number;
  tagName: string;
  tagCategory: string;
  dataSource: string;
  description: string;
  tagType: string;
  required: boolean;
}

export interface DocumentTemplate {
  id: number;
  name: string;
  description: string;
  documentType: string;
  eventTrigger: string;
  filePath: string;
  originalFilename: string;
  version: number;
  active: boolean;
  emailSubject: string;
  emailBody: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tags: DocumentTemplateTag[];
}

export interface DocumentGeneration {
  id: number;
  templateId: number;
  templateName: string;
  documentType: string;
  referenceId: number;
  referenceType: string;
  userId: string;
  userEmail: string;
  fileName: string;
  fileSize: number;
  status: string;
  emailTo: string;
  emailStatus: string;
  emailSentAt: string;
  errorMessage: string;
  generationTimeMs: number;
  createdAt: string;
  // Conformite NF
  legalNumber: string | null;
  documentHash: string | null;
  locked: boolean;
  lockedAt: string | null;
  correctsId: number | null;
}

// ─── Conformite NF Types ──────────────────────────────────────────────────

export interface ComplianceReport {
  id: number;
  templateId: number;
  templateName: string;
  documentType: string;
  compliant: boolean;
  checkedAt: string;
  checkedBy: string;
  missingTags: string[];
  missingMentions: string[];
  warnings: string[];
  score: number;
}

export interface ComplianceStats {
  totalDocuments: number;
  totalLocked: number;
  totalFactures: number;
  totalFacturesLocked: number;
  totalDevis: number;
  totalDevisLocked: number;
  documentsByType: Record<string, number>;
  lastCheckAt: string | null;
  averageComplianceScore: number;
  countryCode: string;
  complianceStandard: string;
}

export interface IntegrityVerification {
  generationId: number;
  legalNumber: string | null;
  locked: boolean;
  verified: boolean;
  storedHash?: string;
  computedHash?: string;
  reason?: string;
}

export interface GenerateDocumentRequest {
  documentType: string;
  referenceId: number;
  referenceType: string;
  emailTo?: string;
  sendEmail: boolean;
}

export interface DocumentTypeOption {
  value: string;
  label: string;
}

export interface TagCategoryOption {
  value: string;
  label: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const documentsApi = {

  // ─── Templates ──────────────────────────────────────────────────────────

  getTemplates() {
    return apiClient.get<DocumentTemplate[]>('/documents/templates');
  },

  getTemplate(id: number) {
    return apiClient.get<DocumentTemplate>(`/documents/templates/${id}`);
  },

  uploadTemplate(data: FormData) {
    return apiClient.upload<DocumentTemplate>('/documents/templates', data);
  },

  updateTemplate(id: number, data: { name?: string; description?: string; eventTrigger?: string; emailSubject?: string; emailBody?: string }) {
    return apiClient.put<DocumentTemplate>(`/documents/templates/${id}`, data);
  },

  activateTemplate(id: number) {
    return apiClient.put<DocumentTemplate>(`/documents/templates/${id}/activate`);
  },

  deleteTemplate(id: number) {
    return apiClient.delete(`/documents/templates/${id}`);
  },

  reparseTemplate(id: number) {
    return apiClient.post<DocumentTemplate>(`/documents/templates/${id}/reparse`);
  },

  // ─── Generation ─────────────────────────────────────────────────────────

  generateDocument(request: GenerateDocumentRequest) {
    return apiClient.post<DocumentGeneration>('/documents/generate', request);
  },

  // ─── Historique ─────────────────────────────────────────────────────────

  getGenerations(params?: { page?: number; size?: number }) {
    return apiClient.get<PaginatedResponse<DocumentGeneration>>('/documents/generations', { params });
  },

  /** Telecharger un document genere */
  async downloadGeneration(generationId: number, filename: string) {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/documents/generations/${generationId}/download`;
    const token = getAccessToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors du telechargement`);
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },

  // ─── References ─────────────────────────────────────────────────────────

  getDocumentTypes() {
    return apiClient.get<DocumentTypeOption[]>('/documents/types');
  },

  getTagCategories() {
    return apiClient.get<TagCategoryOption[]>('/documents/tag-categories');
  },

  // ─── Conformite NF ─────────────────────────────────────────────────────

  verifyDocumentIntegrity(generationId: number) {
    return apiClient.get<IntegrityVerification>(`/documents/generations/${generationId}/verify`);
  },

  checkTemplateCompliance(templateId: number) {
    return apiClient.post<ComplianceReport>(`/documents/templates/${templateId}/compliance-check`);
  },

  getComplianceStats() {
    return apiClient.get<ComplianceStats>('/documents/compliance/stats');
  },

  getGenerationByLegalNumber(legalNumber: string) {
    return apiClient.get<DocumentGeneration>(`/documents/generations/by-number/${encodeURIComponent(legalNumber)}`);
  },

  createCorrectiveDocument(originalId: number, request: GenerateDocumentRequest) {
    return apiClient.post<DocumentGeneration>(`/documents/generations/${originalId}/correct`, request);
  },

};
