import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HealthChecks from '../HealthChecks';
import KeycloakMetrics from '../KeycloakMetrics';
import AuditLogging from '../AuditLogging';
import RlsAudit from '../RlsAudit';
import TokenMonitoring from '../TokenMonitoring';
import { monitoringApi } from '../../services/api/monitoringApi';
import { rlsAuditApi } from '../../services/api/rlsAuditApi';
import type { HealthResponse } from '../../services/api/monitoringApi';

const mocks = vi.hoisted(() => ({
  identity: { id: 'recipe', organizationId: 7 },
  header: { setHeaderActions: vi.fn(), setHeaderLastUpdate: vi.fn() },
  search: { change: (_: string) => {} },
  tokens: {
    getBackendTokenStats: vi.fn(), getBackendTokenMetrics: vi.fn(), cleanupExpiredTokens: vi.fn(),
    getCurrentTokenInfo: vi.fn(),
  },
}));
vi.mock('../../modules/admin/MonitoringPage', () => ({ useMonitoringHeader: () => mocks.header }));
vi.mock('../ScreenChrome', () => ({ useScreenSearch: (_: string, change: (value: string) => void) => { mocks.search.change = change; } }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.identity }) }));
vi.mock('../../services/TokenService', () => ({ default: { getInstance: () => mocks.tokens } }));
vi.mock('../../services/api/monitoringApi', () => ({ monitoringApi: {
  getHealth: vi.fn(), getKeycloakMetrics: vi.fn(), getTestCoverage: vi.fn(), getAuditLogs: vi.fn(),
} }));
vi.mock('../../services/api/rlsAuditApi', () => ({ rlsAuditApi: { etat: vi.fn(), marquerTraite: vi.fn(), marquerTousTraites: vi.fn() } }));

const health: HealthResponse = {
  services: [
    { name: 'PostgreSQL', status: 'UP', critical: true, category: 'DATABASE', responseTimeMs: 8, details: 'Synthetic database check', lastCheck: '2026-10-24T10:00:00Z' },
    { name: 'Redis', status: 'DOWN', critical: true, category: 'CACHE', responseTimeMs: 500, details: 'Synthetic cache check', lastCheck: '2026-10-24T10:00:00Z' },
    { name: 'OAuth', status: 'UNKNOWN', critical: false, category: 'AUTHENTICATION', responseTimeMs: 0, details: '', lastCheck: '' },
  ],
  systemMetrics: { cpuUsage: 35, memoryUsage: 64, diskUsage: 81, heapUsedMb: 128, heapMaxMb: 256, uptimeSeconds: 9000 },
};
const accounts = {
  users: { total: 10, active: 8, inactive: 2, newThisWeek: 1 },
  sessions: { totalTokens: 24, validTokens: 18, revokedTokens: 6, cacheHits: 12 },
  performance: { avgResponseTimeMs: 42, totalRequests: 100, errorRate: 0, uptimePercent: 99.9 },
  security: { failedLogins: 2, permissionDenied: 1, suspiciousActivity: 0, lastIncident: null },
};

function mount(element: React.ReactNode, configure?: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  configure?.(client);
  return { ...render(<QueryClientProvider client={client}>{element}</QueryClientProvider>), client };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.id = 'recipe';
  mocks.identity.organizationId = 7;
  vi.mocked(monitoringApi.getHealth).mockResolvedValue(structuredClone(health));
  vi.mocked(monitoringApi.getKeycloakMetrics).mockResolvedValue(accounts);
  vi.mocked(monitoringApi.getTestCoverage).mockResolvedValue({ available: false });
  vi.mocked(monitoringApi.getAuditLogs).mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 15 });
  vi.mocked(rlsAuditApi.etat).mockResolvedValue({ auditActif: true, mesureExploitable: false,
    rlsDejaActive: false, cheminsOuverts: 0, enAttente: 0, sature: false, chemins: [] });
  mocks.tokens.getCurrentTokenInfo.mockReturnValue({ isAuthenticated: false });
  mocks.tokens.getBackendTokenStats.mockResolvedValue({ totalTokens: 6, activeTokens: 4, expiredTokens: 2, successRate: '98%' });
  mocks.tokens.getBackendTokenMetrics.mockResolvedValue({ refreshCount: 10, errorCount: 1, lastRefresh: '2026-10-24T10:00:00Z', averageRefreshTime: 32 });
});
afterEach(cleanup);

