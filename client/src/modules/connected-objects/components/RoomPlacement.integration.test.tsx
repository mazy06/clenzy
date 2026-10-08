import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserUiPreferencesProvider } from '../../../providers/UserUiPreferencesProvider';
import { userUiPreferencesApi } from '../../../services/api/userUiPreferencesApi';
import ConnectedRoomExplorer from './ConnectedRoomExplorer';
import type { ConnectedDevice } from '../types';

vi.mock('../../../hooks/useIsAuthenticated', () => ({ useIsAuthenticated: () => true }));
vi.mock('../../../services/api/userUiPreferencesApi', () => ({ userUiPreferencesApi: { list: vi.fn(), upsert: vi.fn(), delete: vi.fn() } }));
vi.mock('../../../hooks/useViewportFill', () => ({ useViewportFill: () => [() => undefined, 650] }));
vi.mock('./PropertyAccessCodeChip', () => ({ default: () => null }));
vi.mock('./RoomDeviceInspector', () => ({ default: () => <div>Device commands</div>, DeviceState: () => null }));

const base: ConnectedDevice = { uid: 'thermostat:1', id: 1, kind: 'thermostat', name: 'Climatisation salon', roomName: 'Salon', propertyId: 1, propertyName: 'Test', provider: 'TUYA', online: true, statusLevel: 'ok', statusLabel: 'En ligne', actions: ['view'], raw: { mode: 'cool', currentTempC: 21 } };
const onAction = vi.fn();
const props = { group: { propertyId: 1, propertyName: 'Test', devices: [base, { ...base, id: 2, uid: 'thermostat:2', name: 'Climatisation secondaire' }] }, kindFilter: '' as const, actingUid: null, onAction, onAdd: vi.fn() };
const mount = () => render(<UserUiPreferencesProvider><ConnectedRoomExplorer {...props} /></UserUiPreferencesProvider>);
const marker = (name = 'Climatisation salon') => within(screen.getByRole('group', { name: 'Équipements placés dans la pièce' })).getByRole('button', { name: new RegExp(name) });
const enterRoom = async () => {
  fireEvent.click(screen.getByTitle('Salon'));
  fireEvent.load(screen.getByRole('img', { name: 'Illustration de la pièce : Salon' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ajuster dans la pièce' })).toBeEnabled());
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userUiPreferencesApi.list).mockResolvedValue({});
  vi.mocked(userUiPreferencesApi.upsert).mockResolvedValue({ key: '', value: {} });
});
afterEach(cleanup);

describe('room placement integration with backend preferences', () => {
  it('edits individual devices, saves on explicit confirmation and restores after remount', async () => {
    const page = mount(); await enterRoom();
    const secondaryPosition = marker('Climatisation secondaire').style.left;
    fireEvent.click(screen.getByRole('button', { name: 'Ajuster dans la pièce' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Taille' }), { target: { value: '11.5' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Angle de vue' }), { target: { value: 'right' } });
    fireEvent.keyDown(marker(), { key: 'ArrowRight', shiftKey: true });
    expect(marker().style.width).toBe('11.5%');
    expect(marker().querySelector('image')).toHaveAttribute('href', expect.stringContaining('split-idle-right'));
    expect(marker('Climatisation secondaire').style.left).toBe(secondaryPosition);
    expect(userUiPreferencesApi.upsert).not.toHaveBeenCalled();
    expect(screen.queryByText('Device commands')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ajuster dans la pièce' })).toBeEnabled());
    const [key, value] = vi.mocked(userUiPreferencesApi.upsert).mock.calls[0];
    expect(key).toBe('connectedRooms.placements.1');
    expect(Object.keys(value as object)).toHaveLength(1);
    expect(onAction).not.toHaveBeenCalled();
    page.unmount();
    vi.mocked(userUiPreferencesApi.list).mockResolvedValue({ [key]: value });
    mount(); await enterRoom();
    expect(marker().style.width).toBe('11.5%');
    expect(marker().querySelector('image')).toHaveAttribute('href', expect.stringContaining('split-idle-right'));
  });
  it('cancels edits without persisting and preserves edits when the server rejects a save', async () => {
    mount(); await enterRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Ajuster dans la pièce' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Taille' }), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(marker().style.width).toBe('15%');
    expect(userUiPreferencesApi.upsert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ajuster dans la pièce' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Taille' }), { target: { value: '18' } });
    vi.mocked(userUiPreferencesApi.upsert).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vos réglages sont conservés');
    expect(marker().style.width).toBe('18%');
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir ce placement' }));
    expect(marker().style.width).toBe('15%');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer', exact: true }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(userUiPreferencesApi.upsert).toHaveBeenLastCalledWith('connectedRooms.placements.1', {});
  });
  it('keeps adjustment disabled until existing preferences are loaded', async () => {
    vi.mocked(userUiPreferencesApi.list).mockReturnValue(new Promise(() => {}));
    mount(); fireEvent.click(screen.getByTitle('Salon'));
    expect(screen.getByRole('button', { name: 'Ajuster dans la pièce' })).toBeDisabled();
  });
});
