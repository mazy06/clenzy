import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${endpoint}`;
  const token = getAccessToken();

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
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
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
}

function buildDateParams(from: string, to: string): string {
  return `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

async function downloadFilePost(endpoint: string, body: unknown, filename: string): Promise<void> {
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${endpoint}`;
  const token = getAccessToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Erreur ${response.status} lors du telechargement`);
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 200);
}

// ─── API ────────────────────────────────────────────────────────────────────

export const accountingExportApi = {
  /** FEC — Fichier des Ecritures Comptables (norme DGFiP) */
  async downloadFec(from: string, to: string): Promise<void> {
    const filename = `FEC_${from}_${to}.txt`;
    return downloadFile(`/accounting/export/fec${buildDateParams(from, to)}`, filename);
  },

  /** CSV des reservations */
  async downloadReservationsCsv(from: string, to: string): Promise<void> {
    const filename = `reservations_${from}_${to}.csv`;
    return downloadFile(`/accounting/export/reservations-csv${buildDateParams(from, to)}`, filename);
  },

  /** CSV des reversements proprietaires */
  async downloadPayoutsCsv(from: string, to: string): Promise<void> {
    const filename = `payouts_${from}_${to}.csv`;
    return downloadFile(`/accounting/export/payouts-csv${buildDateParams(from, to)}`, filename);
  },

  /** CSV des depenses prestataires */
  async downloadExpensesCsv(from: string, to: string): Promise<void> {
    const filename = `depenses_${from}_${to}.csv`;
    return downloadFile(`/accounting/export/expenses-csv${buildDateParams(from, to)}`, filename);
  },

  /** CSV des factures */
  async downloadInvoicesCsv(from: string, to: string): Promise<void> {
    const filename = `factures_${from}_${to}.csv`;
    return downloadFile(`/accounting/export/invoices-csv${buildDateParams(from, to)}`, filename);
  },

  /** SEPA XML pain.001 pour virements bancaires */
  async downloadSepaXml(payoutIds: number[]): Promise<void> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `SEPA_${today}.xml`;
    return downloadFilePost('/accounting/export/sepa-xml', payoutIds, filename);
  },
};
