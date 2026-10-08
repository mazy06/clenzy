import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BaitlyBookingReturnPage from './BaitlyBookingReturnPage';

const fetchMock = vi.fn();
let queryClient: QueryClient;
const booking = { reservationCode: 'RES-TEST', status: 'confirmed', paymentStatus: 'PAID', propertyName: 'Maison du test', propertyCity: 'Tours', checkIn: '2026-11-23', checkOut: '2026-11-25', total: 220, currency: 'EUR', guests: 2 };
const response = (data = booking) => ({ ok: true, json: async () => data });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
  fetchMock.mockReset();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(() => { cleanup(); queryClient.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function open(query = '?reservation=RES-TEST&flow=return') {
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[`/booking/test-key/confirmation${query}`]}><Routes><Route path="/booking/:apiKey/confirmation" element={<BaitlyBookingReturnPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

describe('retour public après paiement Baitly', () => {
  it.each(['return', 'cancel'])('reste neutre sans moteur de réservation, même avec flow=%s', async (flow) => {
    render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[
      `/booking/payment-return?flow=${flow}&reservation=DIR-FORGED`,
    ]}><Routes><Route path="/booking/payment-return" element={<BaitlyBookingReturnPage generic />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(screen.getByRole('heading', { name: 'Retour du paiement' })).toBeTruthy();
    expect(screen.getByText(/ne confirme ni le paiement ni l’annulation/)).toBeTruthy();
    expect(screen.queryByText('Votre séjour est confirmé')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('relit le statut serveur et affiche le séjour confirmé sans lien vers le PMS', async () => {
    fetchMock.mockResolvedValue(response());
    open();
    await screen.findByRole('heading', { name: 'Votre séjour est confirmé' });
    expect(screen.getByText('Maison du test · Tours')).toBeTruthy();
    expect(screen.getByText(/220/).textContent).toContain('€');
    expect(fetchMock.mock.calls[0][0]).toMatch(/widget\/booking\/RES-TEST$/);
    expect(fetchMock.mock.calls[0][1].headers['X-Booking-Key']).toBe('test-key');
    expect(screen.getByRole('link', { name: "Retour à l'accueil" }).getAttribute('href')).toBe('/booking/test-key');
    expect(screen.queryByRole('button', { name: 'Vérifier le statut' })).toBeNull();
  });

  it('ne déduit jamais un paiement de flow=return, puis actualise depuis le serveur', async () => {
    fetchMock.mockResolvedValueOnce(response({ ...booking, status: 'pending', paymentStatus: 'PENDING' })).mockResolvedValueOnce(response());
    open();
    await screen.findByRole('heading', { name: 'Nous vérifions votre réservation' });
    expect(screen.queryByText('Votre séjour est confirmé')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier le statut' }));
    await screen.findByRole('heading', { name: 'Votre séjour est confirmé' });
    expect(fetchMock.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
  });

  it('distingue retour interrompu et annulation de réservation', async () => {
    fetchMock.mockResolvedValue(response({ ...booking, status: 'pending', paymentStatus: 'PENDING' }));
    open('?reservation=RES-TEST&flow=cancel');
    await screen.findByRole('heading', { name: 'Paiement non terminé' });
    expect(screen.queryByText('Réservation annulée')).toBeNull();
    expect(screen.getByText(/n’annule pas la réservation/)).toBeTruthy();
  });

  it('un paiement confirmé prévaut sur le paramètre cancel', async () => {
    fetchMock.mockResolvedValue(response());
    open('?reservation=RES-TEST&flow=cancel');
    await screen.findByRole('heading', { name: 'Votre séjour est confirmé' });
  });

  it.each(['REFUNDED', 'PARTIALLY_REFUNDED', 'PAID'])('un séjour annulé %s ne redevient jamais confirmé', async (paymentStatus) => {
    fetchMock.mockResolvedValue(response({ ...booking, status: 'cancelled', paymentStatus }));
    open();
    await screen.findByRole('heading', { name: 'Réservation annulée' });
    expect(screen.getByRole('link', { name: 'Vérifier le remboursement' })).toBeTruthy();
    expect(screen.queryByText('Votre séjour est confirmé')).toBeNull();
  });

  it('conserve les informations connues après un échec du suivi', async () => {
    fetchMock.mockResolvedValueOnce(response({ ...booking, status: 'pending', paymentStatus: 'PENDING' })).mockRejectedValueOnce(new Error('network'));
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Vérifier le statut' }));
    await screen.findByText(/Les informations précédentes sont conservées/);
    expect(screen.getByText('RES-TEST')).toBeTruthy();
  });

  it('ne lance aucune requête sans référence', async () => {
    open('');
    await screen.findByText(/Nous ne retrouvons pas cette réservation/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('affiche une erreur utile si la réservation n’existe pas', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    open();
    await screen.findByText(/Nous ne retrouvons pas cette réservation/);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
