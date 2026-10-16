import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeviceQrReader from './DeviceQrReader';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('QR camera lifecycle', () => {
  it('does not request the camera before an explicit click and offers manual fallback', async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal('BarcodeDetector', undefined);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    render(<DeviceQrReader onHint={vi.fn()} />);
    expect(getUserMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Identifier avec un QR code'));
    fireEvent.click(screen.getByRole('button', { name: 'Scanner avec la caméra' }));
    expect(await screen.findByRole('status')).toHaveTextContent('pas disponible');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('stops a camera stream arriving after the component has been closed', async () => {
    const stop = vi.fn();
    let resolve!: (value: MediaStream) => void;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>(done => { resolve = done; }));
    vi.stubGlobal('BarcodeDetector', class { static async getSupportedFormats() { return ['qr_code']; } });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    const view = render(<DeviceQrReader onHint={vi.fn()} />);
    fireEvent.click(screen.getByText('Identifier avec un QR code'));
    fireEvent.click(screen.getByRole('button', { name: 'Scanner avec la caméra' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    view.unmount();
    resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  });

  it('decodes locally and stops the live stream immediately after a result', async () => {
    const stop = vi.fn();
    const detect = vi.fn().mockResolvedValue([{ rawValue: 'https://m.smart321.com/test-fixture' }]);
    const hint = vi.fn();
    vi.stubGlobal('BarcodeDetector', class {
      static async getSupportedFormats() { return ['qr_code']; }
      detect = detect;
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    render(<DeviceQrReader onHint={hint} />);
    fireEvent.click(screen.getByText('Identifier avec un QR code'));
    fireEvent.click(screen.getByRole('button', { name: 'Scanner avec la caméra' }));
    await waitFor(() => expect(hint).toHaveBeenCalledWith('tuya'));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Ou coller le contenu du QR code')).toHaveValue('');
  });
});
