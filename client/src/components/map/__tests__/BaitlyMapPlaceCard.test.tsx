import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import BaitlyMapPlaceCard from '../BaitlyMapPlaceCard';

vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
const fetchDetails = vi.hoisted(() => vi.fn());
const viewport = vi.hoisted(() => ({ small: false }));
vi.mock('../../../hooks/use-media-query', () => ({ useMediaQuery: () => viewport.small }));
vi.mock('../../../services/mapPlaceDetailsApi', () => ({ fetchMapPlaceDetails: fetchDetails }));
const place = { name: 'Restaurant de recette', kind: 'restaurant', lat: 48.86, lng: 2.33 };

describe('BaitlyMapPlaceCard', () => {
  it('shows actual contact data, preserves full hours and closes without navigating', async () => {
    fetchDetails.mockResolvedValue({ sourceUrl: 'https://www.openstreetmap.org/node/1', phone: '+33123456789', openingHours: 'Mo-Fr 09:00-18:00; Sa 10:00-20:00', website: 'https://example.org/' });
    const close = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><BaitlyMapPlaceCard place={place} onClose={close} /></QueryClientProvider>);
    expect(await screen.findByRole('link', { name: '+33123456789' })).toHaveAttribute('href', 'tel:+33123456789');
    expect(screen.getByText(/Mo-Fr 09:00-18:00/).textContent).toBe('Mo-Fr 09:00-18:00;\nSa 10:00-20:00');
    expect(screen.queryByText('Aucune photo disponible dans la source.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('offers retry when the public data service fails', async () => {
    fetchDetails.mockRejectedValue(new Error('unavailable'));
    render(<QueryClientProvider client={new QueryClient()}><BaitlyMapPlaceCard place={place} onClose={vi.fn()} /></QueryClientProvider>);
    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Voir sur OpenStreetMap' })).toBeNull();
  });
  it('switches compact mobile tabs without fetching again or losing information', async () => {
    viewport.small = true;
    fetchDetails.mockClear();
    fetchDetails.mockResolvedValue({ sourceUrl: 'https://www.openstreetmap.org/node/1', phone: '+33123456789', openingHours: 'Mo-Fr 09:00-18:00; Sa 10:00-20:00' });
    render(<QueryClientProvider client={new QueryClient()}><BaitlyMapPlaceCard place={place} onClose={vi.fn()} /></QueryClientProvider>);
    await screen.findByRole('link', { name: '+33123456789' });
    fireEvent.click(screen.getByRole('tab', { name: 'Horaires et détails' }));
    expect(screen.getByRole('tabpanel', { name: 'Horaires et détails' })).toHaveTextContent('Sa 10:00-20:00');
    expect(screen.queryByRole('link', { name: '+33123456789' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Coordonnées' }));
    expect(screen.getByRole('link', { name: '+33123456789' })).toBeTruthy();
    expect(fetchDetails).toHaveBeenCalledTimes(1);
    viewport.small = false;
  });
});
