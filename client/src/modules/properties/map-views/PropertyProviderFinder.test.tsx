import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { providerCatalogApi } from '../../../services/api/providerCatalogApi';
import PropertyProviderFinder from './PropertyProviderFinder';

vi.mock('../../../services/api/providerCatalogApi', () => ({ providerCatalogApi: { search: vi.fn(), getCategories: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('cherche seulement à l’ouverture, transmet logement et jour, et conserve le logement dans le parcours devis', async () => {
  vi.mocked(providerCatalogApi.getCategories).mockResolvedValue([]);
  vi.mocked(providerCatalogApi.search).mockResolvedValue({ items: [
    { id: 9, displayName: 'Atelier Paris', headline: 'Plomberie', avatarUrl: '/uploads/provider-9.jpg' } as any,
    { id: 10, displayName: 'Nora Ben Ali' } as any,
  ], page: 0, size: 5, totalElements: 2, totalPages: 1 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><PropertyProviderFinder propertyId={12} initialDate="2026-10-18" /></QueryClientProvider></MemoryRouter>);
  expect(providerCatalogApi.search).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Trouver un intervenant/i }));
  const link = await screen.findByRole('link', { name: /Atelier Paris/ });
  expect(providerCatalogApi.search).toHaveBeenLastCalledWith(expect.objectContaining({ propertyId: 12, availableOnDay: 7, size: 5 }));
  expect(link.getAttribute('href')).toBe('/prestataires/9?propertyId=12');
  const photo = link.querySelector('img')!;
  expect(photo.getAttribute('src')).toContain('/uploads/provider-9.jpg');
  expect(screen.getByRole('link', { name: /Nora Ben Ali/ }).textContent).toContain('NB');
  fireEvent.error(photo);
  expect(link.querySelector('img')).toBeNull();
  expect(link.textContent).toContain('AP');
  const date = document.querySelector('input[type="date"]')!;
  fireEvent.change(date, { target: { value: '2026-10-19' } });
  await waitFor(() => expect(providerCatalogApi.search).toHaveBeenLastCalledWith(expect.objectContaining({ propertyId: 12, availableOnDay: 1 })));
});

it('affiche un échec de recherche sans le présenter comme une absence de prestataires', async () => {
  vi.mocked(providerCatalogApi.getCategories).mockResolvedValue([]);
  vi.mocked(providerCatalogApi.search).mockRejectedValue(new Error('offline'));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><PropertyProviderFinder propertyId={12} /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Trouver un intervenant/i }));
  expect((await screen.findByRole('alert')).textContent).toContain('La recherche n’a pas abouti');
  expect(screen.queryByText(/0 prestataire/)).toBeNull();
});
