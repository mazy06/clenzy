import React from 'react';
import {
  kycConnectionApi,
  KYC_PROVIDER_META,
  type KycProvider,
} from '../../../services/api/kycConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * Wrapper KYC autour du composant generique {@link ApiKeyConnectionCard}.
 */
interface Props {
  provider: KycProvider;
  onStatusChange?: (connected: boolean) => void;
}

const KycProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const { t } = useTranslation();
  const meta = KYC_PROVIDER_META[provider];
  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={kycConnectionApi as ApiKeyConnectionApi<KycProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      scaffoldingNote={t('settings.integrations.scaffolding.kyc', { provider: meta.label })}
    />
  );
};

export default KycProviderCard;
