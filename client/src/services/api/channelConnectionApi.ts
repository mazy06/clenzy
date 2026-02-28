import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChannelId = 'booking' | 'expedia' | 'hotels' | 'agoda' | 'vrbo' | 'abritel';

/** Maps frontend channel IDs to backend ChannelName enum values */
export const CHANNEL_BACKEND_MAP: Record<ChannelId, string> = {
  booking: 'BOOKING',
  expedia: 'EXPEDIA',
  hotels: 'HOTELS_COM',
  agoda: 'AGODA',
  vrbo: 'HOMEAWAY',
  abritel: 'HOMEAWAY',
};

/** Backend channels that can be connected (deduplicated) */
export const CONNECTABLE_CHANNELS: ChannelId[] = ['booking', 'expedia', 'hotels', 'agoda', 'vrbo', 'abritel'];

export interface ChannelConnectionStatus {
  id: number | null;
  channel: string;
  status: string;
  connected: boolean;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  externalPropertyId: string | null;
}

export interface ChannelConnectRequest {
  credentials: Record<string, string>;
}

export interface ChannelConnectionTestResult {
  success: boolean;
  message: string;
  channelPropertyName: string | null;
}

// ─── Credential field definitions per channel (for form rendering) ───────────

export interface CredentialFieldDef {
  key: string;
  labelKey: string;
  type: 'text' | 'password';
  required: boolean;
  placeholder?: string;
}

export const CHANNEL_CREDENTIAL_FIELDS: Record<string, CredentialFieldDef[]> = {
  BOOKING: [
    { key: 'hotelId', labelKey: 'channels.connect.hotelId', type: 'text', required: true, placeholder: '123456' },
    { key: 'username', labelKey: 'channels.connect.username', type: 'text', required: true },
    { key: 'password', labelKey: 'channels.connect.password', type: 'password', required: true },
  ],
  EXPEDIA: [
    { key: 'propertyId', labelKey: 'channels.connect.propertyId', type: 'text', required: true },
    { key: 'apiKey', labelKey: 'channels.connect.apiKey', type: 'text', required: true },
    { key: 'apiSecret', labelKey: 'channels.connect.apiSecret', type: 'password', required: true },
  ],
  HOTELS_COM: [
    { key: 'propertyId', labelKey: 'channels.connect.propertyId', type: 'text', required: true },
    { key: 'apiKey', labelKey: 'channels.connect.apiKey', type: 'text', required: true },
    { key: 'apiSecret', labelKey: 'channels.connect.apiSecret', type: 'password', required: true },
  ],
  AGODA: [
    { key: 'propertyId', labelKey: 'channels.connect.propertyId', type: 'text', required: true },
    { key: 'apiKey', labelKey: 'channels.connect.apiKey', type: 'text', required: true },
    { key: 'apiSecret', labelKey: 'channels.connect.apiSecret', type: 'password', required: false },
  ],
  HOMEAWAY: [
    { key: 'listingId', labelKey: 'channels.connect.listingId', type: 'text', required: true },
    { key: 'accessToken', labelKey: 'channels.connect.accessToken', type: 'password', required: true },
    { key: 'refreshToken', labelKey: 'channels.connect.refreshToken', type: 'password', required: false },
  ],
};

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/channels/connections';

export const channelConnectionApi = {
  /** List all active connections for the organization */
  getAll: (): Promise<ChannelConnectionStatus[]> =>
    apiClient.get(BASE),

  /** Get connection status for a specific channel */
  getStatus: (backendChannel: string): Promise<ChannelConnectionStatus> =>
    apiClient.get(`${BASE}/${backendChannel}`),

  /** Connect a channel */
  connect: (backendChannel: string, request: ChannelConnectRequest): Promise<ChannelConnectionStatus> =>
    apiClient.post(`${BASE}/${backendChannel}`, request),

  /** Disconnect a channel */
  disconnect: (backendChannel: string): Promise<void> =>
    apiClient.delete(`${BASE}/${backendChannel}`),

  /** Test connection credentials */
  test: (backendChannel: string, request: ChannelConnectRequest): Promise<ChannelConnectionTestResult> =>
    apiClient.post(`${BASE}/${backendChannel}/test`, request),
};
