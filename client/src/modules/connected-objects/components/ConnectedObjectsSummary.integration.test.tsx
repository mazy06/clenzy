import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectedObjectsSummary from './ConnectedObjectsSummary';
import { usePropertyAccessCode } from '../usePropertyAccessCode';
import type { ConnectedDevice } from '../types';
import type { ProviderStatusDto } from '../../../services/api/devicesApi';

vi.mock('../usePropertyAccessCode', () => ({ usePropertyAccessCode: vi.fn() }));
vi.mock('../../../hooks/useNotification', () => ({ useNotification: () => ({ notify: { success: vi.fn(), error: vi.fn() } }) }));
const device: ConnectedDevice = { uid: 'lock:1', id: 1, kind: 'lock', name: 'Serrure de test', roomName: 'Entrée', propertyId: 1, propertyName: 'Logement test', provider: 'TUYA', online: true, statusLevel: 'ok', statusLabel: 'Verrouillée', actions: ['view', 'unlock'], raw: {} };
const devices: ConnectedDevice[] = [device,
  { ...device, uid: 'noise:2', id: 2, kind: 'noise', name: 'Bruit séjour', roomName: 'Séjour', online: false, statusLevel: 'offline', statusLabel: 'Hors ligne', provider: 'MINUT' },
  { ...device, uid: 'contact:3', id: 3, kind: 'contact', name: 'Capteur à synchroniser', statusLevel: 'unknown', statusLabel: 'État inconnu', online: false },
  { ...device, uid: 'lock:4', id: 4, name: 'Serrure batterie faible', battery: 12 },
];
const providers: ProviderStatusDto[] = [
  { provider: 'TUYA', connected: true, deviceCount: 40, status: null },
  { provider: 'MINUT', connected: false, deviceCount: 8, status: null },
];
const props = { group: { propertyId: 1, propertyName: 'Logement test', devices }, providers, loading: false,
  onViewDevice: vi.fn(), onConnectNetatmo: vi.fn().mockResolvedValue(undefined), onManageServices: vi.fn() };
const tile = (name: string) => within(screen.getByRole('region')).getByRole('button', { name: new RegExp('^' + name) });
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
function mockAccess(value: object) { vi.mocked(usePropertyAccessCode).mockReturnValue(value as ReturnType<typeof usePropertyAccessCode>); }
beforeEach(() => {
  vi.clearAllMocks();
  mockAccess({ data: { accessCode: 'DEMO-4319', accessCodeAutoRotate: true }, isLoading: false, isError: false });
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks();
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('connected objects dashboard disclosures', () => {
  it('separates unknown connectivity from offline and shows only matching devices', () => {
    render(<ConnectedObjectsSummary {...props} />);
    expect(tile('Objets configurés')).toHaveTextContent('4');
    expect(tile('En ligne')).toHaveTextContent('2');
    expect(tile('Hors ligne')).toHaveTextContent('1');
    expect(tile('À vérifier')).toHaveTextContent('1');
    fireEvent.click(tile('Hors ligne'));
    const panel = screen.getByRole('dialog', { name: 'Hors ligne' });
    expect(within(panel).queryByText('Capteur à synchroniser')).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: /Bruit séjour/ }));
    expect(props.onViewDevice).toHaveBeenCalledWith('noise:2');
    expect(props.onConnectNetatmo).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(tile('Objets configurés'));
    expect(screen.getByText('1 objet n’a pas encore d’état de connexion confirmé.')).toBeVisible();
  });

  it('merges Netatmo into services and uses property counts instead of global provider counts', async () => {
    let resolve!: () => void;
    props.onConnectNetatmo.mockReturnValueOnce(new Promise<void>(done => { resolve = done; }));
    render(<ConnectedObjectsSummary {...props} />);
    expect(screen.queryByRole('button', { name: 'Connecter Netatmo' })).not.toBeInTheDocument();
    expect(tile('Services connectés')).toHaveTextContent('1');
    fireEvent.click(tile('Services connectés'));
    const panel = screen.getByRole('dialog', { name: 'Services connectés' });
    expect(within(panel).getByText('3 objets dans ce logement')).toBeVisible();
    expect(within(panel).queryByText(/40 objets/)).not.toBeInTheDocument();
    expect(within(panel).getByText('TUYA')).toBeVisible();
    const connect = within(panel).getByRole('button', { name: 'Connecter Netatmo' });
    fireEvent.click(connect);
    expect(connect).toBeDisabled();
    fireEvent.click(connect);
    expect(props.onConnectNetatmo).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); });
    expect(connect).toBeEnabled();
    fireEvent.click(within(panel).getByRole('button', { name: 'Gérer les intégrations' }));
    expect(props.onManageServices).toHaveBeenCalledOnce();
  });

  it('does not offer another connection when Netatmo is already connected', () => {
    render(<ConnectedObjectsSummary {...props} providers={[...providers, { provider: 'NETATMO', connected: true, deviceCount: 0, status: null }]} />);
    fireEvent.click(tile('Services connectés'));
    expect(screen.getByRole('dialog')).toHaveTextContent('Netatmo');
    expect(screen.queryByRole('button', { name: 'Connecter Netatmo' })).not.toBeInTheDocument();
    expect(tile('Services connectés')).toHaveTextContent('2');
  });

  it('keeps the access code masked, copies explicitly, and conceals it again after closing', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
    render(<ConnectedObjectsSummary {...props} />);
    expect(screen.queryByText('DEMO-4319')).not.toBeInTheDocument();
    fireEvent.click(tile('Digicode'));
    expect(screen.queryByText('DEMO-4319')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Afficher le digicode/ }));
    expect(screen.getByText('DEMO-4319')).toBeVisible();
    expect(tile('Digicode')).toHaveTextContent('••••••');
    fireEvent.click(screen.getByRole('button', { name: /Copier le digicode/ }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith('DEMO-4319'));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer les détails' }));
    fireEvent.click(tile('Digicode'));
    expect(screen.queryByText('DEMO-4319')).not.toBeInTheDocument();
  });

  it('distinguishes an unavailable access code from a missing code', () => {
    mockAccess({ data: undefined, isLoading: false, isError: true });
    const page = render(<ConnectedObjectsSummary {...props} />);
    fireEvent.click(tile('Digicode'));
    expect(screen.getByRole('alert')).toHaveTextContent('n’a pas pu être chargé');
    mockAccess({ data: {}, isLoading: false, isError: false });
    page.rerender(<ConnectedObjectsSummary {...props} />);
    expect(screen.getByText(/Aucun digicode renseigné/)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses the dashboard hover disclosure and restores focus with Escape', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    render(<ConnectedObjectsSummary {...props} />);
    const event = new Event('pointerover', { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    fireEvent(tile('En ligne'), event);
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(screen.getByRole('dialog', { name: 'En ligne' })).toBeVisible();
    fireEvent.click(tile('Digicode'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tile('Digicode')).toHaveFocus();
  });
});
