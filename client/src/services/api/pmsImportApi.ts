import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export type ImportKind =
  | 'PROPERTY'
  | 'GUEST'
  | 'RESERVATION'
  | 'REVIEW'
  | 'RATE'
  | 'TASK'
  | 'ARCHIVE';
/** Kinds attached to a property: they need a property link or a property imported in the batch. */
export const PROPERTY_SCOPED_KINDS: ImportKind[] = [
  'RESERVATION',
  'REVIEW',
  'RATE',
  'TASK',
];
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
  /** Inquiries, requests and declined bookings: counted, never imported. */
  skipped?: number;
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
export interface ApiVendor {
  id: string;
  name: string;
  credentialFields: string[];
  docsUrl: string;
}
export interface ApiPullRequest {
  vendor: string;
  account: string;
  credentials: Record<string, string>;
  from: string;
  to: string;
}
export interface MigrationPlanStep {
  key: string;
  done: boolean;
  derived: boolean;
}
export interface MigrationPlan {
  sourcePms: string | null;
  contractEndDate: string | null;
  noticeDays: number | null;
  noticeDeadline: string | null;
  exportDeadline: string | null;
  daysUntilExportDeadline: number | null;
  steps: MigrationPlanStep[];
  nextStep: string | null;
  updatedAt: string | null;
}
export interface MigrationPlanUpdate {
  sourcePms: string | null;
  contractEndDate: string | null;
  noticeDays: number | null;
  checklist: Record<string, boolean>;
}
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
  apiVendors: () => apiClient.get<ApiVendor[]>(`${root}/api-vendors`),
  /** Credentials travel once in the request body; the server never stores them. */
  pull: (request: ApiPullRequest) =>
    apiClient.post<ImportView>(`${root}/api`, request),
  plan: () => apiClient.get<MigrationPlan>('/migration/plan'),
  savePlan: (update: MigrationPlanUpdate) =>
    apiClient.put<MigrationPlan>('/migration/plan', update),
  /** Full account archive (ZIP), streamed by the server and saved by the browser. */
  downloadAccountExport: async () => {
    const token = getAccessToken();
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/account/export`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      },
    );
    if (!response.ok) throw new Error('EXPORT_FAILED');
    const blob = await response.blob();
    const name =
      /filename="([^"]+)"/.exec(
        response.headers.get('Content-Disposition') ?? '',
      )?.[1] ?? 'baitly-export.zip';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
