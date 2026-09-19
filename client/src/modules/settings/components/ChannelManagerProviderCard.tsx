import React from 'react';
import {
  channelManagerConnectionApi,
  CHANNEL_MANAGER_PROVIDER_META,
  type ChannelManagerProvider,
} from '../../../services/api/channelManagerConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * Wrapper Channel Manager autour du composant generique
 * {@link ApiKeyConnectionCard}.
 */
interface Props {
  provider: ChannelManagerProvider;
  onStatusChange?: (connected: boolean) => void;
}

const ChannelManagerProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const { t } = useTranslation();
  const meta = CHANNEL_MANAGER_PROVIDER_META[provider];
  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={channelManagerConnectionApi as ApiKeyConnectionApi<ChannelManagerProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      scaffoldingNote={t('settings.integrations.scaffolding.channelManager', { provider: meta.label })}
    />
  );
};

export default ChannelManagerProviderCard;
