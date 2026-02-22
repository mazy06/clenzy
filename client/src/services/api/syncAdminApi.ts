import apiClient, { PaginatedResponse } from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConnectionSummary {
  id: number;
  channel: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  mappingCount: number;
  healthStatus: string;
}

export interface ConnectionDetail extends ConnectionSummary {
  organizationId: number;
  credentialsRef: string | null;
  webhookUrl: string | null;
  syncConfig: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SyncLog {
  id: number;
  channel: string | null;
  direction: string | null;
  eventType: string;
  status: string;
  errorMessage: string | null;
  durationMs: number;
  createdAt: string | null;
}

export interface SyncEventStats {
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
  totalLast24h: number;
}

export interface OutboxEvent {
  id: number;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  topic: string;
  status: string;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string | null;
  sentAt: string | null;
}

export interface OutboxStats {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

export interface BulkRetryResult {
  requested: number;
  retried: number;
  failedIds: number[];
}

export interface CalendarCommand {
  id: number;
  propertyId: number;
  commandType: string;
  dateFrom: string | null;
  dateTo: string | null;
  source: string;
  reservationId: number | null;
  status: string;
  executedAt: string | null;
}

export interface CalendarConflict {
  id: number;
  propertyId: number | null;
  date: string | null;
  status: string | null;
  organizationId: number;
}

export interface MappingSummary {
  id: number;
  channel: string | null;
  entityType: string;
  internalId: number;
  externalId: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

export interface DiagnosticsSummary {
  totalConnections: number;
  activeConnections: number;
  healthyConnections: number;
  pendingOutbox: number;
  failedOutbox: number;
  oldestPendingEvent: string | null;
  syncLogsByStatus: Record<string, number>;
}

export interface MetricsSnapshot {
  syncLatencyP95: Record<string, number>;
  syncSuccessCount: Record<string, number>;
  syncFailureCount: Record<string, number>;
  calendarConflicts: number;
  doubleBookingsPrevented: number;
}

export interface ReconciliationRun {
  id: number;
  channel: string;
  propertyId: number;
  organizationId: number;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  pmsDaysChecked: number;
  channelDaysChecked: number;
  discrepanciesFound: number;
  discrepanciesFixed: number;
  divergencePct: string | null;
  details: string | null;
  errorMessage: string | null;
}

export interface ReconciliationStats {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  divergenceRuns: number;
  totalDiscrepancies: number;
  totalFixes: number;
  lastRunAt: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/admin/sync';

export const syncAdminApi = {
  // Connections
  getConnections: (): Promise<ConnectionSummary[]> =>
    apiClient.get(`${BASE}/connections`),
  getConnectionDetail: (id: number): Promise<ConnectionDetail> =>
    apiClient.get(`${BASE}/connections/${id}`),
  forceHealthCheck: (id: number): Promise<{ connectionId: number; healthStatus: string }> =>
    apiClient.post(`${BASE}/connections/${id}/health-check`, {}),

  // Sync Events
  getEvents: (params?: { channel?: string; status?: string; from?: string; page?: number; size?: number }): Promise<PaginatedResponse<SyncLog>> =>
    apiClient.get(`${BASE}/events`, { params }),
  getEventStats: (): Promise<SyncEventStats> =>
    apiClient.get(`${BASE}/events/stats`),

  // Outbox
  getOutbox: (params?: { status?: string; topic?: string; page?: number; size?: number }): Promise<PaginatedResponse<OutboxEvent>> =>
    apiClient.get(`${BASE}/outbox`, { params }),
  getOutboxStats: (): Promise<OutboxStats> =>
    apiClient.get(`${BASE}/outbox/stats`),
  retryOutboxEvents: (ids: number[]): Promise<BulkRetryResult> =>
    apiClient.post(`${BASE}/outbox/retry`, { ids }),

  // Calendar
  getCalendarCommands: (params?: { propertyId?: number; page?: number; size?: number }): Promise<PaginatedResponse<CalendarCommand>> =>
    apiClient.get(`${BASE}/calendar/commands`, { params }),
  getCalendarConflicts: (): Promise<CalendarConflict[]> =>
    apiClient.get(`${BASE}/calendar/conflicts`),

  // Mappings
  getMappings: (params?: { page?: number; size?: number }): Promise<PaginatedResponse<MappingSummary>> =>
    apiClient.get(`${BASE}/mappings`, { params }),
  getMappingDetail: (id: number): Promise<MappingSummary> =>
    apiClient.get(`${BASE}/mappings/${id}`),

  // Diagnostics
  getDiagnostics: (): Promise<DiagnosticsSummary> =>
    apiClient.get(`${BASE}/diagnostics`),
  getMetrics: (): Promise<MetricsSnapshot> =>
    apiClient.get(`${BASE}/diagnostics/metrics`),

  // Reconciliation
  getReconciliationRuns: (params?: { propertyId?: number; status?: string; page?: number; size?: number }): Promise<PaginatedResponse<ReconciliationRun>> =>
    apiClient.get(`${BASE}/reconciliation`, { params }),
  getReconciliationStats: (): Promise<ReconciliationStats> =>
    apiClient.get(`${BASE}/reconciliation/stats`),
  triggerReconciliation: (propertyId: number): Promise<{ message: string }> =>
    apiClient.post(`${BASE}/reconciliation/trigger`, { propertyId }),
};
