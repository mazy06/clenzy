import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BaitlyPaidServiceExecution from './BaitlyPaidServiceExecution';
import { upsellApi, type UpsellOrder, type PaidServiceExecution } from '../../services/api/upsellApi';

vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../services/api/upsellApi', () => ({ upsellApi: { execution: vi.fn(), schedule: vi.fn() } }));
const order = { id: 8, title: 'Ménage du séjour', status: 'PAID', fulfillmentServiceCode: 'cleaning-mid-stay' } as UpsellOrder;
const view: PaidServiceExecution = { orderId: 8, title: order.title, paymentStatus: 'PAID', state: 'TO_SCHEDULE', serviceRequestId: null,
  interventionId: null, start: null, durationHours: null, timezone: 'Europe/Paris',
  stayStart: '2026-10-20T15:00', stayEnd: '2026-10-24T11:00', canSchedule: true };
beforeEach(() => { vi.mocked(upsellApi.execution).mockResolvedValue(view); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
function mount(value = order) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><BaitlyPaidServiceExecution order={value} /></MemoryRouter></QueryClientProvider>);
}
async function openForm() {
  fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.title' }));
  await screen.findByLabelText('paidServiceExecution.start');
  fireEvent.change(screen.getByLabelText('paidServiceExecution.start'), { target: { value: '2026-10-21T10:00' } });
  fireEvent.change(screen.getByLabelText('paidServiceExecution.instructions'), { target: { value: 'Changer le linge' } });
}

