import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ShopPage from './ShopPage';

const search = vi.hoisted(() => ({ change: (_value: string) => {} }));
vi.mock('../../hooks/useUserPreference', async () => {
  const { useState } = await import('react');
  return { useUserPreference: (_key: string, initial: unknown) => useState(initial) };
});
vi.mock('../../components/ScreenChrome', () => ({ useScreenSearch: (_value: string, onChange: (value: string) => void) => { search.change = onChange; } }));
vi.mock('../../components/PageHeader', () => ({ default: ({ actions }: { actions: ReactNode }) => <header>{actions}</header> }));
vi.mock('../../hooks/useNotification', () => ({ useNotification: () => ({ notify: { success: vi.fn() } }) }));
vi.mock('../../components/Money', () => ({ Money: ({ value }: { value: number }) => <span>{value} €</span> }));
vi.mock('./CartDrawer', () => ({ default: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('filters products through the shared header search and resets an empty result', () => {
  render(<ShopPage />);
  act(() => search.change('KIT-SECURITY'));
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
  expect(screen.getByRole('heading', { name: 'Kit sécurité' })).toBeInTheDocument();
  act(() => search.change('introuvable'));
  fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
  expect(screen.getByRole('heading', { name: 'Kit essentiel' })).toBeInTheDocument();
});

it('preserves quantities when changing catalog view and removes a product at zero', () => {
  render(<ShopPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter au panier : Kit essentiel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Liste', exact: true }));
  const controls = screen.getByRole('group', { name: 'Kit essentiel' });
  expect(within(controls).getByText('1')).toBeInTheDocument();
  fireEvent.click(within(controls).getAllByRole('button')[0]);
  expect(screen.getByRole('button', { name: 'Ajouter au panier : Kit essentiel' })).toBeInTheDocument();
});

it('sorts the selected category by price without hiding kit contents', async () => {
  render(<ShopPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Kits 3' }));
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Trier les produits' }), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: 'Prix décroissant' }));
  const titles = screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent);
  expect(titles.slice(1)).toEqual(['Kit complet', 'Kit sécurité', 'Kit essentiel']);
  expect(screen.getAllByText('Capteur de bruit 5 en 1').length).toBeGreaterThan(0);
});
