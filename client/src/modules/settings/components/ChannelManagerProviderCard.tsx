import React from 'react';
import {
  channelManagerConnectionApi,
  CHANNEL_MANAGER_PROVIDER_META,
  type ChannelManagerProvider,
} from '../../../services/api/channelManagerConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';

/**
 * Wrapper Channel Manager autour du composant generique
 * {@link ApiKeyConnectionCard}.
 */
interface Props {
  provider: ChannelManagerProvider;
  onStatusChange?: (connected: boolean) => void;
}

const ChannelManagerProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const meta = CHANNEL_MANAGER_PROVIDER_META[provider];
  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={channelManagerConnectionApi as ApiKeyConnectionApi<ChannelManagerProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      scaffoldingNote={`L'intégration ${meta.label} est en cours de scaffolding. La connexion enregistre vos credentials ; les appels de routage multi-OTAs (push availability, retrieval bookings) seront ajoutés prochainement.`}
    />
  );
};

export default ChannelManagerProviderCard;