it('does not fetch or create anything until the user opens and submits the form', async () => {
  mount(); expect(upsellApi.execution).not.toHaveBeenCalled(); expect(upsellApi.schedule).not.toHaveBeenCalled();
  await openForm(); expect(upsellApi.schedule).not.toHaveBeenCalled();
  let resolve!: (value: typeof view) => void;
  vi.mocked(upsellApi.schedule).mockImplementation(() => new Promise(done => { resolve = done; }));
  const form = screen.getByRole('button', { name: 'paidServiceExecution.submit' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(upsellApi.schedule).toHaveBeenCalledTimes(1);
  expect(upsellApi.schedule).toHaveBeenCalledWith(8, { start: '2026-10-21T10:00', durationHours: 2, instructions: 'Changer le linge' });
  await act(async () => resolve({ ...view, state: 'REQUESTED', serviceRequestId: 90, canSchedule: false }));
  expect(await screen.findByRole('link', { name: /paidServiceExecution.openRequest/ })).toHaveAttribute('href', '/service-requests/90');
  expect(screen.queryByRole('button', { name: 'paidServiceExecution.submit' })).toBeNull();
});

it('keeps the entered information after a rejected request', async () => {
  vi.mocked(upsellApi.schedule).mockRejectedValue(new Error('Créneau hors séjour'));
  mount(); await openForm(); fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.submit' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Créneau hors séjour');
  expect(screen.getByLabelText('paidServiceExecution.start')).toHaveValue('2026-10-21T10:00');
  expect(screen.getByLabelText('paidServiceExecution.instructions')).toHaveValue('Changer le linge');
  await waitFor(() => expect(screen.getByRole('button', { name: 'paidServiceExecution.submit' })).not.toBeDisabled());
});

it('does not treat an unrelated or historic service as a cleaning mission', () => {
  mount({ ...order, fulfillmentServiceCode: null });
  expect(screen.queryByRole('button')).toBeNull(); expect(upsellApi.execution).not.toHaveBeenCalled();
});

it('never presents a pending payment as a paid service ready to schedule', async () => {
  vi.mocked(upsellApi.execution).mockResolvedValue({ ...view, paymentStatus: 'PENDING', state: 'PENDING', canSchedule: false });
  mount(); fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.title' }));
  expect(await screen.findByText('paidServiceExecution.paymentUnavailable')).toBeTruthy();
  expect(screen.queryByText('paidServiceExecution.paymentSeparation')).toBeNull();
  expect(screen.queryByRole('button', { name: 'paidServiceExecution.submit' })).toBeNull();
});

it.each(['culinary-breakfast', 'driver-airport', 'driver-station'])('plans %s with the existing request workflow', async code => {
  mount({ ...order, fulfillmentServiceCode: code });
  fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.title' }));
  fireEvent.change(await screen.findByLabelText('paidServiceExecution.start'), { target: { value: '2026-10-21T10:00' } });
  const instructions = code.startsWith('driver-') ? 'paidServiceExecution.transferInstructions' : 'paidServiceExecution.instructions';
  fireEvent.change(screen.getByLabelText(instructions), { target: { value: 'TEST : prise en charge CDG, destination logement' } });
  vi.mocked(upsellApi.schedule).mockResolvedValue({ ...view, state: 'REQUESTED', serviceRequestId: 90, canSchedule: false });
  fireEvent.submit(screen.getByRole('button', { name: 'paidServiceExecution.submit' }).closest('form')!);
  expect(await screen.findByRole('link', { name: /paidServiceExecution.openRequest/ })).toHaveAttribute('href', '/service-requests/90');
  expect(upsellApi.schedule).toHaveBeenCalledTimes(1);
});

it('uses the transfer window and requires pickup information before submitting', async () => {
  vi.mocked(upsellApi.execution).mockResolvedValue({ ...view, scheduleStart: '2026-10-20T00:00', scheduleEnd: '2026-10-25T00:00' });
  mount({ ...order, fulfillmentServiceCode: 'driver-airport' });
  fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.title' }));
  const start = await screen.findByLabelText('paidServiceExecution.start');
  expect(start).toHaveAttribute('min', '2026-10-20T00:00');
  expect(start).toHaveAttribute('max', '2026-10-25T00:00');
  fireEvent.change(start, { target: { value: '2026-10-20T09:00' } });
  expect(screen.getByLabelText('paidServiceExecution.transferInstructions')).toBeRequired();
  fireEvent.submit(screen.getByRole('button', { name: 'paidServiceExecution.submit' }).closest('form')!);
  expect(upsellApi.schedule).not.toHaveBeenCalled();
});

it('refreshes the server status and keeps the links attached to the same paid service', async () => {
  vi.mocked(upsellApi.execution).mockResolvedValueOnce({ ...view, state: 'CONFIRMED', serviceRequestId: 90, interventionId: 42, canSchedule: false })
    .mockResolvedValue({ ...view, state: 'COMPLETED', serviceRequestId: 90, interventionId: 42, canSchedule: false });
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.title' }));
  await screen.findByText('paidServiceExecution.states.CONFIRMED');
  fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.refresh' }));
  await screen.findByText('paidServiceExecution.states.COMPLETED');
  expect(screen.getByRole('link', { name: /paidServiceExecution.openRequest/ })).toHaveAttribute('href', '/service-requests/90');
  expect(screen.getByRole('link', { name: /paidServiceExecution.openIntervention/ })).toHaveAttribute('href', '/interventions/42');
  expect(screen.queryByRole('button', { name: 'paidServiceExecution.submit' })).toBeNull();
  expect(upsellApi.schedule).not.toHaveBeenCalled();
});

it('hides the stale scheduling form after a refresh failure and allows retry', async () => {
  vi.mocked(upsellApi.execution).mockResolvedValueOnce(view).mockRejectedValue(new Error('HTTP 503'));
  mount(); await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.refresh' }));
  await screen.findByText('paidServiceExecution.loadError');
  expect(screen.queryByRole('button', { name: 'paidServiceExecution.submit' })).toBeNull();
  vi.mocked(upsellApi.execution).mockResolvedValue(view);
  fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.retry' }));
  expect(await screen.findByLabelText('paidServiceExecution.instructions')).toHaveValue('Changer le linge');
  expect(upsellApi.schedule).not.toHaveBeenCalled();
});

it('polls only while the tracking panel is open and the service is active', async () => {
  vi.mocked(upsellApi.execution).mockResolvedValueOnce({ ...view, state: 'IN_PROGRESS', canSchedule: false })
    .mockResolvedValue({ ...view, state: 'COMPLETED', canSchedule: false });
  mount();
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'paidServiceExecution.title' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  expect(screen.getByText('paidServiceExecution.states.IN_PROGRESS')).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(30_010); });
  expect(screen.getByText('paidServiceExecution.states.COMPLETED')).toBeTruthy();
  expect(upsellApi.execution).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
  expect(upsellApi.execution).toHaveBeenCalledTimes(2);
  expect(upsellApi.schedule).not.toHaveBeenCalled();
});
