import React from 'react';
import {
  pricingConnectionApi,
  PRICING_PROVIDER_META,
  type PricingProvider,
} from '../../../services/api/pricingConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';

/**
 * Wrapper Pricing autour du composant generique {@link ApiKeyConnectionCard}.
 * Delegue toute la mecanique (state, form, dialog deconnexion) au generic.
 */
interface Props {
  provider: PricingProvider;
  onStatusChange?: (connected: boolean) => void;
}

const PricingProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const meta = PRICING_PROVIDER_META[provider];
  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={pricingConnectionApi as ApiKeyConnectionApi<PricingProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      scaffoldingNote={`L'intégration ${meta.label} est en cours de scaffolding. La connexion enregistre vos credentials ; les appels pricing (récupération des prix recommandés, push des règles) seront ajoutés prochainement.`}
    />
  );
};

export default PricingProviderCard;
