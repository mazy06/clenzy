import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import messages from '../../../public/locales/fr.json';
import ReceivedQuotesPage from './ReceivedQuotesPage';

const { received, mutate } = vi.hoisted(() => ({ received: vi.fn(), mutate: vi.fn() }));
vi.mock('../../hooks/useQuoteRequests', () => ({ useReceivedQuotes: received,
  useQuoteTransition: () => ({ mutate, isPending: false, isError: false }),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, organizationId: 2 } }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({}) }));
vi.mock('../../hooks/useUserPreference', async () => {
  const { useState } = await import('react');
  return { useUserPreference: (_key: string, value: number) => useState(value) };
});
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ currentLanguage: 'fr',
  t: (key: string) => key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], messages) ?? key,
}) }));
vi.mock('../../components/PageHeader', () => ({ default: ({ inlineControls }: { inlineControls: ReactNode }) => <header>{inlineControls}</header> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('uses the same header selector with provider statuses and preserves the API filters', () => {
  received.mockReturnValue({ data: { items: [] }, isLoading: false, isError: false });
  render(<MemoryRouter><ReceivedQuotesPage /></MemoryRouter>);
  const filter = screen.getByRole('combobox', { name: 'Statut des demandes' });
  expect(filter.closest('header')).not.toBeNull();
  expect(filter).toHaveTextContent('À chiffrer');
  expect(received).toHaveBeenLastCalledWith(['SENT'], 0);
  fireEvent.keyDown(filter, { key: 'Enter' });
  expect(screen.queryByRole('option', { name: 'Écartés et expirés' })).toBeNull();
  fireEvent.click(screen.getByRole('option', { name: 'En attente du client' }));
  expect(received).toHaveBeenLastCalledWith(['QUOTED'], 0);
  expect(screen.getByRole('combobox')).toHaveTextContent('En attente du client');
  expect(mutate).not.toHaveBeenCalled();
});

it('keeps the access refusal explicit for accounts without a provider profile', () => {
  received.mockReturnValue({ isLoading: false, isError: true, error: { status: 403 } });
  render(<MemoryRouter><ReceivedQuotesPage /></MemoryRouter>);
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.getByText(messages.marketplaceQuotes.noProfile)).toBeInTheDocument();
});
