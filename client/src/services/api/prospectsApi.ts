import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProspectDto {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  specialty?: string;
  category: string;
  status: string;
  notes?: string;
  website?: string;
  linkedIn?: string;
  revenue?: string;
  employees?: string;
}

export interface ImportResult {
  imported: number;
  category: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const prospectsApi = {
  getAll() {
    return apiClient.get<ProspectDto[]>('/prospects');
  },

  getByCategory(category: string) {
    return apiClient.get<ProspectDto[]>(`/prospects/category/${category}`);
  },

  importCsv(file: File, category: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return apiClient.upload<ImportResult>('/prospects/import', formData);
  },

  update(id: number, data: Partial<ProspectDto>) {
    return apiClient.put<ProspectDto>(`/prospects/${id}`, data);
  },

  delete(id: number) {
    return apiClient.delete(`/prospects/${id}`);
  },
};
