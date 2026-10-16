import apiClient from '../apiClient';

export interface BaitlyIotConfiguration {
  configured: boolean;
  /** Synthetic devices are a test tool, enabled per environment only. */
  simulatorsEnabled: boolean;
  /** Public HTTPS ingestion URL to configure on the device, when the environment publishes one. */
  ingestionUrl: string | null;
}
export interface BaitlySensorState {
  simulation: boolean;
  revoked: boolean;
  online: boolean;
  lastReceivedAt: string | null;
  lastMeasuredAt: string | null;
  awaitingFirstMeasurement: boolean;
  reportingIntervalSeconds: number;
  externalDeviceId: string;
  /** Certificate CN to sign with the offline device CA. Not a secret. */
  mqttIdentity: string;
}
export interface CreateBaitlySensor {
  requestId: string;
  propertyId: number;
  name: string;
  roomName?: string;
}
/** Returned once at registration: the device secret is never shown again. */
export interface BaitlyProvisioning {
  id: number;
  externalDeviceId: string;
  token: string;
  mqttIdentity: string;
  ingestionUrl: string | null;
}
export const baitlyIotApi = {
  configuration: () => apiClient.get<BaitlyIotConfiguration>('/baitly-iot/configuration'),
  create: (input: CreateBaitlySensor) => apiClient.post<{ id: number }>('/baitly-iot/noise-devices', input),
  register: (input: CreateBaitlySensor) => apiClient.post<BaitlyProvisioning>('/baitly-iot/noise-devices/register', input),
  attach: (input: Omit<CreateBaitlySensor, 'requestId'> & { externalDeviceId: string }) =>
    apiClient.post<{ id: number }>('/baitly-iot/noise-devices/attach', input),
  state: (id: number) => apiClient.get<BaitlySensorState>(`/baitly-iot/noise-devices/${id}`),
  simulate: (id: number, input: { eventId: string; measuredAt: string; laeqDbA: number }) =>
    apiClient.post<{ eventId: string; duplicate: boolean }>(`/baitly-iot/noise-devices/${id}/simulate`, input),
  credentials: (id: number) => apiClient.post<{ token: string }>(`/baitly-iot/noise-devices/${id}/credentials`),
  mqttIdentity: (id: number) => apiClient.post<{ mqttIdentity: string }>(`/baitly-iot/noise-devices/${id}/mqtt-identity`),
  revoke: (id: number) => apiClient.post<void>(`/baitly-iot/noise-devices/${id}/revoke`),
  delete: (id: number) => apiClient.delete(`/baitly-iot/noise-devices/${id}`),
};

export function baitlyIotError(error: unknown, fallback: string): string {
  return error != null && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message : fallback;
}
