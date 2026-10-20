import apiClient, { type PaginatedResponse } from '../apiClient';

export type BaitlyCrmContactType = 'OWNER' | 'PROVIDER';
export type BaitlyCrmNature = 'UNKNOWN' | 'PRIVATE' | 'PROFESSIONAL';
export interface ProspectDto {
  id: number; name: string; email?: string; phone?: string; city?: string; specialty?: string;
  category: string; status: string; notes?: string; website?: string; linkedIn?: string;
  revenue?: string; employees?: string; contactType: BaitlyCrmContactType; contactNature: BaitlyCrmNature;
  sourceType: string; sourceDetail?: string; sourceUrl?: string; sourceRecordedAt?: string; archived: boolean;
}
export type BaitlyCrmContactWrite = Partial<Omit<ProspectDto, 'id' | 'sourceRecordedAt' | 'archived'>>;
export interface ImportResult { imported: number; duplicates: number; invalid: number; issues: Array<{ line: number; reason: string }> }
export interface BaitlyCrmAccess { organizationId: number; canManage: boolean; canAuthorize: boolean; canSendCampaigns?: boolean }
export interface BaitlyCrmFilters { search: string; type: string; status: string; page: number }
export interface BaitlyCrmAuthorizationCommand {
  channel: 'EMAIL' | 'SMS' | 'PHONE'; purpose: 'MANAGEMENT' | 'PROVIDER_RECRUITMENT';
  basis: 'CONSENT' | 'REQUESTED_CONTACT' | 'B2B_LEGITIMATE_INTEREST'; decision: 'GRANTED' | 'REVOKED';
  evidence: string; occurredAt: string; expiresAt?: string;
}
export interface BaitlyCrmAuthorization extends BaitlyCrmAuthorizationCommand {
  id: number; recordedAt: string; recordedBy: string; currentIdentity: boolean;
}
export const prospectsApi = {
  getAll: () => apiClient.get<ProspectDto[]>('/prospects'),
  getByCategory: (category: string) => apiClient.get<ProspectDto[]>(`/prospects/category/${category}`),
  page: (filters: BaitlyCrmFilters) => apiClient.get<PaginatedResponse<ProspectDto>>('/prospects/page', {
    params: { ...filters, type: filters.type === 'all' ? undefined : filters.type,
      status: filters.status === 'all' ? undefined : filters.status, size: 25 },
  }),
  access: () => apiClient.get<BaitlyCrmAccess>('/prospects/access'),
  detail: (id: number) => apiClient.get<ProspectDto>(`/prospects/${id}`),
  duplicates: (id: number) => apiClient.get<ProspectDto[]>(`/prospects/${id}/duplicates`),
  create: (data: BaitlyCrmContactWrite) => apiClient.post<ProspectDto>('/prospects', data),
  update: (id: number, data: BaitlyCrmContactWrite) => apiClient.put<ProspectDto>(`/prospects/${id}`, data),
  delete: (id: number) => apiClient.delete(`/prospects/${id}`),
  deleteMany: (ids:number[]) => apiClient.post<void>('/prospects/bulk-delete',{ids}),
  history: (id: number) => apiClient.get<BaitlyCrmAuthorization[]>(`/prospects/${id}/contact-authorizations`),
  authorize: (id: number, data: BaitlyCrmAuthorizationCommand) =>
    apiClient.post<BaitlyCrmAuthorization>(`/prospects/${id}/contact-authorizations`, data),
  importCsv(file: File, category: string, provenance?: string) {
    const body = new FormData(); body.append('file', file); body.append('category', category);
    if (provenance) body.append('provenance', provenance);
    return apiClient.upload<ImportResult>('/prospects/import', body);
  },
};
