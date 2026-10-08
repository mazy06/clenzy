import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { thermostatsApi, type ThermostatDto } from '../../../services/api/thermostatsApi';
import RoomThermalControls from './RoomThermalControls';
import type { ConnectedDevice } from '../types';

vi.mock('../../../services/api/thermostatsApi', () => ({ thermostatsApi: { getStatus: vi.fn(), setTarget: vi.fn() } }));
const reading = { id: 1, online: true, mode: 'cool', currentTempC: 27, targetTempC: 23 } as ThermostatDto;
const device = { id: 1, kind: 'thermostat' } as ConnectedDevice;
const renderControl = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><RoomThermalControls device={device} /></QueryClientProvider>);
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); vi.mocked(thermostatsApi.getStatus).mockResolvedValue(reading); });

describe('thermal control provider integration', () => {
  it('renders reported values and submits the selected target through the API', async () => {
    vi.mocked(thermostatsApi.setTarget).mockResolvedValue({ ...reading, targetTempC: 23.5 });
    renderControl();
    expect(await screen.findByText('27 °C')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Monter la consigne' }));
    await waitFor(() => expect(thermostatsApi.setTarget).toHaveBeenCalledWith(1, 23.5));
    expect(await screen.findByText('23,5 °C')).toBeInTheDocument();
  });
  it('does not send commands when a target is missing or the device is offline', async () => {
    vi.mocked(thermostatsApi.getStatus).mockResolvedValue({ ...reading, online: false, targetTempC: null });
    renderControl();
    await screen.findByText('27 °C');
    expect(screen.getByRole('button', { name: 'Monter la consigne' })).toBeDisabled();
    expect(thermostatsApi.setTarget).not.toHaveBeenCalled();
  });
  it('reports provider errors without pretending that the target changed', async () => {
    vi.mocked(thermostatsApi.setTarget).mockRejectedValue(new Error('Provider unavailable'));
    renderControl();
    await screen.findByText('27 °C');
    fireEvent.click(screen.getByRole('button', { name: 'Monter la consigne' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La consigne n’a pas pu être envoyée');
    expect(screen.getByText('23 °C')).toBeInTheDocument();
  });
});
