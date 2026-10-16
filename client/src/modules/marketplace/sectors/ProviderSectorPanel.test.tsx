import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SectorMap } from '../../../services/api/sectorMapApi';
import ProviderSectorPanel from './ProviderSectorPanel';

vi.mock('../../../hooks/useThemeMode', () => ({ useThemeMode: () => ({ isDark: false }) }));
vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) => typeof fallback === 'string' ? fallback
      : (fallback as { defaultValue?: string; count?: number; name?: string } | undefined)?.defaultValue
        ?.replace('{{count}}', String((fallback as { count?: number }).count ?? ''))
        .replace('{{name}}', String((fallback as { name?: string }).name ?? '')) ?? _key,
  }),
}));

const square = (lng: number, lat: number): GeoJSON.Polygon => ({
  type: 'Polygon',
  coordinates: [[[lng, lat], [lng + 0.1, lat], [lng + 0.1, lat + 0.1], [lng, lat + 0.1], [lng, lat]]],
});

const data: SectorMap = {
  providers: [
    { providerId: 1, name: 'Paris Ménage', avatarUrl: null, geometry: square(2.3, 48.8), zones: [{ key: 'k', name: 'Paris', kind: 'department', approx: false, drawn: true }], userId: null },
    { providerId: 2, name: 'Lyon Services', avatarUrl: null, geometry: square(4.8, 45.7), zones: [], userId: null },
  ],
  merged: null,
  properties: [{ id: 10, name: 'Loft', latitude: 48.85, longitude: 2.35, coveredBy: [1] }],
  attribution: '',
};

const parisBounds = { north: 49, south: 48.5, east: 2.6, west: 2.1 };

function renderPanel(onSelect = vi.fn(), onHover = vi.fn(), selectedId: number | null = null, map: SectorMap = data) {
  render(<MemoryRouter>
    <ProviderSectorPanel data={map} isLoading={false} isError={false} bounds={parisBounds}
      mode="merged" onModeChange={vi.fn()} selectedId={selectedId} onSelect={onSelect} onHover={onHover} />
  </MemoryRouter>);
  return { onSelect, onHover };
}

afterEach(cleanup);

describe('ProviderSectorPanel', () => {
  it('whenTheMapShowsParis_thenOnlyProvidersWhoseSectorIsVisibleAreListed', () => {
    renderPanel();

    expect(screen.getByText('Paris Ménage')).toBeTruthy();
    expect(screen.queryByText('Lyon Services')).toBeNull();
    expect(screen.getByText('1 logement(s) couvert(s)')).toBeTruthy();
  });

  it('whenARowIsHoveredThenClicked_thenItsSectorIsHighlightedThenSelected', () => {
    const { onSelect, onHover } = renderPanel();
    const row = screen.getByRole('button', { name: /Paris Ménage/ });

    fireEvent.mouseEnter(row);
    fireEvent.click(row);

    expect(onHover).toHaveBeenCalledWith(1);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('whenTheSelectedProviderHasNoSectorHere_thenItIsStillListedFirst', () => {
    const withAssignee: SectorMap = { ...data, providers: [...data.providers,
      { providerId: 3, name: 'Jean Martin', avatarUrl: null, geometry: null, zones: [], userId: 42 }] };
    renderPanel(vi.fn(), vi.fn(), 3, withAssignee);

    const rows = screen.getAllByRole('button', { pressed: true });
    expect(rows[0].textContent).toContain('Jean Martin');
    expect(screen.getByText('Aucune zone déclarée')).toBeTruthy();
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('Jean Martin');
  });
});
