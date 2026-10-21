import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { upsellApi, type UpsellOrder, type UpsellOffer } from '../../services/api/upsellApi';
import { baitlyCommerceApi } from '../../services/api/baitlyCommerceApi';
import BaitlyReservationPaidServices from './BaitlyReservationPaidServices';

const auth = vi.hoisted(() => ({ user: { id: 1, organizationId: 2 }, roles: ['HOST'] }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, hasAnyRole: (roles: string[]) => roles.some(role => auth.roles.includes(role)) }) }));
vi.mock('../../components/Money', () => ({ Money: ({ value, from }: { value: number; from: string }) => <span>{value} {from}</span> }));
vi.mock('../../services/api/upsellApi', () => ({ upsellApi: { listOffers: vi.fn(), listOrders: vi.fn(), execution: vi.fn(), schedule: vi.fn() } }));
vi.mock('../../services/api/baitlyCommerceApi', () => ({ baitlyCommerceApi: { operations: vi.fn(), recordOperation: vi.fn() } }));

const order = { id: 8, reservationId: 595, title: 'Petit-déjeuner du séjour', amount: 12, currency: 'EUR', status: 'PAID', fulfillmentServiceCode: 'culinary-breakfast', serviceRequestId: 363 } as UpsellOrder;
beforeEach(() => {
  vi.clearAllMocks();auth.user = { id: 1, organizationId: 2 };auth.roles = ['HOST'];
  vi.mocked(upsellApi.listOrders).mockResolvedValue([order]);
  vi.mocked(upsellApi.listOffers).mockResolvedValue([]);
  vi.mocked(upsellApi.execution).mockResolvedValue({ orderId: 8, title: order.title, paymentStatus: "PAID", state: "COMPLETED", serviceRequestId: 363, interventionId: 484, start: null, durationHours: null, timezone: "Europe/Paris", stayStart: null, stayEnd: null, canSchedule: false });
  vi.mocked(baitlyCommerceApi.operations).mockResolvedValue([]);
});
afterEach(cleanup);
function mount(content = <BaitlyReservationPaidServices reservationId={595} />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
  return render(content, { wrapper });
}

it('limite les ventes au séjour courant et conserve chaque devise sans addition au prix du séjour', async () => {
  vi.mocked(upsellApi.listOrders).mockResolvedValue([
    order,
    { ...order, id: 9, reservationId: 999, title: 'Service d’un autre séjour' },
    { ...order, id: 10, title: 'Parking remboursé', amount: 45, currency: 'MAD', status: 'REFUNDED', fulfillmentServiceCode: null, serviceRequestId: null },
  ]);
  mount();await screen.findByText(order.title);
  expect(screen.queryByText('Service d’un autre séjour')).toBeNull();
  expect(screen.getByText('Parking remboursé')).toBeVisible();
  expect(screen.getByText('12 EUR')).toBeVisible();expect(screen.getByText('45 MAD')).toBeVisible();
  expect(screen.getByRole('img', { name: 'Remboursé' })).toBeVisible();
  expect(baitlyCommerceApi.operations).not.toHaveBeenCalled();
});

it('affiche un état vide explicite sans créer de service', async () => {
  vi.mocked(upsellApi.listOrders).mockResolvedValue([]);
  mount();expect(await screen.findByText('Aucun service acheté associé à ce séjour.')).toBeVisible();
  expect(upsellApi.schedule).not.toHaveBeenCalled();expect(baitlyCommerceApi.recordOperation).not.toHaveBeenCalled();
});

it('réutilise la photo de l’offre et remplace une image indisponible par le visuel du service', async () => {
  vi.mocked(upsellApi.listOffers).mockResolvedValue([{ id: 4, title: order.title, imageUrl: '/media/breakfast.jpg' } as UpsellOffer]);
  const page = mount();await screen.findByText(order.title);
  const image = page.container.querySelector('.rsv-service__image')!;
  await waitFor(() => expect(image).toHaveAttribute('src', '/media/breakfast.jpg'));
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', '/images/catalog/breakfast.webp');
  expect(screen.queryByText('Vente #8')).toBeNull();
  expect(screen.queryByText(/Le service est payé par le voyageur/)).toBeNull();
});

