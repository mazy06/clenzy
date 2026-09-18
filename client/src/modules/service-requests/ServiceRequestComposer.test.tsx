import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceRequestComposer from './ServiceRequestComposer';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../services/apiClient', () => ({ default: api }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { firstName: 'Alex', lastName: 'Host' } }) }));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ currentLanguage: 'fr', isEnglish: false, t: (key: string, args?: { count?: number; name?: string }) =>
    key + (args?.count != null ? ' ' + args.count : '') + (args?.name ? ' ' + args.name : '') }),
}));
vi.mock('../../hooks/invalidateMissionWorkflow', () => ({ invalidateMissionWorkflow: vi.fn() }));

const items = [
  { code: 'books', labelFr: 'Comptabilité', labelEn: 'Accounting', legacyType: 'OTHER', categoryCode: 'ACCOUNTING', propertyRequired: false, executionMode: 'REMOTE' },
  { code: 'marketing', labelFr: 'Rédaction annonce', labelEn: 'Listing', legacyType: 'OTHER', categoryCode: 'MARKETING', propertyRequired: false, executionMode: 'REMOTE' },
  { code: 'cleaning', labelFr: 'Ménage', labelEn: 'Cleaning', legacyType: 'CLEANING', categoryCode: 'CLEANING', propertyRequired: true },
];
beforeEach(() => {
  api.get.mockImplementation((path: string) => Promise.resolve(path === '/service-reference' ? items : []));
  api.post.mockImplementation((path: string, body: { selections: { serviceItemCode: string }[] }) =>
    Promise.resolve(path.endsWith('/estimate') ? body.selections.map(s => ({ serviceItemCode: s.serviceItemCode, source: 'ON_QUOTE', min: null, max: null, durationMinutes: null })) : [{ id: 1 }, { id: 2 }]));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function show() {
  const onSuccess = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ServiceRequestComposer onClose={vi.fn()} onSuccess={onSuccess}
    setLoading={vi.fn()} submitRef={{ current: null }} /></QueryClientProvider>);
  return { onSuccess };
}
async function choose(name: string) {
  fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(name) }));
}
it('creates separate canonical selections in one batch, without sending invented amounts', async () => {
  const { onSuccess } = show();
  await choose('Comptabilité');
  await choose('Rédaction annonce');
  await screen.findAllByText('requestComposer.onQuote');
  fireEvent.change(screen.getByLabelText('requestComposer.date *'), { target: { value: '2026-10-20T10:00' } });
  fireEvent.change(screen.getByLabelText('requestComposer.sharedNotes'), { target: { value: 'Accès par la cour' } });
  fireEvent.change(screen.getAllByLabelText('requestComposer.serviceNotes')[0], { target: { value: 'Bilan annuel' } });
  fireEvent.click(screen.getByRole('button', { name: 'requestComposer.create 2' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledWith('/service-requests/batch', {
    submissionId: expect.any(String), propertyId: null, desiredDate: '2026-10-20T10:00', priority: 'NORMAL', instructions: 'Accès par la cour',
    selections: [
      { serviceItemCode: 'books', instructions: 'Bilan annuel' },
      { serviceItemCode: 'marketing', instructions: '' },
    ],
  });
});
it('requires a property for on-site services and keeps service search accent-insensitive', async () => {
  show();
  fireEvent.change(await screen.findByLabelText('requestComposer.findService'), { target: { value: 'menage' } });
  await choose('Ménage');
  expect(screen.queryByRole('checkbox', { name: /Comptabilité/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'requestComposer.create 1' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
});
it('removes a selected service from the pending batch', async () => {
  show();
  await choose('Comptabilité');
  await choose('Rédaction annonce');
  fireEvent.click(screen.getByRole('button', { name: 'requestComposer.remove Comptabilité' }));
  expect(screen.getByRole('button', { name: 'requestComposer.create 1' })).toBeEnabled();
  expect(screen.getAllByLabelText('requestComposer.serviceNotes')).toHaveLength(1);
});
it('shows estimation failure without replacing missing tariffs with zero', async () => {
  api.post.mockRejectedValue(new Error('unavailable'));
  show(); await choose('Comptabilité');
  await screen.findByText('requestComposer.estimateError');
  expect(screen.queryByText('requestComposer.onQuote')).not.toBeInTheDocument();
  expect(screen.queryByText(/0,00/)).not.toBeInTheDocument();
});
it('reuses the submission identity after a lost response', async () => {
  let attempts = 0;
  api.post.mockImplementation((path: string, body) => {
    if (path.endsWith('/batch')) return ++attempts === 1 ? Promise.reject(new Error('network')) : Promise.resolve([{ id: 1 }]);
    return Promise.resolve(body.selections.map((s: { serviceItemCode: string }) => ({ serviceItemCode: s.serviceItemCode, source: 'ON_QUOTE' })));
  });
  const { onSuccess } = show(); await choose('Comptabilité');
  fireEvent.change(screen.getByLabelText('requestComposer.date *'), { target: { value: '2026-10-20T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'requestComposer.create 1' }));
  await screen.findByRole('button', { name: 'requestComposer.create 1' });
  fireEvent.click(screen.getByRole('button', { name: 'requestComposer.create 1' }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  const submissions = api.post.mock.calls.filter(c => c[0].endsWith('/batch')).map(c => c[1]);
  expect(submissions).toHaveLength(2);
  expect(submissions[1]).toEqual(submissions[0]);
});
it('excludes quotes from the partial total and prevents duplicate submission while saving', async () => {
  api.post.mockImplementation((path: string, body) => path.endsWith('/batch') ? new Promise(() => {}) : Promise.resolve(
    body.selections.map((s: { serviceItemCode: string }) => s.serviceItemCode === 'books'
      ? { serviceItemCode: s.serviceItemCode, source: 'PLATFORM_GUIDE', min: 50, max: 70, currency: 'EUR', durationMinutes: 90 }
      : { serviceItemCode: s.serviceItemCode, source: 'ON_QUOTE', min: null, max: null })));
  show(); await choose('Comptabilité'); await choose('Rédaction annonce');
  await screen.findByText('requestComposer.partialTotal');
  expect(screen.getByText('requestComposer.excludedQuotes 1')).toBeInTheDocument();
  expect(screen.getAllByLabelText('requestComposer.duration')[0]).toHaveValue(2);
  fireEvent.change(screen.getByLabelText('requestComposer.date *'), { target: { value: '2026-10-20T10:00' } });
  const button = screen.getByRole('button', { name: 'requestComposer.create 2' });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(api.post.mock.calls.filter(c => c[0].endsWith('/batch'))).toHaveLength(1));
  expect(screen.getByRole('button', { name: 'serviceRequests.creating' })).toBeDisabled();
});
