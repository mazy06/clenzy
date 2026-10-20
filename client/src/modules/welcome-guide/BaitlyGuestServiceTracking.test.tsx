import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BaitlyGuestServiceTracking from './BaitlyGuestServiceTracking';
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const service = { orderId: 8, title: 'Ménage du séjour', paymentStatus: 'PAID', state: 'REQUESTED', start: '2026-10-21T10:00:00', durationHours: 2, timezone: 'Europe/Paris' };
it('distinguishes payment from acceptance, then displays the real updated intervention', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [service] })
    .mockResolvedValueOnce({ ok: true, json: async () => [{ ...service, state: 'CONFIRMED', start: '2026-10-21T11:00:00' }] });
  vi.stubGlobal('fetch', fetcher);
  render(<BaitlyGuestServiceTracking token="stay-token" apiBase="" lang="fr" />);
  expect(await screen.findByText('Confirmation en attente')).toBeTruthy();
  expect(screen.getByText('Payé')).toBeTruthy(); expect(screen.queryByText('Service confirmé')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser le suivi' }));
  expect(await screen.findByText('Service confirmé')).toBeTruthy();
  expect(screen.getByText('mercredi 21 octobre 2026 · 11:00 – 13:00')).toBeTruthy();
  expect(screen.getByText('2 h · Europe/Paris')).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('does not show the previous stay while a different link is loading or fails', async () => {
  let resolve!: (value: unknown) => void;
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [service] })
    .mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  vi.stubGlobal('fetch', fetcher);
  const page = render(<BaitlyGuestServiceTracking token="first-stay" apiBase="" lang="fr" />);
  await screen.findByText(service.title);
  page.rerender(<BaitlyGuestServiceTracking token="second-stay" apiBase="" lang="fr" />);
  expect(screen.queryByText(service.title)).toBeNull();
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => resolve({ ok: false }));
  expect(await screen.findByRole('alert')).toHaveTextContent('momentanément indisponible');
  expect(screen.queryByText(service.title)).toBeNull();
});

it('refreshes an active visible service, skips hidden tabs and stops polling once completed', async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [service] })
    .mockResolvedValue({ ok: true, json: async () => [{ ...service, state: 'COMPLETED' }] });
  vi.stubGlobal('fetch', fetcher);
  render(<BaitlyGuestServiceTracking token="stay-token" apiBase="" lang="fr" />);
  await act(async () => {});
  expect(screen.getByText('Confirmation en attente')).toBeTruthy();
  visibility.mockReturnValue('hidden');
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue('visible');
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Service réalisé')).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('does not present fulfillment as successful when the payment is pending or unknown', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [
    { ...service, paymentStatus: 'PENDING', state: 'COMPLETED' },
    { ...service, orderId: 9, title: 'Autre service', paymentStatus: 'UNRECOGNIZED', state: 'COMPLETED' },
  ] }));
  render(<BaitlyGuestServiceTracking token="stay-token" apiBase="" lang="fr" />);
  await screen.findByText(service.title);
  expect(screen.queryByText('Service réalisé')).toBeNull();
  expect(screen.queryByText('Payé')).toBeNull();
  expect(screen.getByText('Paiement à vérifier')).toBeTruthy();
  expect(screen.queryByText('UNRECOGNIZED')).toBeNull();
  expect(screen.queryByText('Créneau prévu')).toBeNull();
});

it('prioritizes services to follow and keeps refunds and completed purchases in a collapsed history', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [
    service,
    { ...service, orderId: 9, title: 'Transfert remboursé', paymentStatus: 'REFUNDED', state: 'COMPLETED' },
    { ...service, orderId: 10, title: 'Parking terminé', state: 'COMPLETED', start: null },
    { ...service, orderId: 11, title: 'Service annulé', state: 'CANCELLED', start: null },
  ] }));
  render(<BaitlyGuestServiceTracking token="stay-token" apiBase="" lang="fr" />);
  await screen.findByText(service.title);
  const history = screen.getByText('Services passés').closest('details')!;
  expect(history).not.toHaveAttribute('open');
  expect(within(history).getByText('Parking terminé')).toBeTruthy();
  expect(within(history).getAllByText('Remboursé')).toHaveLength(1);
  expect(within(history).getByText('Créneau initial')).toBeTruthy();
  expect(within(history).getByText('Service annulé').closest('li')).toHaveTextContent('Payé');
  expect(within(history).queryByText(service.title)).toBeNull();
  expect(screen.getByText('Créneau demandé')).toBeTruthy();
});
it('reports an unavailable status without inventing a successful payment', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  render(<BaitlyGuestServiceTracking token="invalid" apiBase="" lang="fr" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('momentanément indisponible');
  expect(screen.queryByText('Payé')).toBeNull();
});
it('does not add an empty section when no service was ordered', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [] }); vi.stubGlobal('fetch', fetcher);
  render(<BaitlyGuestServiceTracking token="stay-token" apiBase="" lang="en" />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('region')).toBeNull();
});

it('tracks parking, breakfast and transfers without calling them cleaning missions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [
    { ...service, orderId: 1, title: 'Parking', start: null, state: 'TO_ORGANIZE' },
    { ...service, orderId: 2, title: 'Petit-déjeuner', state: 'COMPLETED' },
    { ...service, orderId: 3, title: 'Transfert gare', state: 'IN_PROGRESS' },
  ] }));
  render(<BaitlyGuestServiceTracking token="stay-token" apiBase="" lang="fr" />);
  expect(await screen.findByText('À organiser')).toBeTruthy();
  expect(screen.getByText('Service réalisé')).toBeTruthy();
  expect(screen.getByText('Prestation en cours')).toBeTruthy();
  expect(screen.queryByText(/Ménage/)).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});