describe('Baitly monitoring states and actions', () => {
  it('orders failing services first and filters attention without losing diagnostics', async () => {
    const { container } = mount(<HealthChecks />);
    await screen.findByText('Redis');
    expect(container.querySelector('summary')).toHaveTextContent('Redis');
    fireEvent.click(screen.getByRole('button', { name: /^À examiner/ }));
    expect(screen.queryByText('PostgreSQL')).toBeNull();
    expect(screen.getByText('OAuth')).toBeInTheDocument();
    const summary = container.querySelector('summary')!;
    fireEvent.click(summary);
    expect(summary.parentElement).toHaveAttribute('open');
    expect(screen.getByText('Synthetic cache check')).toBeVisible();
  });

  it('distinguishes an unmeasured service from a healthy platform', async () => {
    vi.mocked(monitoringApi.getHealth).mockResolvedValue({ ...health, services: [health.services[2]] });
    mount(<HealthChecks />);
    await screen.findByText('OAuth');
    expect(screen.getAllByText('Non mesuré')).toHaveLength(2);
    expect(screen.queryByText('Opérationnel')).toBeNull();
  });

  it('retains known values on refresh failure but does not present them as a current success', async () => {
    vi.mocked(monitoringApi.getHealth).mockRejectedValue(new Error('synthetic-private-diagnostic'));
    mount(<HealthChecks />, client => client.setQueryData(['monitoring', 'health', 'recipe', 7], { ...health, services: [health.services[0]] }));
    await screen.findByText(/Les dernières valeurs connues sont conservées/);
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Non mesuré')).toBeInTheDocument();
    expect(screen.queryByText('synthetic-private-diagnostic')).toBeNull();
  });

  it('uses the header search to filter services', async () => {
    mount(<HealthChecks />);
    await screen.findByText('Redis');
    act(() => mocks.search.change('PostgreSQL'));
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.queryByText('Redis')).toBeNull();
  });

  it('does not display the previous account snapshot while another identity loads', async () => {
    let finish!: (value: HealthResponse) => void;
    vi.mocked(monitoringApi.getHealth).mockResolvedValueOnce({ ...health, services: [{ ...health.services[0], name: 'First account service' }] })
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { client, rerender } = mount(<HealthChecks />);
    await screen.findByText('First account service');
    mocks.identity.id = 'other-account';
    mocks.identity.organizationId = 8;
    rerender(<QueryClientProvider client={client}><HealthChecks /></QueryClientProvider>);
    expect(screen.queryByText('First account service')).toBeNull();
    await act(async () => finish({ ...health, services: [{ ...health.services[0], name: 'Second account service' }] }));
    expect(await screen.findByText('Second account service')).toBeInTheDocument();
  });

  it('does not erase authentication metrics when coverage is unavailable', async () => {
    vi.mocked(monitoringApi.getTestCoverage).mockRejectedValue(new Error('synthetic-private-coverage'));
    mount(<KeycloakMetrics />);
    await screen.findByText('Comptes utilisateurs');
    expect(screen.getByText('Aucun incident enregistré')).toBeInTheDocument();
    expect(await screen.findByText(/L’absence de rapport ne permet pas de conclure/)).toBeInTheDocument();
    expect(screen.queryByText('synthetic-private-coverage')).toBeNull();
  });

  it('keeps audit contact details collapsed until an explicit disclosure', async () => {
    vi.mocked(monitoringApi.getAuditLogs).mockResolvedValue({ content: [{ id: 1, timestamp: '2026-10-24T10:00:00Z',
      eventType: 'LOGIN_SUCCESS', action: 'Synthetic sign-in', actorId: 'recipe', actorEmail: 'recipe@example.invalid',
      actorIp: '192.0.2.1', result: 'SUCCESS', details: 'Synthetic audit detail', userAgent: '' }],
      totalElements: 1, totalPages: 1, number: 0, size: 15 });
    const { container } = mount(<AuditLogging />);
    await screen.findByText('Synthetic sign-in');
    expect(screen.getByText('recipe@example.invalid')).not.toBeVisible();
    fireEvent.click(container.querySelector('summary')!);
    expect(screen.getByText('recipe@example.invalid')).toBeVisible();
  });

  it('resets audit pagination when the actor search changes', async () => {
    vi.mocked(monitoringApi.getAuditLogs).mockResolvedValue({ content: [], totalElements: 45, totalPages: 3, number: 0, size: 15 });
    mount(<AuditLogging />);
    await screen.findByRole('link', { name: /Suivant/ });
    fireEvent.click(screen.getByRole('link', { name: /Suivant/ }));
    await waitFor(() => expect(monitoringApi.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
    act(() => mocks.search.change('actor-recipe'));
    await waitFor(() => expect(monitoringApi.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, actorId: 'actor-recipe' })));
  });

  it('does not treat an unmeasurable empty RLS inventory as ready', async () => {
    mount(<RlsAudit />);
    await screen.findByText('Inventaire à confirmer');
    expect(screen.queryByText('Inventaire mesuré')).toBeNull();
    expect(rlsAuditApi.marquerTousTraites).not.toHaveBeenCalled();
    expect(rlsAuditApi.marquerTraite).not.toHaveBeenCalled();
  });

  it('offers RLS filters without resolving any finding', async () => {
    vi.mocked(rlsAuditApi.etat).mockResolvedValue({ auditActif: true, mesureExploitable: true, rlsDejaActive: false,
      cheminsOuverts: 1, enAttente: 0, sature: false, chemins: [{ id: 1, origin: 'SyntheticJob.run', tableName: 'recipe_table',
        sqlExcerpt: 'SELECT synthetic_fixture', firstSeenAt: '2026-10-24T09:00:00Z', lastSeenAt: '2026-10-24T10:00:00Z', occurrences: 2, resolvedAt: null }] });
    mount(<RlsAudit />);
    await screen.findByText('SyntheticJob.run');
    act(() => mocks.search.change('another-table'));
    expect(screen.getByText('Aucun chemin dans cette vue')).toBeInTheDocument();
    expect(rlsAuditApi.marquerTousTraites).not.toHaveBeenCalled();
  });

  it('shows JWT counts without copying or exposing the bearer token', async () => {
    mocks.tokens.getCurrentTokenInfo.mockReturnValue({ isAuthenticated: true, username: 'Recipe account', userId: 'recipe-id',
      email: 'recipe@example.invalid', roles: ['SUPER_ADMIN'], expiresAt: '2026-10-24T10:10:00Z', timeUntilExpiry: 600 });
    mount(<TokenMonitoring />);
    await screen.findByText(/10\s*min\s*0\s*s/);
    expect(await screen.findByRole('img', { name: '4 tokens actifs et 2 expirés' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copier.*identifiant/ })).toBeInTheDocument();
    expect(mocks.tokens.cleanupExpiredTokens).not.toHaveBeenCalled();
  });
});
