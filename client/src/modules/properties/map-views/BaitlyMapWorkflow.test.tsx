import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import PropertiesMapView from '../PropertiesMapView';
import type { PropertyListItem } from '../../../hooks/usePropertiesList';
import { sectorMapApi } from '../../../services/api/sectorMapApi';
import apiClient from '../../../services/apiClient';
import type { BaitlyPropertyMapProps } from '../../../components/BaitlyPropertyMap';
import { MapLocateButton } from './MapRowInteractions';

const state = vi.hoisted(() => ({ map: null as BaitlyPropertyMapProps | null, issues: [] as any[] }));
vi.mock('../../../hooks/useUserPreference', () => ({ useUserPreference: (_key: string, defaults: unknown) => [defaults, vi.fn(), { isLoaded: true }] }));
vi.mock('../../../hooks/useHomeMapCenter', () => ({ useHomeMapCenter: () => [2.3, 48.8] }));
vi.mock('../../../hooks/useIdleReady', () => ({ useIdleReady: () => true }));
vi.mock('../../../hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('../../../components/BaitlyPropertyMap', () => ({ BaitlyPropertyMap: (props: BaitlyPropertyMapProps) => {
  state.map = props;
  useEffect(() => props.onBoundsChange?.({ north: 50, south: 40, west: -5, east: 10 }), [props.properties]);
  return <><div data-testid="pins">{props.properties.map(pin => <span key={pin.id}>{pin.name}</span>)}</div>{props.mapTools}</>;
} }));
vi.mock('../../../services/api/sectorMapApi', () => ({ sectorMapApi: { relevant: vi.fn() } }));
vi.mock('../../../services/apiClient', () => ({ default: { get: vi.fn() } }));
vi.mock('../../../services/api/keyExchangeApi', () => ({ keyExchangeApi: { getPoints: async () => [] } }));
vi.mock('../../../services/api/propertiesApi', () => ({ propertiesApi: { getMapStates: async () => [] } }));
vi.mock('../../../services/api/issuesApi', () => ({ issuesApi: { list: async () => state.issues } }));
vi.mock('../PropertyMapRow', () => ({ default: ({ property }: { property: PropertyListItem }) => <span>{property.name} fiche<MapLocateButton propertyId={Number(property.id)} /></span> }));
vi.mock('../PropertyMapCard', () => ({ default: () => null }));
vi.mock('../../marketplace/sectors/ProviderSectorPanel', () => ({ default: () => null }));
vi.mock('./BaitlyMapFilters', () => ({ default: ({ onChange, onReset }: any) => <>
  <button onClick={() => onChange({ period: 'tomorrow' })}>Demain</button>
  <button onClick={onReset}>Réinitialiser la carte</button>
</> }));
vi.mock('./PrestationsMapList', () => ({ default: ({ pages }: any) => <div data-testid="missions">{pages.data?.pages[0]?.totalElements ?? 0}</div> }));
vi.mock('./IssuesMapList', () => ({ default: ({ issues }: any) => <div data-testid="issues">{issues.map((issue: any) => issue.title).join(',')}</div> }));

afterEach(() => { cleanup(); vi.clearAllMocks(); state.issues = []; });
const area: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[2,48],[3,48],[3,49],[2,49],[2,48]]] };
const properties = [
  { id: '1', name: 'Paris A', latitude: 48.8, longitude: 2.3, status: 'active' },
  { id: '2', name: 'Paris B', latitude: 48.9, longitude: 2.4, status: 'maintenance' },
  { id: '3', name: 'Lyon', latitude: 45.7, longitude: 4.8, status: 'active' },
].map(property => ({ ...property, type: 'apartment', address: '', city: '', nightlyPrice: 0 })) as PropertyListItem[];

