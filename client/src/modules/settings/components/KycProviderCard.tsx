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
      scaffoldingNote={`L'intégration ${meta.label} est en cours de scaffolding. La connexion enregistre vos credentials ; les appels de vérification d'identité (création de verification request, retrieval du résultat KYC) seront ajoutés prochainement.`}
    />
  );
};

export default KycProviderCard;
