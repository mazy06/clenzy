import React from 'react';
import {
  kycConnectionApi,
  KYC_PROVIDER_META,
  type KycProvider,
} from '../../../services/api/kycConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';

/**
 * Wrapper KYC autour du composant generique {@link ApiKeyConnectionCard}.
 */
interface Props {
  provider: KycProvider;
  onStatusChange?: (connected: boolean) => void;
}

const KycProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const meta = KYC_PROVIDER_META[provider];
  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={kycConnectionApi as ApiKeyConnectionApi<KycProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      scaffoldingNote={`Vos credentials sont validées par un appel réel à l'API ${meta.label} lors de la connexion. Le flux de vérification des voyageurs (création de la demande KYC, récupération du résultat) sera branché dans une prochaine itération.`}
    />
  );
};

export default KycProviderCard;
