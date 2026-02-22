import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HealthCheckService {
  name: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN';
  responseTimeMs: number;
  category: string;
  critical: boolean;
  details: string;
  lastCheck: string;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  heapUsedMb: number;
  heapMaxMb: number;
  diskUsage: number;
  uptimeSeconds: number;
}

export interface HealthResponse {
  services: HealthCheckService[];
  systemMetrics: SystemMetrics;
}

export interface UserMetrics {
  total: number;
  active: number;
  inactive: number;
  newThisWeek: number;
}

export interface SessionMetrics {
  totalTokens: number;
  validTokens: number;
  revokedTokens: number;
  cacheHits: number;
}

export interface PerformanceMetrics {
  avgResponseTimeMs: number;
  totalRequests: number;
  errorRate: number;
  uptimePercent: number;
}

export interface SecurityMetrics {
  failedLogins: number;
  permissionDenied: number;
  suspiciousActivity: number;
  lastIncident: string | null;
}

export interface KeycloakMetricsResponse {
  users: UserMetrics;
  sessions: SessionMetrics;
  performance: PerformanceMetrics;
  security: SecurityMetrics;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  eventType: string;
  action: string;
  actorId: string;
  actorEmail: string;
  actorIp: string;
  result: string;
  details: string | null;
  userAgent: string;
}

export interface AuditLogPage {
  content: AuditLogEntry[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface AuditLogParams {
  eventType?: string;
  actorId?: string;
  result?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface TestCoverageMetrics {
  available: boolean;
  message?: string;
  reportDate?: string;
  lineCovered?: number;
  lineMissed?: number;
  lineTotal?: number;
  linePercent?: number;
  branchCovered?: number;
  branchMissed?: number;
  branchTotal?: number;
  branchPercent?: number;
  instructionCovered?: number;
  instructionMissed?: number;
  instructionTotal?: number;
  instructionPercent?: number;
  methodCovered?: number;
  methodMissed?: number;
  methodTotal?: number;
  methodPercent?: number;
  classCovered?: number;
  classMissed?: number;
  classTotal?: number;
  classPercent?: number;
  complexityCovered?: number;
  complexityMissed?: number;
  complexityTotal?: number;
  complexityPercent?: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/admin/monitoring';

export const monitoringApi = {
  /** Sante de l'infrastructure (PostgreSQL, Redis, Keycloak, metriques systeme) */
  getHealth: (): Promise<HealthResponse> =>
    apiClient.get(`${BASE}/health`),

  /** Metriques plateforme (utilisateurs, tokens, performance API, securite) */
  getKeycloakMetrics: (): Promise<KeycloakMetricsResponse> =>
    apiClient.get(`${BASE}/keycloak-metrics`),

  /** Logs d'audit securite avec pagination et filtres */
  getAuditLogs: (params: AuditLogParams = {}): Promise<AuditLogPage> =>
    apiClient.get(`${BASE}/audit-logs`, { params: params as Record<string, string | number> }),

  /** Couverture de tests JaCoCo */
  getTestCoverage: (): Promise<TestCoverageMetrics> =>
    apiClient.get(`${BASE}/test-coverage`),
};
