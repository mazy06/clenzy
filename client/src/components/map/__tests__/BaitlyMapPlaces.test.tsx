import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Map } from 'maplibre-gl';
import BaitlyMapPlaces from '../BaitlyMapPlacesControl';
import { mapPlacesFilter } from '../baitlyMapPlaceCategories';
import { MapCardCoordinator, useMapCardClaim } from '../MapCardCoordinator';

vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));

describe('BaitlyMapPlaces', () => {
  it('toggles independent categories, hides all and restores selections after style reload', () => {
    const listeners = new Set<() => void>();
    const map = { getLayer: vi.fn(() => ({})), setFilter: vi.fn(), setLayoutProperty: vi.fn(),
      on: vi.fn((_event, handler) => listeners.add(handler)), off: vi.fn((_event, handler) => listeners.delete(handler)) };
    const view = render(<BaitlyMapPlaces map={map as unknown as Map} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lieux utiles' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Restaurants' }));
    expect(map.setFilter.mock.lastCall?.[1]).toEqual(mapPlacesFilter(['transport', 'culture', 'nature', 'restaurants']));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gares et métros' }));
    expect(map.setFilter.mock.lastCall?.[1]).toEqual(mapPlacesFilter(['culture', 'nature', 'restaurants']));
    map.setFilter.mockClear();
    listeners.forEach(handler => handler());
    expect(map.setFilter).toHaveBeenCalledWith('pois', mapPlacesFilter(['culture', 'nature', 'restaurants']));
    fireEvent.click(screen.getByRole('button', { name: 'Tout masquer' }));
    expect(map.setFilter).toHaveBeenLastCalledWith('world-pois', mapPlacesFilter([]));
    expect(screen.getAllByRole('checkbox').filter(input => input !== screen.getByRole('checkbox', { name: 'Noms des rues' })).every(input => !(input as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Tout afficher' }));
    expect(screen.getAllByRole('checkbox').every(input => (input as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Noms des rues' }));
    expect(map.setLayoutProperty).toHaveBeenCalledWith('roads_labels_minor', 'visibility', 'none');
    expect(map.setLayoutProperty).toHaveBeenCalledWith('roads_labels_major', 'visibility', 'none');
    map.setLayoutProperty.mockClear();
    listeners.forEach(handler => handler());
    expect(map.setLayoutProperty).toHaveBeenCalledWith('world-roads_labels_minor', 'visibility', 'none');
    view.unmount();
    expect(listeners.size).toBe(0);
  });

  it('opening filters closes the property card and opening a card closes the filters', () => {
    const closeCard = vi.fn();
    let claim: ReturnType<typeof useMapCardClaim>;
    function Card() {
      claim = useMapCardClaim();
      return <button onClick={() => claim(closeCard)}>Ouvrir la fiche</button>;
    }
    const map = { getLayer: () => undefined, on: vi.fn(), off: vi.fn() };
    render(<MapCardCoordinator><Card /><BaitlyMapPlaces map={map as unknown as Map} /></MapCardCoordinator>);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la fiche' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lieux utiles' }));
    expect(closeCard).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Lieux utiles' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la fiche' }));
    expect(screen.queryByRole('heading', { name: 'Lieux utiles' })).toBeNull();
  });
});
