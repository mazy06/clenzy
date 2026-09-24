import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ServicesCatalog from './ServicesCatalog';
import { MARKETPLACE_EXPERIENCES } from './marketplaceData';
import type { UpsellOffer } from '../../../services/api/upsellApi';

vi.mock('../../../hooks/useUserPreference', async () => {
  const { useState } = await import('react');
  return { useUserPreference: (_key: string, initial: unknown) => useState(initial) };
});
vi.mock('../../../components/Money', () => ({ Money: ({ value }: { value: number }) => <span>{value} €</span> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function catalog(props: Partial<React.ComponentProps<typeof ServicesCatalog>> = {}) {
  return <ServicesCatalog offers={[]} typeLabel={type => type} onAdd={vi.fn().mockResolvedValue(undefined)}
    onOpenInternal={vi.fn()} renderRowMenu={() => null} {...props} />;
}

it('keeps the source and prices when switching from cards to list', () => {
  render(catalog());
  fireEvent.click(screen.getByRole('button', { name: 'GetYourGuide 2' }));
  fireEvent.click(screen.getByRole('button', { name: 'Liste', exact: true }));
  expect(screen.getByRole('button', { name: 'GetYourGuide 2' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('39 €')).toBeInTheDocument();
  expect(screen.getByText('120 €')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Dégustation de spécialités locales' })).not.toBeInTheDocument();
});

it('adds a partner without opening its detail and allows retry after failure', async () => {
  const experience = MARKETPLACE_EXPERIENCES[0];
  const onAdd = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  render(catalog({ onAdd }));
  const add = screen.getByRole('button', { name: 'Ajouter ' + experience.title });
  fireEvent.click(add);
  await waitFor(() => expect(add).toBeEnabled());
  expect(onAdd).toHaveBeenCalledTimes(1);
  fireEvent.click(add);
  await waitFor(() => expect(screen.getByRole('button', { name: experience.title + ' ajouté' })).toBeDisabled());
  expect(onAdd).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('group', { name: 'Affichage du catalogue' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retour au catalogue' })).not.toBeInTheDocument();
});

it('excludes partner experiences when a distribution or internal category filter is active', () => {
  const offer = { id: 7, title: 'Petit-déjeuner en chambre', type: 'BREAKFAST', price: 15,
    currency: 'EUR', active: true, diffuseOnLivret: true } as UpsellOffer;
  const open = vi.fn();
  render(catalog({ offers: [offer], internalOnly: true, onOpenInternal: open }));
  expect(screen.queryByRole('button', { name: MARKETPLACE_EXPERIENCES[0].title })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Gérer : Petit-déjeuner en chambre' }));
  expect(open).toHaveBeenCalledWith(offer);
});

it('returns from a partner detail to the selected source', () => {
  render(catalog());
  fireEvent.click(screen.getByRole('button', { name: 'Viator 2' }));
  fireEvent.click(screen.getByRole('button', { name: 'Dégustation de spécialités locales' }));
  fireEvent.click(screen.getByRole('button', { name: 'Retour au catalogue' }));
  expect(screen.getByRole('button', { name: 'Viator 2' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: MARKETPLACE_EXPERIENCES[0].title })).not.toBeInTheDocument();
});

it('shows an actionable empty search and an explicit API failure', () => {
  const reset = vi.fn();
  const retry = vi.fn();
  render(catalog({ search: 'introuvable', error: true, onResetFilters: reset, onRetry: retry }));
  expect(screen.getByText('Impossible de charger vos services.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
  expect(retry).toHaveBeenCalledOnce();
  expect(reset).toHaveBeenCalledOnce();
});
