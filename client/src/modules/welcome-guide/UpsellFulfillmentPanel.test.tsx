import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import UpsellFulfillmentPanel from './UpsellFulfillmentPanel';
import { upsellFulfillmentApi } from '../../services/api/upsellFulfillmentApi';
import type { UpsellOffer } from '../../services/api/upsellApi';

vi.mock('../../services/api/upsellFulfillmentApi', () => ({ upsellFulfillmentApi: { get: vi.fn(), configure: vi.fn(), providers: vi.fn() } }));
vi.mock('../../hooks/useMarketplaceProperties', () => ({ useMarketplaceProperties: () => ({ data: [{ id: 7, name: 'Villa Atlas', city: 'Marrakech' }] }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, organizationId: 1 } }) }));
vi.mock('../../components/ServiceItemSelect', () => ({ default: ({ onChange, labelAction }: { onChange: (v: { code: string }) => void; labelAction?: import('react').ReactNode }) => <div>{labelAction}<button onClick={() => onChange({ code: 'culinary-breakfast' })}>Relier le petit-déjeuner</button></div> }));
vi.mock('../quotes/QuoteRequestDialog', () => ({ default: (props: { initialTitle: string; initialServiceItemCode: string; initialPropertyId: string }) => <div role="dialog">{props.initialTitle} {props.initialServiceItemCode} {props.initialPropertyId}</div> }));
const provider = { id: 42, displayName: 'Amina Services', categoryCodes: ['CLEANING'], offers: [
  { id: 3, serviceItemCode: 'cleaning-mid-stay', label: 'Ménage en cours de séjour', active: true, pricingModel: 'ON_QUOTE', currency: 'EUR' },
], coverageCities: ['Marrakech'], own: false };
const configuration = { serviceItemCode: 'cleaning-mid-stay', overrideCode: null, preferredProviderId: null, preferredProvider: null, selectionMode: 'MANUAL' };
const offer = { id: 11, title: 'Ménage supplémentaire', propertyId: 7 } as UpsellOffer;
beforeEach(() => {
  vi.mocked(upsellFulfillmentApi.get).mockResolvedValue(configuration as never);
  vi.mocked(upsellFulfillmentApi.providers).mockResolvedValue({ page: { items: [provider], totalElements: 1, totalPages: 1, page: 0, size: 12 }, availability: {} } as never);
  vi.mocked(upsellFulfillmentApi.configure).mockResolvedValue({ ...configuration, preferredProviderId: 42, preferredProvider: provider } as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter><UpsellFulfillmentPanel offer={offer} /></MemoryRouter></QueryClientProvider>);
}
it('saves the manager preference on the backend and prepares a request with the service context', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Choisir', exact: true }));
  await waitFor(() => expect(upsellFulfillmentApi.configure).toHaveBeenCalledWith(11,null,42,7));
  expect(await screen.findByText('Prestataire préféré : Amina Services')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Préparer une demande' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Ménage supplémentaire cleaning-mid-stay 7');
});
it('passes slot, duration and availability filters without claiming unknown calendars are available', async () => {
  const { container } = mount();
  await screen.findByText('Amina Services');
  expect(screen.getByRole('combobox', { name: 'Lieu d’intervention' })).toHaveValue('Villa Atlas | Marrakech');
  expect(screen.getByLabelText('Disponibles sur ce créneau')).toBeDisabled();
  fireEvent.click(screen.getByText('Plus de critères'));
  fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2026-10-15T09:00' } });
  fireEvent.click(screen.getByLabelText('Disponibles sur ce créneau'));
  await waitFor(() => expect(upsellFulfillmentApi.providers).toHaveBeenLastCalledWith(11,expect.objectContaining({ propertyId: 7,start: '2026-10-15T09:00',durationMinutes: 60,availableOnly: true })));
});
it('keeps secondary criteria collapsed initially and marks active filters', async () => {
  const { container } = mount();
  await screen.findByText('Amina Services');
  const details = container.querySelector('details')!;
  expect(details).not.toHaveAttribute('open');
  fireEvent.click(screen.getByText('Plus de critères'));
  fireEvent.click(screen.getByLabelText('Profils vérifiés'));
  await waitFor(() => expect(upsellFulfillmentApi.providers).toHaveBeenLastCalledWith(11,expect.objectContaining({ verifiedOnly: true })));
  expect(screen.getByText('Filtres actifs')).toBeInTheDocument();
});
it('clears the preferred provider when linking a different service', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Relier le petit-déjeuner' }));
  await waitFor(() => expect(upsellFulfillmentApi.configure).toHaveBeenCalledWith(11,'culinary-breakfast',null,7));
});
it('resets an overridden service to the category through the field action', async () => {
  vi.mocked(upsellFulfillmentApi.get).mockResolvedValue({...configuration, overrideCode:'cleaning-windows'} as never);
  mount();
  fireEvent.click(await screen.findByRole('button', {name:'Réinitialiser'}));
  await waitFor(() => expect(upsellFulfillmentApi.configure).toHaveBeenCalledWith(11,null,null,7));
});
it('keeps errors visible and provides a retry instead of showing an empty catalogue', async () => {
  vi.mocked(upsellFulfillmentApi.providers).mockRejectedValue(new Error('offline'));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de rechercher les prestataires.');
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
});
it('shows a nearby service when exact matching fails and explicitly switches the linked service', async () => {
  vi.mocked(upsellFulfillmentApi.providers).mockImplementation(async (_id,filters) => filters.related
    ? { page: { items: [{ ...provider, offers: [
      { ...provider.offers[0], serviceItemCode: 'cleaning-turnover', label: 'Ménage entre deux séjours' },
      { ...provider.offers[0], id: 4, serviceItemCode: 'culinary-breakfast', label: 'Petit-déjeuner' },
    ] }], totalElements: 1 }, serviceCodes: ['cleaning-turnover'], availability: {} } as never
    : { page: { items: [], totalElements: 0 }, serviceCodes: ['cleaning-mid-stay'], availability: {} } as never);
  mount();
  const button = await screen.findByRole('button', { name: 'Choisir', exact: true });
  expect(screen.getByText('Autre prestation proposée')).toBeInTheDocument();
  expect(screen.getByText('Ménage entre deux séjours')).toBeInTheDocument();
  expect(screen.queryByText('Petit-déjeuner')).not.toBeInTheDocument();
  expect(upsellFulfillmentApi.configure).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(upsellFulfillmentApi.configure).toHaveBeenCalledWith(11,'cleaning-turnover',42,7));
});
it('shows a visible disabled choice when a provider has no selectable offer', async () => {
  vi.mocked(upsellFulfillmentApi.providers).mockResolvedValue({ page: { items: [{...provider,offers:[]}], totalElements:1 }, availability:{} } as never);
  mount();
  expect(await screen.findByRole('button', {name:'Choisir',exact:true})).toBeDisabled();
  expect(screen.getByText(/Les prestations de ce profil ne sont pas disponibles/)).toBeInTheDocument();
  expect(upsellFulfillmentApi.configure).not.toHaveBeenCalled();
});
