import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CancelBookingPage from './CancelBookingPage';

const fetchMock = vi.fn();
const response = (data: object) => ({ ok: true, json: async () => data });
const result = (refundStatus?: string) => ({ status: 'cancelled', refundAmount: 50, currency: 'EUR', refundStatus, refundedAmount: 0 });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
  fetchMock.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function cancel(data: object) {
  fetchMock.mockResolvedValueOnce(response({ policyType: 'FLEXIBLE', refundPercentage: 50, refundAmount: 50, currency: 'EUR', daysBeforeCheckIn: 10, explanation: 'Politique du logement' }))
    .mockResolvedValueOnce(response(data));
  render(<MemoryRouter initialEntries={['/booking/test-key/cancel']}><Routes><Route path="/booking/:apiKey/cancel" element={<CancelBookingPage />} /></Routes></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Code de confirmation'), { target: { value: 'ABC123' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'guest@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Voir le remboursement' }));
  fireEvent.click(await screen.findByRole('button', { name: "Confirmer l'annulation" }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/remboursement/i));
  return screen.getByRole('status');
}

describe('suivi du remboursement voyageur', () => {
  it('sépare annulation, demande et confirmation puis relit le statut sans réannuler', async () => {
    const status = await cancel(result('PENDING'));
    expect(status.textContent).toContain('Remboursement demandé');
    expect(status.textContent).toContain('50');
    expect(status.textContent).not.toContain('{amount}');
    expect(status.textContent).not.toContain('Remboursement confirmé');
    fetchMock.mockResolvedValueOnce(response({ ...result('CONFIRMED'), refundedAmount: 50 }));
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier le remboursement' }));
    await screen.findByText(/Remboursement confirmé/);
    const [url, options] = fetchMock.mock.calls[2];
    expect(url).toMatch(/ABC123\/cancellation-status$/);
    expect(options.method).toBe('POST');
    expect(options.headers['X-Booking-Key']).toBe('test-key');
    expect(JSON.parse(options.body)).toEqual({ email: 'guest@example.test' });
    expect(fetchMock.mock.calls.filter(([path]) => path.endsWith('/cancel'))).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Vérifier le remboursement' })).toBeNull();
  });
  it.each(['FAILED', 'RECONCILIATION_REQUIRED', 'UNKNOWN', undefined])('ne promet aucun succès pour %s', async (state) => {
    const status = await cancel(result(state));
    expect(status.textContent).not.toContain('Remboursement confirmé');
    expect(status.textContent).toMatch(/vérifi/i);
  });
  it('conserve l’annulation si le suivi rencontre une erreur réseau', async () => {
    await cancel(result('PENDING'));
    fetchMock.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier le remboursement' }));
    await screen.findByText(/Votre annulation reste enregistrée/);
    expect(screen.getByRole('status').textContent).toContain('Remboursement demandé');
    expect(screen.getByRole('button', { name: 'Vérifier le remboursement' }).hasAttribute('disabled')).toBe(false);
  });
  it('affiche explicitement l’absence de remboursement monétaire', async () => {
    const status = await cancel({ ...result('NONE'), refundAmount: 0 });
    expect(status.textContent).toMatch(/Aucun remboursement monétaire/);
    expect(screen.queryByRole('button', { name: 'Vérifier le remboursement' })).toBeNull();
  });
});