function mount(view: 'properties' | 'prestations' | 'issues' = 'properties') {
  vi.mocked(sectorMapApi.relevant).mockResolvedValue({
    providers: [{ providerId: 7, userId: null, name: 'Paris Service', avatarUrl: null, geometry: area, zones: [] }],
    merged: area, attribution: '', properties: [
      { id: 1, name: 'Paris A', latitude: 48.8, longitude: 2.3, coveredBy: [7] },
      { id: 2, name: 'Paris B', latitude: 48.9, longitude: 2.4, coveredBy: [] },
      { id: 3, name: 'Lyon', latitude: 45.7, longitude: 4.8, coveredBy: [] },
    ],
  });
  vi.mocked(apiClient.get).mockImplementation(async (url) => url.endsWith('/overview')
    ? { markers: [], total: 0, late: 0, today: 0, completed: 0 } as any
    : { content: [], totalElements: 0, number: 0, last: true } as any);
  const scopeChanged = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const LocationProbe = () => <span data-testid="location">{useLocation().search}</span>;
  render(<MemoryRouter initialEntries={[`/properties?tab=${view}`]}><QueryClientProvider client={client}>
    <LocationProbe />
    <PropertiesMapView view={view} mapMarkers={properties.map(p => ({ id: Number(p.id), name: p.name, lat: p.latitude!, lng: p.longitude! }))}
      viewportProperties={properties} allProperties={properties} channexMappings={new Map()} onBoundsChange={vi.fn()}
      onDiagnose={vi.fn()} canManageContracts missingContractIds={new Set([2])} onMissingContractClick={vi.fn()} onScopeChange={scopeChanged} />
  </QueryClientProvider></MemoryRouter>);
  return { scopeChanged };
}

it('synchronise sélection de zone, logements, compteurs et mise en évidence/localisation', async () => {
  const { scopeChanged } = mount();
  await waitFor(() => expect(state.map?.sectors?.providers).toHaveLength(1));
  act(() => state.map!.sectors!.onAreaSelect!([7], area, { lng: 2.5, lat: 48.5 }));
  await waitFor(() => expect(scopeChanged).toHaveBeenLastCalledWith([1, 2]));
  expect(screen.getByTestId('pins').textContent).not.toContain('Lyon');
  fireEvent.click(screen.getByRole('button', { name: /1 Contrat manquant/i }));
  await waitFor(() => expect(scopeChanged).toHaveBeenLastCalledWith([2]));
  expect(screen.queryByText('Paris A fiche')).toBeNull();
  const row = document.querySelector('[data-map-row-property="2"]')!;
  fireEvent.mouseEnter(row);
  expect(state.map?.highlightedPropertyId).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: 'Localiser sur la carte' }));
  expect(state.map?.locateProperty).toMatchObject({ id: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser la carte' }));
  await waitFor(() => expect(scopeChanged).toHaveBeenLastCalledWith([1, 2, 3]));
  expect(state.map?.locateProperty).toBeNull();
  expect(screen.getByTestId('location').textContent).toContain('tab=properties');
});

it('transmet la même zone et la même période aux épingles et à la pagination serveur', async () => {
  mount('prestations');
  await waitFor(() => expect(state.map?.sectors?.providers).toHaveLength(1));
  act(() => state.map!.sectors!.onAreaSelect!([7], area, { lng: 2.5, lat: 48.5 }));
  fireEvent.click(screen.getByRole('button', { name: 'Demain' }));
  await waitFor(() => {
    const calls = vi.mocked(apiClient.get).mock.calls;
    for (const endpoint of ['/overview', '/page']) {
      const call = [...calls].reverse().find(([url]) => url.endsWith(endpoint));
      expect(call?.[1]?.params).toMatchObject({ propertyIds: '1,2', from: expect.any(String), to: expect.any(String) });
      expect(call?.[1]?.params?.from).toBe(call?.[1]?.params?.to);
    }
  });
});
it('filtre les anomalies par période sans boucle entre les marqueurs et le cadrage', async () => {
  state.issues = [{ id: 1, propertyId: 1, title: 'Fuite', status: 'OPEN', severity: 'HIGH', createdAt: new Date().toISOString() }];
  mount('issues');
  expect(await screen.findByText('Fuite')).toBeTruthy();
  expect(screen.getByTestId('pins').textContent).toContain('Paris A');
  fireEvent.click(screen.getByRole('button', { name: 'Demain' }));
  await waitFor(() => expect(screen.getByTestId('pins').textContent).toBe(''));
  expect(screen.getByTestId('issues').textContent).toBe('');
});
