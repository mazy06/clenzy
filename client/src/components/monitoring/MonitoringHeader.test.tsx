import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MonitoringPage, { useMonitoringHeader } from '../../modules/admin/MonitoringPage';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'recipe', organizationId: 7 } }) }));
vi.mock('../../hooks/useScreenTabs', () => ({ useScreenTabs: () =>
  ['Tokens', 'Authentication', 'Audit', 'Health', 'Isolation'].map(label => ({ label, key: label })) }));
vi.mock('../tabKeyParam', () => ({ useTabKeyParam: () => React.useState(0) }));
vi.mock('../PageHeader', () => ({ default: ({ title, actions }: { title: string; actions: React.ReactNode }) =>
  <header><h1>{title}</h1>{actions}</header> }));
vi.mock('../PageTabs', () => ({ default: ({ options, onChange }: { options: { label: string }[]; onChange: (value: number) => void }) =>
  <nav>{options.map((tab, index) => <button key={tab.label} onClick={() => onChange(index)}>{tab.label}</button>)}</nav> }));
vi.mock('../TokenMonitoring', () => ({ default: function TokenFixture() {
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();
  React.useEffect(() => {
    setHeaderActions(<button>Token action</button>);
    setHeaderLastUpdate(new Date('2026-10-24T10:00:00Z'));
    return () => setHeaderActions(null);
  }, [setHeaderActions, setHeaderLastUpdate]);
  return <p>Token fixture</p>;
} }));
vi.mock('../KeycloakMetrics', () => ({ default: function AuthFixture() {
  const { setHeaderActions } = useMonitoringHeader();
  React.useEffect(() => {
    setHeaderActions(<button>Authentication action</button>);
    return () => setHeaderActions(null);
  }, [setHeaderActions]);
  return <p>Authentication fixture</p>;
} }));
vi.mock('../AuditLogging', () => ({ default: () => null }));
vi.mock('../HealthChecks', () => ({ default: () => null }));
vi.mock('../RlsAudit', () => ({ default: () => null }));

afterEach(cleanup);

it('keeps actions registered by the initial tab instead of clearing them after mount', async () => {
  render(<MonitoringPage />);
  expect(await screen.findByRole('button', { name: 'Token action' })).toBeInTheDocument();
  expect(document.querySelector('time')).toHaveAttribute('dateTime', '2026-10-24T10:00:00.000Z');
});

it('changes tab actions and clears the previous timestamp without a render loop', async () => {
  render(<MonitoringPage />);
  await screen.findByRole('button', { name: 'Token action' });
  fireEvent.click(screen.getByRole('button', { name: 'Authentication' }));
  expect(await screen.findByRole('button', { name: 'Authentication action' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Token action' })).toBeNull();
  expect(document.querySelector('time')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tokens' }));
  expect(await screen.findByRole('button', { name: 'Token action' })).toBeInTheDocument();
});
