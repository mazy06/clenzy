import { apiClient, PaginatedResponse } from '../apiClient';

// ─── Templates ────────────────────────────────────────────────────────────────

export interface DocumentTemplateDto {
  id: number;
  name: string;
  description?: string;
  documentType: string;
  eventTrigger?: string;
  emailSubject?: string;
  emailBody?: string;
  isActive: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

// ─── Generations (historique) ─────────────────────────────────────────────────

export interface DocumentGenerationDto {
  id: number;
  templateName?: string;
  documentType: string;
  referenceType?: string;
  referenceId?: number;
  legalNumber?: string;
  status: string;
  fileName?: string;
  propertyName?: string;
  guestName?: string;
  reservationCode?: string;
  amount?: number;
  createdAt: string;
}

/** Matches backend GenerateDocumentRequest record exactly */
export interface GenerateDocumentRequest {
  documentType: string;       // e.g. "FACTURE", "RECU", "CONTRAT", "ATTESTATION"
  referenceId: number;        // reservation ID or intervention ID
  referenceType: string;      // "RESERVATION" or "INTERVENTION"
  emailTo?: string;
  sendEmail?: boolean;
}

// ─── Unified type for the list screen ────────────────────────────────────────

export type DocumentType = 'FACTURE' | 'RECU' | 'CONTRAT' | 'ATTESTATION' | string;
export type DocumentStatus = 'DRAFT' | 'SENT' | 'PAID' | string;

/** Normalized item for the mobile list (can be a template or a generation) */
export interface DocumentListItem {
  id: number;
  kind: 'template' | 'generation';
  type: string;
  title: string;
  status: string;
  amount?: number;
  propertyName?: string;
  guestName?: string;
  createdAt: string;
}

export const documentsApi = {
  // ─── Templates ────────────────────────────────────────────────────────
  async getTemplates(): Promise<DocumentTemplateDto[]> {
    return apiClient.get<DocumentTemplateDto[]>('/documents/templates');
  },

  async getTemplateById(id: number): Promise<DocumentTemplateDto> {
    return apiClient.get<DocumentTemplateDto>(`/documents/templates/${id}`);
  },

  // ─── Generations (historique) ─────────────────────────────────────────
  async getGenerations(page = 0, size = 50): Promise<PaginatedResponse<DocumentGenerationDto>> {
    return apiClient.get<PaginatedResponse<DocumentGenerationDto>>(
      '/documents/generations',
      { params: { page: String(page), size: String(size) } },
    );
  },

  async getGenerationsByReference(referenceType: string, referenceId: number): Promise<DocumentGenerationDto[]> {
    return apiClient.get<DocumentGenerationDto[]>(
      '/documents/generations/by-reference',
      { params: { referenceType, referenceId: String(referenceId) } },
    );
  },

  async downloadGeneration(id: number): Promise<string> {
    const data = await apiClient.get<{ url: string }>(`/documents/generations/${id}/download`);
    return data.url;
  },

  // ─── Generate ─────────────────────────────────────────────────────────
  async generate(request: GenerateDocumentRequest): Promise<DocumentGenerationDto> {
    return apiClient.post<DocumentGenerationDto>('/documents/generate', request);
  },

  // ─── Types & tag categories ───────────────────────────────────────────
  async getDocumentTypes(): Promise<string[]> {
    return apiClient.get<string[]>('/documents/types');
  },

  // ─── Unified list (templates + generations) ───────────────────────────
  async getAll(): Promise<DocumentListItem[]> {
    const [templates, generationsPage] = await Promise.all([
      documentsApi.getTemplates().catch(() => [] as DocumentTemplateDto[]),
      documentsApi.getGenerations(0, 100).catch(() => ({ content: [] as DocumentGenerationDto[] })),
    ]);

    const generations = Array.isArray(generationsPage)
      ? generationsPage
      : generationsPage.content ?? [];

    const templateItems: DocumentListItem[] = templates.map((t) => ({
      id: t.id,
      kind: 'template' as const,
      type: t.documentType,
      title: t.name,
      status: t.isActive ? 'ACTIF' : 'INACTIF',
      createdAt: t.createdAt,
    }));

    const generationItems: DocumentListItem[] = generations.map((g) => ({
      id: g.id,
      kind: 'generation' as const,
      type: g.documentType,
      title: g.legalNumber ?? g.fileName ?? `Document #${g.id}`,
      status: g.status,
      amount: g.amount,
      propertyName: g.propertyName,
      guestName: g.guestName,
      createdAt: g.createdAt,
    }));

    return [...generationItems, ...templateItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },
};
