// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import QuoteRecurrencePanel from './QuoteRecurrencePanel';
import { quoteRequestsApi } from '../../services/api/quoteRequestsApi';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, organizationId: 7 }, loading: false }) }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('../../services/api/quoteRequestsApi', () => ({ quoteRequestsApi: { recurrence: vi.fn(), configureRecurrence: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const plan = { version: 3, enabled: true, firstDate: '2026-10-01', nextDate: '2027-10-01',
  intervalUnit: 'MONTHS' as const, intervalCount: 12, leadDays: 14, lastRequestId: 42 };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><QuoteRecurrencePanel quoteId={9} /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Planifier les prochaines demandes' }));
}
it('suspends the existing version without changing completed requests', async () => {
  vi.mocked(quoteRequestsApi.recurrence).mockResolvedValue(plan);
  vi.mocked(quoteRequestsApi.configureRecurrence).mockImplementation(async (_id, command) => ({ ...plan, ...command, version: 4 }));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Suspendre les prochaines demandes' }));
  await waitFor(() => expect(quoteRequestsApi.configureRecurrence).toHaveBeenCalledWith(9, expect.objectContaining({ version: 3, enabled: false })));
});
it('keeps the saved schedule and reports a failed mutation', async () => {
  vi.mocked(quoteRequestsApi.recurrence).mockResolvedValue(plan);
  vi.mocked(quoteRequestsApi.configureRecurrence).mockRejectedValue(new Error('conflict'));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Suspendre les prochaines demandes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible');
  expect(screen.getByRole('status')).toHaveTextContent('Échéancier actif');
});
it('does not offer mutations when access cannot be loaded', async () => {
  vi.mocked(quoteRequestsApi.recurrence).mockRejectedValue(new Error('forbidden'));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Échéancier indisponible');
  expect(screen.queryByRole('button', { name: 'Activer cet échéancier' })).toBeNull();
});
