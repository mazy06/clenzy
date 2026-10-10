import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BaitlyProviderIdentity, BaitlyProviderOffers } from './BaitlyProviderProfile';
import ProviderCatalogDetailPage from '../provider-catalog/ProviderCatalogDetailPage';

const state = vi.hoisted(() => ({ own: false, replacement: undefined as undefined | { activeRequestId: number } }));
const offers = [{ id: 1, label: 'Ménage entre deux séjours', categoryCode: 'CLEANING', categoryLabelFr: 'Ménage', categoryLabelEn: 'Cleaning', active: true, amount: 35, currency: 'EUR', pricingModel: 'HOURLY' }];
vi.mock('../../hooks/useProviderCatalog', () => ({ useCatalogProvider: () => ({ data: {
  id: 7, displayName: 'Salma Chraibi', headline: 'Ménage entre deux séjours', categoryCodes: ['CLEANING'],
  offers, languages: ['fr'], coverageCities: ['Marrakech'], baseCity: 'Marrakech', own: state.own,
} }) }));
vi.mock('../../hooks/useQuoteReplacement', () => ({ useQuoteReplacement: () => ({ data: state.replacement }) }));
vi.mock('../../components/PageHeader', () => ({ default: ({ title, actions }: { title: string; actions: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock('../quotes/QuoteRequestDialog', () => ({ default: ({ open, initialPropertyId }: { open: boolean; initialPropertyId: string }) => open ? <div role="dialog">Logement {initialPropertyId}</div> : null }));
afterEach(() => { cleanup(); state.own = false; state.replacement = undefined; });
it('keeps prices, inactive services and generated sector art visible', () => {
  const { container } = render(<BaitlyProviderOffers offers={[...offers,{ ...offers[0], id: 2, active: false, label: 'Ancienne prestation' }] as never} />);
  expect(screen.getByText('Ménage entre deux séjours')).toBeInTheDocument();
  expect(screen.getByText('Prestation inactive')).toBeInTheDocument();
  expect(screen.getAllByText(/35.*€\/h/)).toHaveLength(2);
  expect(container.querySelector('img')?.src).toContain('/images/catalog/cleaning.webp');
});
it('falls back to sector art when the profile photo fails without inventing a rating', () => {
  const { container } = render(<BaitlyProviderIdentity name="Salma Chraibi" url="/missing-photo" categoryCodes={['CLEANING']} />);
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')?.src).toContain('/images/catalog/cleaning.webp');
  expect(screen.getByText('Pas encore noté')).toBeInTheDocument();
});
function mount(search = '?propertyId=12') {
  render(<MemoryRouter initialEntries={['/prestataires/7'+search]}><Routes><Route path="/prestataires/:id" element={<ProviderCatalogDetailPage />} /></Routes></MemoryRouter>);
}
it('opens the quote request with the property context from both catalogue actions', () => {
  mount();
  fireEvent.click(screen.getAllByRole('button', { name: 'Demander un devis' })[0]);
  expect(screen.getByRole('dialog')).toHaveTextContent('Logement 12');
});
it('does not offer a quote on the organization’s own profile', () => {
  state.own = true; mount();
  expect(screen.queryByRole('button', { name: 'Demander un devis' })).not.toBeInTheDocument();
});
it('keeps both quote buttons blocked when a replacement request already exists', () => {
  state.replacement = { activeRequestId: 99 }; mount('?replaceQuoteId=4');
  screen.getAllByRole('button', { name: 'Demander un devis' }).forEach(button => expect(button).toBeDisabled());
});
