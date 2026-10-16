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
