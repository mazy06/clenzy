import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ProviderRetentionPanel from './ProviderRetentionPanel';
import apiClient from '../../services/apiClient';

vi.mock('../../services/apiClient', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, organizationId: 7 } }) }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'fr' }) }));
let client: QueryClient;
const empty = { reason: null, reviewAt: null, actor: null, reviewOverdue: false };
const held = { reason: 'Litige D-123', reviewAt: '2026-09-01T10:00:00', actor: 'manager', reviewOverdue: true };
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(apiClient.get).mockResolvedValue(empty);
});
afterEach(() => { cleanup(); client.clear(); });
const mount = () => render(<QueryClientProvider client={client}><ProviderRetentionPanel providerId={12} /></QueryClientProvider>);

it('keeps an overdue dispute suspended until an explicit action', async () => {
  vi.mocked(apiClient.get).mockResolvedValue(held);
  mount();
  await screen.findByText('Litige D-123');
  expect(screen.getByRole('status')).toHaveTextContent('marketplaceRetention.overdue');
  expect(apiClient.delete).not.toHaveBeenCalled();
});

it('requires the dispute reference and review date and prevents duplicate writes', async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(apiClient.put).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'marketplaceRetention.hold' }));
  const save = screen.getByRole('button', { name: 'marketplaceRetention.save' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('marketplaceRetention.reason'), { target: { value: ' Litige D-123 ' } });
  fireEvent.change(screen.getByLabelText('marketplaceRetention.reviewAt'), { target: { value: '2026-12-01T10:00' } });
  fireEvent.click(save); fireEvent.click(save);
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledExactlyOnceWith('/admin/marketplace/providers/12/retention-hold', { reason: 'Litige D-123', reviewAt: '2026-12-01T10:00' }));
  await act(async () => { finish(held); });
});

it('preserves the entered reason when saving fails', async () => {
  vi.mocked(apiClient.put).mockRejectedValue(new Error('Forbidden'));
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'marketplaceRetention.hold' }));
  fireEvent.change(screen.getByLabelText('marketplaceRetention.reason'), { target: { value: 'Litige D-123' } });
  fireEvent.change(screen.getByLabelText('marketplaceRetention.reviewAt'), { target: { value: '2026-12-01T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'marketplaceRetention.save' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('marketplaceRetention.reason')).toHaveValue('Litige D-123');
});

it('hides sensitive dispute details after access is revoked', async () => {
  vi.mocked(apiClient.get).mockResolvedValue(held); mount(); await screen.findByText('Litige D-123');
  vi.mocked(apiClient.get).mockRejectedValue(new Error('Forbidden'));
  await act(() => client.invalidateQueries({ queryKey: ['marketplace-retention'] }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Litige D-123')).toBeNull();
});
