import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProviderServiceRequests from './ProviderServiceRequests';
import AssignmentContactForm from './AssignmentContactForm';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
const route = vi.hoisted(() => ({ search: '' }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('../../services/apiClient', () => ({ default: api }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate, useSearchParams: () => [new URLSearchParams(route.search), vi.fn()] }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAdmin: () => false, isManager: () => false, isHost: () => false }) }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../components/ServiceReferenceLabels', () => ({ useServiceReferenceLabel: () => 'Ménage' }));
vi.mock('../../components/PageHeader', () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('../../components/PageTabs', () => ({ default: () => null }));

function item() {
  return { proposal: { id: 3, requestId: 1, organizationId: 2, cycle: 1, targetType: 'user', targetId: 9,
    origin: 'AUTOMATIC', status: 'PENDING', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600_000).toISOString() },
    title: 'Ménage de départ', serviceItemCode: 'cleaning-turnover', city: 'Tours', scheduledAt: '2026-10-20T10:00:00',
    durationHours: 2, terms: { amount: 80, currency: 'EUR', tariffId: 7 } };
}
function show(content = <ProviderServiceRequests><div>Existing requests views</div></ProviderServiceRequests>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}>{content}</QueryClientProvider>);
}
beforeEach(() => { route.search = 'scope=inbox'; api.get.mockResolvedValue([item()]); api.post.mockResolvedValue({ status: 'ACCEPTED', interventionId: 44 }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('accepts the explicit proposal and opens the single resulting intervention', async () => {
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'assignmentFlow.accept' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/service-assignments/requests/1/proposals/3/response', { accept: true, reason: '' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/interventions/44'));
});

it('does not offer acceptance after the announced deadline', async () => {
  const expired = item(); expired.proposal.expiresAt = '2020-01-01T00:00:00Z'; api.get.mockResolvedValue([expired]);
  show();
  expect(await screen.findByRole('button', { name: 'assignmentFlow.accept' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'assignmentFlow.decline' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
});

it('requires a quote when no canonical price can be applied', async () => {
  api.get.mockResolvedValue([{ ...item(), terms: null }]); show();
  expect(await screen.findByRole('button', { name: 'assignmentFlow.accept' })).toBeDisabled();
  expect(screen.getByLabelText('assignmentFlow.amount')).toBeRequired();
  fireEvent.change(screen.getByLabelText('assignmentFlow.amount'), { target: { value: '120' } });
  fireEvent.change(screen.getByLabelText('assignmentFlow.currency'), { target: { value: 'MAD' } });
  fireEvent.change(screen.getByLabelText('assignmentFlow.validUntil'), { target: { value: '2026-10-20' } });
  fireEvent.click(screen.getByRole('button', { name: 'assignmentFlow.sendQuote' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/service-assignments/requests/1/proposals/3/quote', { amount: 120, currency: 'MAD', validUntil: '2026-10-20', description: '' }));
});

it('shows a loading failure instead of an empty inbox', async () => {
  api.get.mockRejectedValue(new Error('unavailable')); show();
  expect(await screen.findByText('assignmentFlow.loadFailed')).toBeInTheDocument();
  expect(screen.queryByText('assignmentFlow.emptyInbox')).not.toBeInTheDocument();
});

it('opens public requests inside the existing service requests tab without loading the inbox', async () => {
  route.search = 'tab=service-requests&scope=public';
  api.get.mockResolvedValue({ items: [], nextCursor: null });
  show(<ProviderServiceRequests embedded><div>Existing requests views</div></ProviderServiceRequests>);
  expect(await screen.findByText('assignmentFlow.emptyPublic')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/service-assignments/public', { params: { cursor: undefined } });
  expect(api.get).not.toHaveBeenCalledWith('/service-assignments/inbox', expect.anything());
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
});

it('saves the canonical contact preferences used by account and onboarding', async () => {
  api.get.mockResolvedValue({ fromHour: 8, untilHour: 20, criticalOnCall: false });
  api.put.mockResolvedValue({ fromHour: 9, untilHour: 20, criticalOnCall: false });
  show(<AssignmentContactForm />);
  const from = await screen.findByLabelText('assignmentFlow.contacts.fromHour');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/inbox'));
  fireEvent.change(from, { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: 'assignmentFlow.policy.save' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/service-assignments/contact-preferences',
    { fromHour: 9, untilHour: 20, criticalOnCall: false }));
  expect(await screen.findByRole('status')).toHaveTextContent('assignmentFlow.policy.saved');
});

it('keeps the existing request views as the default without loading a replacement inbox', () => {
  route.search = 'tab=service-requests';
  show();
  expect(screen.getByText('Existing requests views')).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});
