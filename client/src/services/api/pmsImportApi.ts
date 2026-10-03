import apiClient from '../apiClient';

export type ImportKind = 'PROPERTY' | 'GUEST' | 'RESERVATION' | 'ARCHIVE';
export interface ImportPlan {
  documentId: string;
  kind: ImportKind;
  fields: Record<string, string>;
  defaults: Record<string, string>;
  propertyLinks: Record<string, number>;
  dateFormat: 'ISO' | 'DMY' | 'MDY' | 'EXCEL_1900';
  decimalSeparator: '.' | ',';
}
export interface ImportReport {
  ready: number;
  duplicates: number;
  archived: number;
  issueCount: number;
  issues: { documentId: string; row: number; code: string }[];
  totals: Record<string, string>;
  token: string;
}
export interface ImportSummary {
  id: string;
  source: string;
  sourceAccount: string;
  status: 'DRAFT' | 'COMPLETED';
  createdAt: string;
}
export interface ImportDocument {
  id: string;
  name: string;
  columns: string[];
  rowCount: number;
  sample: Record<string, string>[];
  attachment: boolean;
  propertyRefs: string[];
  unmappedColumns: string[];
}
export interface ImportView extends ImportSummary {
  documents: ImportDocument[];
  plans: ImportPlan[];
  report: ImportReport | null;
}
export type ImportSchema = Record<
  ImportKind,
  { key: string; required: boolean; aliases: string[] }[]
>;
const root = '/migration/imports';
export const pmsImportApi = {
  schema: () => apiClient.get<ImportSchema>(`${root}/schema`),
  recent: () => apiClient.get<ImportSummary[]>(root),
  get: (id: string) => apiClient.get<ImportView>(`${root}/${id}`),
  upload: (
    files: File[],
    source: string,
    account: string,
    encoding: string,
  ) => {
    const data = new FormData();
    files.forEach((file) => data.append('files', file));
    data.append('source', source);
    data.append('account', account);
    data.append('encoding', encoding);
    return apiClient.upload<ImportView>(root, data);
  },
  validate: (id: string, plans: ImportPlan[]) =>
    apiClient.put<ImportView>(`${root}/${id}/validate`, plans),
  commit: (id: string, token: string) =>
    apiClient.post<ImportView>(`${root}/${id}/commit`, { token }),
  export: (id: string) => apiClient.get<unknown>(`${root}/${id}/export`),
  deleteDraft: (id: string) => apiClient.delete(`${root}/${id}`),
};
