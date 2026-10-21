import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import messages from '../../../public/locales/fr.json';
import SentQuotesPage from './SentQuotesPage';
import type { BaitlyQuoteEntry } from '../../hooks/useBaitlyQuotes';

vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({
  currentLanguage: 'fr',
  t: (key: string) => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], messages) ?? key,
}) }));
vi.mock('../../components/first-use/ModuleFirstUsePage', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('../billing/components/useFinanceLayout', () => ({ useFinanceLayout: () => ({
  workspaceRef: null, listRef: null, height: 600, pageSize: 10,
}) }));
vi.mock('../../components/PageHeader', () => ({ default: ({ inlineControls }: { inlineControls: ReactNode }) => <header>{inlineControls}</header> }));
vi.mock('../../hooks/useUserPreference', async () => {
  const { useState } = await import('react');
  return { useUserPreference: () => useState(0) };
});
const { sentQuotes, decide } = vi.hoisted(() => ({ sentQuotes: vi.fn(), decide: vi.fn() }));
vi.mock('../../hooks/useBaitlyQuotes', () => ({
  useBaitlyQuotes: sentQuotes,
  useBaitlyQuoteDecision: () => ({ mutate: decide, isPending: false, isError: false }),
}));
vi.mock('./QuoteRecurrencePanel', () => ({ default: ({ quoteId }: { quoteId: number }) => <span>Récurrence demande {quoteId}</span> }));
vi.mock('./QuoteReviewPanel', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const quote: BaitlyQuoteEntry = {
  key: 'quote-22', quoteId: 22, requestId: null, serviceRequestId: 361, interventionId: 482,
  title: 'Ménage en cours de séjour', propertyName: 'Villa', providerName: 'Prestataire',
  status: 'APPROVED', stage: 'ACCEPTED', originalAmount: 5, agreedAmount: 8, currency: 'EUR',
  validUntil: null, createdAt: '2026-10-18T12:00:00', documentGenerationId: null,
  canDecide: false, canWithdraw: false, customerSide: true, expired: false, discussionUrl: '/contact?thread=group%3A12',
};
function mount(items: BaitlyQuoteEntry[] = [], isError = false) {
  sentQuotes.mockReturnValue({ data: { items, totalPages: 1, totalElements: items.length }, isLoading: false, isError });
  render(<MemoryRouter><Routes>
    <Route path="/" element={<SentQuotesPage />} />
    <Route path="/prestataires" element={<h1>Catalogue des prestataires</h1>} />
  </Routes></MemoryRouter>);
}

it('opens the provider catalogue from the empty requests workspace', () => {
  mount();
  expect(screen.getByRole('link', { name: 'Trouver un prestataire' })).toHaveAttribute('href', '/prestataires?view=catalog');
  fireEvent.click(screen.getByRole('link', { name: 'Trouver un prestataire' }));
  expect(screen.getByRole('heading', { name: 'Catalogue des prestataires' })).toBeInTheDocument();
});

it('shows intervention quotes, current agreement, and both business links without decision rights', () => {
  mount([quote]);
  fireEvent.click(screen.getByRole('button', { name: /Ménage en cours de séjour.*8/ }));
  expect(screen.getByRole('heading', { name: /Ménage en cours de séjour/ })).toBeInTheDocument();
  expect(screen.getAllByText('Approuvé')).toHaveLength(2);
  expect(screen.getAllByText(/8.*€/)).toHaveLength(2);
  expect(screen.getByRole('link', { name: 'Discussion' })).toHaveAttribute('href', '/contact?thread=group%3A12');
  expect(screen.getByRole('link', { name: 'Voir la prestation' })).toHaveAttribute('href', '/interventions/482');
  expect(screen.queryByRole('button', { name: 'Accepter' })).toBeNull();
  expect(screen.queryByText(/Récurrence demande/)).toBeNull();
});

it('routes a permitted intervention decision with its commercial quote identity', () => {
  const entry = { ...quote, status: 'RECEIVED', stage: 'DECIDE' as const, canDecide: true };
  mount([entry]);
  fireEvent.click(screen.getByRole('button', { name: /Ménage en cours de séjour.*8/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Accepter' }));
  expect(decide).toHaveBeenCalledWith({ entry, action: 'accept' });
});

it('keeps the marketplace request identity for recurrence and hides stale entries on access failure', () => {
  mount([{ ...quote, requestId: 4 }]);
  fireEvent.click(screen.getByRole('button', { name: /Ménage en cours de séjour.*8/ }));
  expect(screen.getByText('Récurrence demande 4')).toBeInTheDocument();
  cleanup();
  mount([quote], true);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Ménage en cours de séjour' })).toBeNull();
});

it('distinguishes an empty status filter and restores all requests', () => {
  mount();
  const filter = screen.getByRole('combobox', { name: 'Statut des devis' });
  expect(filter.closest('header')).not.toBeNull();
  fireEvent.keyDown(filter, { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: 'À décider' }));
  expect(sentQuotes).toHaveBeenLastCalledWith('DECIDE', 0, 10);
  expect(screen.getByText('Aucune demande dans cette vue')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Trouver un prestataire' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Voir toutes mes demandes' }));
  expect(sentQuotes).toHaveBeenLastCalledWith('ALL', 0, 10);
  expect(screen.getByRole('combobox', { name: 'Statut des devis' })).toHaveTextContent('Tous les devis');
});

it('selects a single dossier and keeps PDF references and links specific to that quote', () => {
  mount([quote, { ...quote, key: 'quote-26', quoteId: 26, title: 'Transfert gare', agreedAmount: 1,
    originalAmount: 1, discussionUrl: '/contact?thread=group%3A8', interventionId: 486 }]);
  expect(screen.queryByRole('article')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Ménage en cours de séjour.*8/ }));
  expect(screen.getByRole('link', { name: 'Discussion' })).toHaveAttribute('href', '/contact?thread=group%3A12');
  fireEvent.click(screen.getByRole('button', { name: /Transfert gare.*1/ }));
  expect(screen.getByRole('heading', { name: /Transfert gare/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Ménage en cours de séjour' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Discussion' })).toHaveAttribute('href', '/contact?thread=group%3A8');
  expect(screen.getByRole('link', { name: 'Voir la prestation' })).toHaveAttribute('href', '/interventions/486');
  expect(screen.getByText('Aucun PDF enregistré pour ce devis.')).toBeInTheDocument();
});