it('garde le visuel du service si plusieurs offres portent le même nom', async () => {
  vi.mocked(upsellApi.listOffers).mockResolvedValue([
    { id: 4, title: order.title, imageUrl: '/media/a.jpg' } as UpsellOffer,
    { id: 5, title: order.title, imageUrl: '/media/b.jpg' } as UpsellOffer,
  ]);
  const page = mount();await screen.findByText(order.title);
  expect(page.container.querySelector('.rsv-service__image')).toHaveAttribute('src', '/images/catalog/breakfast.webp');
});

it('permet de réessayer après une lecture en erreur', async () => {
  vi.mocked(upsellApi.listOrders).mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValue([order]);
  mount();await screen.findByRole('alert');expect(screen.queryByText(order.title)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser les services' }));
  expect(await screen.findByText(order.title)).toBeVisible();
});

it('ne charge ni ne montre les ventes à un rôle non autorisé', async () => {
  auth.roles = ['HOUSEKEEPER'];mount();await act(async () => {});
  expect(upsellApi.listOrders).not.toHaveBeenCalled();expect(screen.queryByRole('region')).toBeNull();
});

it('ne conserve pas les ventes de l’ancienne organisation lors d’un changement de contexte', async () => {
  let resolve!: (rows: UpsellOrder[]) => void;
  vi.mocked(upsellApi.listOrders).mockResolvedValueOnce([order]).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const page = mount();await screen.findByText(order.title);
  auth.user = { id: 1, organizationId: 3 };
  page.rerender(<BaitlyReservationPaidServices reservationId={595} />);
  expect(screen.queryByText(order.title)).toBeNull();
  await act(async () => resolve([{ ...order, id: 20, title: 'Service du nouveau contexte' }]));
  expect(await screen.findByText('Service du nouveau contexte')).toBeVisible();
});

it('partage une seule lecture des ventes entre plusieurs fiches tout en filtrant chaque réservation', async () => {
  vi.mocked(upsellApi.listOrders).mockResolvedValue([order, { ...order, id: 9, reservationId: 596, title: 'Transfert du second séjour' }]);
  mount(<><BaitlyReservationPaidServices reservationId={595} /><BaitlyReservationPaidServices reservationId={596} /></>);
  await screen.findByText('Transfert du second séjour');
  const sections = screen.getAllByRole('region', { name: 'Services achetés' });
  expect(within(sections[0]).getByText(order.title)).toBeVisible();
  expect(within(sections[0]).queryByText('Transfert du second séjour')).toBeNull();
  expect(within(sections[1]).queryByText(order.title)).toBeNull();
  expect(upsellApi.listOrders).toHaveBeenCalledTimes(1);
});

it('charge l’historique manuel uniquement à son ouverture et garde l’hôte en lecture seule', async () => {
  vi.mocked(upsellApi.listOrders).mockResolvedValue([{ ...order, fulfillmentServiceCode: null, serviceRequestId: null }]);
  mount();await screen.findByText(order.title);
  expect(baitlyCommerceApi.operations).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Suivi de réalisation'));
  await waitFor(() => expect(baitlyCommerceApi.operations).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Aucune étape enregistrée.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
  expect(baitlyCommerceApi.recordOperation).not.toHaveBeenCalled();
  expect(upsellApi.execution).not.toHaveBeenCalled();
});

it.each(['cleaning-mid-stay', 'culinary-breakfast', 'driver-airport', 'driver-station'])('ne propose pas un suivi manuel concurrent avant la planification de %s', async fulfillmentServiceCode => {
  auth.roles = ['SUPER_ADMIN'];
  vi.mocked(upsellApi.listOrders).mockResolvedValue([{ ...order, fulfillmentServiceCode, serviceRequestId: null }]);
  vi.mocked(upsellApi.execution).mockResolvedValue({ orderId: 8, title: order.title, paymentStatus: 'PAID', state: 'TO_SCHEDULE',
    serviceRequestId: null, interventionId: null, start: null, durationHours: null, timezone: 'Europe/Paris',
    stayStart: '2026-10-20T15:00', stayEnd: '2026-10-24T11:00', canSchedule: true });
  mount();
  expect(await screen.findByRole('button', { name: 'Demander la planification' })).toBeVisible();
  expect(screen.queryByText('Suivi de réalisation')).toBeNull();
  expect(baitlyCommerceApi.operations).not.toHaveBeenCalled();
  expect(baitlyCommerceApi.recordOperation).not.toHaveBeenCalled();
});

it('masque immédiatement des ventes déjà chargées si le rôle perd son autorisation', async () => {
  const page = mount();await screen.findByText(order.title);
  auth.roles = [];
  page.rerender(<BaitlyReservationPaidServices reservationId={595} />);
  expect(screen.queryByRole('region')).toBeNull();expect(screen.queryByText(order.title)).toBeNull();
});

it('ouvre le suivi de la vente du séjour et retrouve sa demande et son intervention sans nouvel envoi', async () => {
  vi.mocked(upsellApi.execution).mockResolvedValue({ orderId: 8, title: order.title, paymentStatus: 'PAID', state: 'COMPLETED',
    serviceRequestId: 363, interventionId: 484, start: '2026-10-19T03:42:00', durationHours: 1, timezone: 'Europe/Paris',
    stayStart: null, stayEnd: null, canSchedule: false });
  mount();await screen.findByText(order.title);
  expect(await screen.findByText('Prestation réalisée')).toBeVisible();
  expect(upsellApi.execution).toHaveBeenCalledWith(8);
  expect(screen.queryByRole('link', { name: /Ouvrir la demande/ })).toBeNull();
  expect(screen.getByRole('link', { name: /Ouvrir l’intervention/ })).toHaveAttribute('href', '/interventions/484');
  const reads = vi.mocked(upsellApi.execution).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser les services' }));
  await waitFor(() => expect(vi.mocked(upsellApi.execution).mock.calls.length).toBeGreaterThan(reads));
  expect(upsellApi.schedule).not.toHaveBeenCalled();expect(baitlyCommerceApi.recordOperation).not.toHaveBeenCalled();
});

it('conserve une saisie manuelle lorsque le suivi est replié puis rouvert', async () => {
  auth.roles = ['SUPER_ADMIN'];
  vi.mocked(upsellApi.listOrders).mockResolvedValue([{ ...order, fulfillmentServiceCode: null, serviceRequestId: null }]);
  mount();await screen.findByText(order.title);
  const summary = screen.getByText('Suivi de réalisation');
  fireEvent.click(summary);
  fireEvent.change(await screen.findByLabelText('Référence justificative ou de suivi'), { target: { value: 'BROUILLON-TEST' } });
  fireEvent.change(screen.getByLabelText('Précisions'), { target: { value: 'Saisie conservée, sans validation' } });
  fireEvent.click(summary);
  await waitFor(() => expect(summary.closest('details')).not.toHaveAttribute('open'));
  fireEvent.click(summary);
  await waitFor(() => expect(summary.closest('details')).toHaveAttribute('open'));
  expect(screen.getByLabelText('Référence justificative ou de suivi')).toHaveValue('BROUILLON-TEST');
  expect(screen.getByLabelText('Précisions')).toHaveValue('Saisie conservée, sans validation');
  expect(baitlyCommerceApi.operations).toHaveBeenCalledTimes(1);expect(baitlyCommerceApi.recordOperation).not.toHaveBeenCalled();
});
