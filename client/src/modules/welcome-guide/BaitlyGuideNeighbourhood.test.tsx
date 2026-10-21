import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GuidePoi, PublicGuideProperty } from '../../services/api/welcomeGuideApi';
import { BaitlyGuideNeighbourhood, hasGuidePosition } from './BaitlyGuideNeighbourhood';
import { GUIDE_LABELS } from './guideLabels';

vi.mock('./GuideMap', () => ({ GuideMap: ({ pins, mode, selectedId, onSelect }: {
  pins: Array<{ id: string; label: string }>; mode: string; selectedId?: string; onSelect: (id: string) => void;
}) => <div data-testid="map" data-mode={mode} data-selection={selectedId}>{pins.map(pin =>
  <button key={pin.id} onClick={() => onSelect(pin.id)}>{pin.label}</button>)}</div> }));

const property: PublicGuideProperty = { name: 'Maison du Canal', address: '12 quai de la Loire', city: 'Paris', postalCode: '75019', country: 'France', latitude: 48.885, longitude: 2.373 };
const poi = (id: string, category: string, name: string, extra: Partial<GuidePoi> = {}): GuidePoi => ({
  id, category, name, type: '', address: 'Paris', lat: 48.887, lng: 2.375, note: '', featured: false, ...extra,
});
const places = [poi('metro', 'TRANSPORT', 'Métro Laumière', { type: 'Métro ligne 5' }),
  poi('restaurant', 'RESTAURANT', 'Le Comptoir du Canal', { note: 'La table conseillée par votre hôte.' }),
  poi('cafe', 'CAFE', 'Café sans position', { lat: null, lng: null })];
const props = { property, pois: places, theme: 'atelier', lang: 'fr' as const, labels: GUIDE_LABELS.fr, interactive: true };

describe('Baitly guest neighbourhood', () => {
  it('filters both the real pins and the address list, retaining the accommodation', () => {
    render(<BaitlyGuideNeighbourhood {...props} />);
    expect(within(screen.getByTestId('map')).getAllByRole('button')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Transports 1' }));
    const map = within(screen.getByTestId('map'));
    expect(map.getByRole('button', { name: 'Maison du Canal' })).toBeInTheDocument();
    expect(map.getByRole('button', { name: 'Métro Laumière' })).toBeInTheDocument();
    expect(map.queryByRole('button', { name: 'Le Comptoir du Canal' })).toBeNull();
    expect(screen.queryByText('Café sans position')).toBeNull();
  });

  it('opens the matching address details from a pin', () => {
    render(<BaitlyGuideNeighbourhood {...props} />);
    fireEvent.click(within(screen.getByTestId('map')).getByRole('button', { name: 'Le Comptoir du Canal' }));
    expect(screen.getByText('La table conseillée par votre hôte.')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveAttribute('data-selection', 'restaurant');
    expect(screen.getAllByText(/à vol d’oiseau/).length).toBeGreaterThan(0);
  });

  it('retains unpositioned addresses with directions, without creating a misleading pin', () => {
    render(<BaitlyGuideNeighbourhood {...props} />);
    expect(within(screen.getByTestId('map')).queryByText('Café sans position')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Cafés Café sans position/ }));
    expect(screen.getByText('Adresse non positionnée')).toBeInTheDocument();
    const article = screen.getByText('Café sans position').closest('article')!;
    fireEvent.click(within(article).getByRole('button', { name: 'Itinéraire' }));
    expect(within(article).getByRole('menuitem', { name: 'Google Maps' })).toHaveAttribute('href', expect.stringContaining('Paris'));
  });

  it('follows the property and guest theme when preview data changes', () => {
    const { rerender } = render(<BaitlyGuideNeighbourhood {...props} />);
    rerender(<BaitlyGuideNeighbourhood {...props} theme="minuit" property={{ ...property, name: 'Maison de la Corniche', latitude: 35.78, longitude: -5.8 }} pois={[]} />);
    expect(screen.getByTestId('map')).toHaveAttribute('data-mode', 'dark');
    expect(within(screen.getByTestId('map')).getByText('Maison de la Corniche')).toBeInTheDocument();
    expect(screen.queryByText('Le Comptoir du Canal')).toBeNull();
  });

  it('does not create maps in theme thumbnails and keeps the exploration action', () => {
    const onExplore = vi.fn();
    render(<BaitlyGuideNeighbourhood {...props} compact renderMap={false} onExplore={onExplore} />);
    expect(screen.queryByTestId('map')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Explorer le quartier/ }));
    expect(onExplore).toHaveBeenCalledOnce();
  });

  it('rejects malformed coordinates while accepting valid zero coordinates', () => {
    for (const [lat, lng] of [[null, null], [NaN, 2], [48, Infinity], [91, 2], [48, 181]]) expect(hasGuidePosition(lat, lng)).toBe(false);
    expect(hasGuidePosition(0, 0)).toBe(true);
  });
});
