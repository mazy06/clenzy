import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConnectedObjectsHub from './ConnectedObjectsHub';
import type { ConnectedDevice } from './types';

const fixtures = vi.hoisted(() => {
  const base = { provider: 'TUYA', online: true, statusLevel: 'ok', statusLabel: 'En ligne', actions: ['view'], raw: {} };
  const devices = [
    { ...base, uid: 'camera:1', id: 1, kind: 'camera', name: 'Caméra test', roomName: 'Entrée', propertyId: 1, propertyName: 'Appartement A' },
    { ...base, uid: 'climate:2', id: 2, kind: 'climate', name: 'Capteur test', roomName: 'Chambre', propertyId: 2, propertyName: 'Appartement B' },
    { ...base, uid: 'noise:3', id: 3, kind: 'noise', name: 'Bruit séjour', roomName: 'Séjour', propertyId: 1, propertyName: 'Appartement A', online: false, statusLevel: 'offline', statusLabel: 'Hors ligne' },
  ];
  return { devices, act: vi.fn(), refetch: vi.fn() };
});
vi.mock('./useConnectedObjects', () => ({ useConnectedObjects: () => ({ ...fixtures, groups: [1, 2].map(id => ({ propertyId: id, propertyName: id === 1 ? 'Appartement A' : 'Appartement B', devices: fixtures.devices.filter(d => d.propertyId === id) })), providers: [], loading: false, error: false, actingUid: null }) }));
vi.mock('./useDeviceEventStream', () => ({ useDeviceEventStream: () => undefined }));
vi.mock('./usePropertyAccessCode', () => ({ usePropertyAccessCode: () => ({ data: {}, isLoading: false, isError: false }) }));
vi.mock('../../services/api/propertiesApi', () => ({ propertiesApi: { getAll: () => Promise.resolve([]) } }));
vi.mock('../../hooks/useNotification', () => ({ useNotification: () => ({ notify: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }) }));
vi.mock('../../hooks/useUserPreference', () => ({ useUserPreference: (_key: string, initial: unknown) => { const [value, setValue] = useState(initial); return [value, setValue, { isLoaded: true }]; } }));
vi.mock('../../hooks/useViewportFill', () => ({ useViewportFill: () => [() => undefined, 650] }));
vi.mock('../../components/PageHeader', () => ({ default: ({ title, actions }: { title: string; actions: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock('./components/AddDeviceWizard', () => ({ default: () => null }));
vi.mock('./components/RoomDeviceInspector', () => ({ default: ({ device }: { device: ConnectedDevice }) => <section aria-label="Détail test">{device.name}</section>, DeviceState: () => null }));
const clients: QueryClient[] = [];
function Location() { const value = useLocation(); return <output data-testid="location">{value.pathname}{value.search}</output>; }
function setup(url = '/connected-objects') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}><ConnectedObjectsHub /><Location /></MemoryRouter></QueryClientProvider>);
}
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.clearAllMocks(); });
describe('unified device workspace', () => {
  it('opens a bookmarked device in the correct property and room, without a detail route', () => {
    setup('/connected-objects?device=climate%3A2');
    expect(screen.getByRole('combobox', { name: 'Choisir un logement' })).toHaveValue('2');
    expect(screen.getByRole('img', { name: 'Illustration de la pièce : Chambre' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Détail test' })).toHaveTextContent('Capteur test');
    expect(fixtures.act).not.toHaveBeenCalled();
  });
  it('selects an offline device from a KPI and switches rooms inline', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Hors ligne\s*1$/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Hors ligne' })).getByRole('button', { name: /Bruit séjour/ }));
    expect(screen.getByRole('region', { name: 'Détail test' })).toHaveTextContent('Bruit séjour');
    expect(screen.getByRole('img', { name: 'Illustration de la pièce : Séjour' })).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/connected-objects?device=noise%3A3&property=1');
    fireEvent.click(screen.getByTitle('Entrée'));
    expect(screen.getByRole('region', { name: 'Détail test' })).toHaveTextContent('Caméra test');
    expect(screen.getByTestId('location')).not.toHaveTextContent('device=');
    expect(fixtures.act).not.toHaveBeenCalled();
  });
  it('clears device selection on property change and finds the room matching a new type filter', () => {
    setup('/connected-objects?device=climate%3A2');
    fireEvent.change(screen.getByRole('combobox', { name: 'Choisir un logement' }), { target: { value: '1' } });
    fireEvent.click(screen.getByTitle('Entrée'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Type d’objet' }), { target: { value: 'noise' } });
    expect(screen.getByRole('region', { name: 'Détail test' })).toHaveTextContent('Bruit séjour');
    expect(screen.getByTestId('location')).toHaveTextContent('/connected-objects?property=1&kind=noise');
  });
});
