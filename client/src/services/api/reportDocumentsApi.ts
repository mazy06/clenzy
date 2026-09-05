import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

/**
 * Rapports d'analyse : composition, aperçu, génération, relecture, diffusion.
 *
 * <p>Le serveur renvoie un SNAPSHOT figé — tous les chiffres du document, déjà
 * formatés. L'écran et le PDF le traduisent chacun dans leur langage sans jamais
 * recalculer : ce qu'on voit est ce qu'on envoie.</p>
 */

export type ReportProfile = 'OWNER' | 'INTERNAL' | 'PROSPECT';
export type ReportGroupBy = 'NONE' | 'OWNER' | 'PROPERTY';
export type ReportDocumentStatus = 'DRAFT' | 'REVIEWED' | 'SENT' | 'ARCHIVED';

export type ReportSectionKind =
  | 'KPI_ROW' | 'TABLE' | 'CHART' | 'CHART_TABLE' | 'PNL' | 'LIST' | 'GLOSSARY' | 'NOTICE';

export type ReportChartType =
  | 'BARS' | 'STACKED_BARS' | 'HORIZONTAL_BARS' | 'LINES' | 'AREA' | 'DONUT';

export interface ReportMeta {
  documentNumber: string | null;
  version: number;
  profile: ReportProfile;
  title: string;
  issuerName: string;
  issuerLogoUrl: string | null;
  recipientName: string | null;
  periodStart: string;
  periodEnd: string;
  comparePeriodStart: string;
  comparePeriodEnd: string;
  lastYearPeriodStart: string;
  lastYearPeriodEnd: string;
  dataAsOf: string;
  currency: string;
  scopeLabels: string[];
  scopeNote: string | null;
}

export interface ReportKpi {
  key: string;
  label: string;
  /** Déjà formatée par le serveur — ne jamais reformater ici. */
  value: string;
  rawValue: number | null;
  deltaPreviousPct: number | null;
  deltaLastYearPct: number | null;
  higherIsBetter: boolean;
  hint: string | null;
}

export interface ReportSeries {
  key: string;
  label: string;
  values: Array<number | null>;
  tone: string | null;
  dashed: boolean;
}

export interface ReportChart {
  type: ReportChartType;
  categories: string[];
  series: ReportSeries[];
  valueUnit: string | null;
}

export interface ReportTable {
  columns: string[];
  aligns: Array<'START' | 'CENTER' | 'END'>;
  rows: string[][];
  totals: string[];
}

export interface ReportNote {
  tone: 'neutral' | 'positive' | 'warning' | 'critical';
  label: string;
  detail: string | null;
  impact: string | null;
}

export interface ReportSection {
  id: string;
  title: string;
  subtitle: string | null;
  kind: ReportSectionKind;
  table: ReportTable | null;
  chart: ReportChart | null;
  notes: ReportNote[];
  body: string | null;
  narrative: string | null;
}

export interface ReportSnapshot {
  meta: ReportMeta;
  kpis: ReportKpi[];
  sections: ReportSection[];
}

export interface ReportDocumentSummary {
  id: number;
  documentNumber: string;
  version: number;
  profile: ReportProfile;
  status: ReportDocumentStatus;
  title: string;
  recipientName: string | null;
  recipientEmail: string | null;
  periodStart: string;
  periodEnd: string;
  dataAsOf: string;
  hasNarrative: boolean;
  reviewedAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface ReportRequestBody {
  profile: ReportProfile;
  groupBy: ReportGroupBy;
  from: string;
  to: string;
  ownerIds: number[];
  propertyIds: number[];
  sections: string[];
  withNarrative: boolean;
}

const BASE = '/reports/documents';

export const reportDocumentsApi = {
  /** Calcule sans persister ni commenter — l'aperçu pendant qu'on compose. */
  preview: (body: ReportRequestBody) => apiClient.post<ReportSnapshot>(`${BASE}/preview`, body),

  generate: (body: ReportRequestBody) => apiClient.post<ReportDocumentSummary[]>(BASE, body),

  list: () => apiClient.get<ReportDocumentSummary[]>(BASE),

  snapshot: (id: number) => apiClient.get<ReportSnapshot>(`${BASE}/${id}`),

  /** Supprime un brouillon. Le serveur refuse un rapport déjà envoyé. */
  remove: (id: number) => apiClient.delete<void>(`${BASE}/${id}`),

  /**
   * Transmet le rapport. L'envoi vaut relecture — il n'y a plus d'étape « relu ».
   *
   * @param recipients adresses retenues ; vide = le destinataire du document
   */
  send: (id: number, recipients: string[] = []) =>
    apiClient.post<ReportDocumentSummary>(`${BASE}/${id}/send`, { recipients }),

  /**
   * Télécharge le PDF.
   *
   * <p>Passe par `fetch` et non par un lien : la route est authentifiée, et un
   * `<a href>` n'emporte pas le jeton.</p>
   */
  async downloadPdf(id: number, filename: string) {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${BASE}/${id}/pdf`;
    const token = getAccessToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors du téléchargement du rapport`);
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
};
