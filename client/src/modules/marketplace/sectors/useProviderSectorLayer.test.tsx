import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ReactElement, ComponentProps } from 'react';
import type ProviderSectorPanel from './ProviderSectorPanel';
import { useProviderSectorLayer } from './useProviderSectorLayer';

vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: data, isLoading: false, isError: false }) }));
const data = {
  providers: [{ providerId: 27, userId: 35, geometry: { type: 'Polygon' as const, coordinates: [[[2, 48], [3, 48], [3, 49], [2, 48]]] } }, { providerId: 1, userId: 1, geometry: null }],
  merged: null, properties: [{ id: 76, coveredBy: [1, 27] }, { id: 75, coveredBy: [1] }],
};
type PanelElement = ReactElement<ComponentProps<typeof ProviderSectorPanel>>;

it('accumulates areas, deduplicates providers and removes only the clicked area', () => {
  const onPointChange = vi.fn();
  const { result } = renderHook(() => useProviderSectorLayer(null, true, {
    point: null, onPointChange, mode: 'byProvider', onModeChange: vi.fn(),
  }));
  const panel = () => (result.current.panel as PanelElement).props;
  const first: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] };
  const second: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[4,4],[5,4],[5,5],[4,4]]] };
  const a = { lng: 0.8, lat: 0.2 }, b = { lng: 4.8, lat: 4.2 };
  act(() => result.current.overlay?.onAreaSelect?.([27], first, a));
  act(() => result.current.overlay?.onAreaSelect?.([1,27], second, b));
  expect(panel().selectedAreaCount).toBe(2);
  expect(panel().areaProviderIds).toEqual([27,1]);
  expect(result.current.selectedArea).toEqual({ type: 'MultiPolygon', coordinates: [first.coordinates, second.coordinates] });
  expect(onPointChange).toHaveBeenLastCalledWith([a,b]);
  act(() => result.current.overlay?.onAreaSelect?.([27], JSON.parse(JSON.stringify(first)), a));
  expect(panel().selectedAreaCount).toBe(1);
  expect(result.current.selectedArea).toEqual(second);
  expect(panel().areaProviderIds).toEqual([1,27]);
  expect(onPointChange).toHaveBeenLastCalledWith(b);
  act(() => result.current.clearArea());
  expect(panel().selectedAreaCount).toBe(0);
  expect(result.current.selectedArea).toBeNull();
  expect(panel().areaProviderIds).toBeNull();
  expect(onPointChange).toHaveBeenLastCalledWith(null);
});

it('restores persisted areas and collapses points within the same polygon', () => {
  const point = [{ lng: 2.8, lat: 48.2 }, { lng: 2.9, lat: 48.3 }];
  const { result } = renderHook(() => useProviderSectorLayer(null, true, {
    point, onPointChange: vi.fn(), mode: 'byProvider', onModeChange: vi.fn(),
  }));
  expect((result.current.panel as PanelElement).props.selectedAreaCount).toBe(1);
  expect(result.current.selectedArea).toEqual(data.providers[0].geometry);
});

it('filters the provider panel from a map sector and clears the filter explicitly or on mode changes', () => {
  const { result } = renderHook(() => useProviderSectorLayer(null));
  const panel = () => (result.current.panel as PanelElement).props;
  expect(panel().mode).toBe('byProvider');
  expect(result.current.overlay?.mode).toBe('byProvider');
  const geometry: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
  act(() => result.current.overlay?.onAreaSelect?.([27, 1], geometry));
  expect(panel().areaProviderIds).toEqual([27, 1]);
  expect(result.current.overlay?.selectedAreaGeometry).toEqual(geometry);
  act(() => panel().onHover(27));
  expect(result.current.overlay?.selectedAreaGeometry).toEqual(geometry);
  act(() => result.current.focusProviderUser(35));
  expect(result.current.overlay?.selectedAreaGeometry).toEqual(geometry);
  expect(panel().areaProviderIds).toEqual([27, 1]);
  act(() => panel().onClearAreaFilter?.());
  expect(panel().areaProviderIds).toBeNull();
  expect(result.current.overlay?.selectedAreaGeometry).toBeNull();
  act(() => result.current.overlay?.onAreaSelect?.([27]));
  act(() => panel().onModeChange('byProvider'));
  expect(panel().areaProviderIds).toBeNull();
});

it('keeps selection distinct from hover and restores all providers when returning to the overview', () => {
  const { result } = renderHook(() => useProviderSectorLayer(null));
  const panel = () => (result.current.panel as PanelElement).props;
  act(() => panel().onSelect(27));
  expect(result.current.focusBounds).toEqual([2, 48, 3, 49]);
  expect(result.current.overlay?.selectedProviderId).toBe(27);
  expect(result.current.coverage?.get(76)).toEqual([27]);
  expect(result.current.coverage?.get(75)).toEqual([]);
  act(() => panel().onHover(1));
  expect(result.current.overlay?.selectedProviderId).toBe(27);
  expect(result.current.overlay?.highlightedProviderId).toBe(1);
  expect(result.current.coverage?.get(75)).toEqual([1]);
  act(() => panel().onHover(null));
  expect(result.current.overlay?.selectedProviderId).toBe(27);
  expect(result.current.coverage?.get(75)).toEqual([]);
  act(() => panel().onModeChange('merged'));
  expect(result.current.overlay?.selectedProviderId).toBeNull();
  expect(result.current.overlay?.highlightedProviderId).toBeNull();
  expect(result.current.coverage?.get(76)).toEqual([1, 27]);
});

it('isolates Salma when she is selected from an assigned intervention', () => {
  const { result } = renderHook(() => useProviderSectorLayer(null));
  act(() => result.current.focusProviderUser(35));
  expect(result.current.overlay?.selectedProviderId).toBe(27);
  expect(result.current.coverage?.get(75)).toEqual([]);
  act(() => (result.current.panel as PanelElement).props.onSelect(null));
  expect(result.current.overlay?.selectedProviderId).toBeNull();
});
