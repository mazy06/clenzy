/**
 * Client API des connexions fournisseurs de données de marché (Airbtics, AirROI).
 * Portée PLATEFORME (l'abonnement data est celui de Baitly) — endpoints gatés
 * SUPER_ADMIN / SUPER_MANAGER côté backend.
 *
 * Endpoints :
 *   - POST /api/integrations/market-data/{provider}/connect
 *   - GET  /api/integrations/market-data/{provider}/status
 *   - POST /api/integrations/market-data/{provider}/disconnect
 */
import apiClient from '../apiClient';
import type { ApiKeyProviderMeta } from '../../modules/settings/components/ApiKeyConnectionCard';

export type MarketDataProvider = 'AIRBTICS' | 'AIRROI';

export interface MarketDataConnectionRequest {
  serverUrl: string;
  accountIdentifier?: string;
  apiKey: string;
}

export interface MarketDataConnectionStatus {
  connected: boolean;
  providerType: MarketDataProvider;
  serverUrl?: string | null;
  status?: string | null;
  connectedAt?: string | null;
}

export const MARKET_DATA_PROVIDER_META: Record<MarketDataProvider, ApiKeyProviderMeta> = {
  AIRBTICS: {
    label: 'Airbtics',
    descriptionKey: 'marketDataProviders.AIRBTICS.description',
    serverUrlPlaceholder: 'https://api.airbtics.com/v1/market',
    apiKeyHelpUrl: 'https://airbtics.com/airbnb-api',
  },
  AIRROI: {
    label: 'AirROI',
    descriptionKey: 'marketDataProviders.AIRROI.description',
    serverUrlPlaceholder: 'https://api.airroi.com/v1/market',
    apiKeyHelpUrl: 'https://www.airroi.com/api/pricing',
  },
};

export const marketDataConnectionApi = {
  getStatus: (provider: MarketDataProvider) =>
    apiClient.get<MarketDataConnectionStatus>(`/integrations/market-data/${provider}/status`),

  connect: (provider: MarketDataProvider, req: MarketDataConnectionRequest) =>
    apiClient.post<MarketDataConnectionStatus>(`/integrations/market-data/${provider}/connect`, req),

  disconnect: (provider: MarketDataProvider) =>
    apiClient.post<unknown>(`/integrations/market-data/${provider}/disconnect`, {}),
};
