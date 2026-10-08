import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { camerasApi, type CameraDto } from '../../../services/api/camerasApi';
import type { ConnectedDevice } from '../types';
import RoomCameraControls from './RoomCameraControls';

vi.mock('../../../services/api/camerasApi', () => ({ camerasApi: { getAll: vi.fn(), refreshStream: vi.fn() } }));
const camera: CameraDto = { id: 7, name: 'Caméra test entrée', propertyId: 4, propertyName: 'Logement test', roomName: 'Entrée', brand: 'TUYA', status: 'ONLINE', online: true, recording: false, streamName: 'test', webrtcUrl: '/media/stream.html?src=test', snapshotUrl: null, createdAt: '' };
const device = { id: camera.id, uid: 'camera:7', kind: 'camera' } as ConnectedDevice;
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  return render(<QueryClientProvider client={client}><RoomCameraControls device={device} /></QueryClientProvider>);
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(camerasApi.getAll).mockResolvedValue([camera]); vi.mocked(camerasApi.refreshStream).mockResolvedValue({}); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe('camera playback in the room inspector', () => {
  it('does not play on selection; renews the Tuya stream on explicit play and stops inline', async () => {
    setup();
    await screen.findByText('Aperçu caméra');
    expect(screen.queryByTitle(camera.name)).not.toBeInTheDocument();
    expect(camerasApi.refreshStream).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Lancer la lecture' })[0]);
    expect(await screen.findByTitle(camera.name)).toHaveAttribute('src', camera.webrtcUrl);
    expect(camerasApi.refreshStream).toHaveBeenCalledExactlyOnceWith(7);
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la lecture' }));
    expect(screen.queryByTitle(camera.name)).not.toBeInTheDocument();
  });
  it('releases playback when the selected device panel unmounts', async () => {
    vi.mocked(camerasApi.getAll).mockResolvedValue([{ ...camera, brand: 'ONVIF' }]);
    const view = setup();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Lancer la lecture' }))[0]);
    expect(await screen.findByTitle(camera.name)).toBeInTheDocument();
    view.unmount();
    expect(document.querySelector('iframe')).toBeNull();
    expect(camerasApi.refreshStream).not.toHaveBeenCalled();
  });
  it('shows an unavailable stream instead of a working play control when no stream is configured', async () => {
    vi.mocked(camerasApi.getAll).mockResolvedValue([{ ...camera, webrtcUrl: null }]);
    setup(); await screen.findByText('Aperçu caméra');
    expect(screen.queryByRole('button', { name: 'Lancer la lecture' })).not.toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
    expect(camerasApi.refreshStream).not.toHaveBeenCalled();
  });
  it('keeps an offline camera stopped even when a cached stream URL exists', async () => {
    vi.mocked(camerasApi.getAll).mockResolvedValue([{ ...camera, online: false }]);
    setup(); await screen.findByText('Hors ligne');
    expect(screen.queryByRole('button', { name: 'Lancer la lecture' })).not.toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
  it('reports renewal failure without mounting stale video', async () => {
    vi.mocked(camerasApi.refreshStream).mockRejectedValue(new Error('Provider unavailable'));
    setup(); fireEvent.click((await screen.findAllByRole('button', { name: 'Lancer la lecture' }))[0]);
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(document.querySelector('iframe')).toBeNull();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Lancer la lecture' })[0]).toBeEnabled());
  });
});
