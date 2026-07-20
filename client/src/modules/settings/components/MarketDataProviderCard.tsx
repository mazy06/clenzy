import React from 'react';
import { Alert } from '@mui/material';
import {
  marketDataConnectionApi,
  MARKET_DATA_PROVIDER_META,
  type MarketDataProvider,
} from '../../../services/api/marketDataConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';

/**
 * Wrapper « données de marché » autour du composant générique
 * {@link ApiKeyConnectionCard}. Activer une clé réveille le provider dormant au
 * prochain cycle d'ingestion (05:45) — les benchmarks alimentent alors le RMS
 * (roadmap market data, sources contractuelles uniquement).
 */
interface Props {
  provider: MarketDataProvider;
  onStatusChange?: (connected: boolean) => void;
}

const MarketDataProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const meta = MARKET_DATA_PROVIDER_META[provider];

  const bodyAlert = (
    <Alert
      severity="info"
      variant="outlined"
      sx={{
        borderRadius: '8px',
        fontSize: '0.74rem',
        py: 0.5,
        '& .MuiAlert-message': { padding: '4px 0' },
      }}
    >
      <strong>Portée plateforme :</strong> la clé active l'ingestion quotidienne des
      benchmarks marché (ADR, occupation, RevPAR) pour tous les tenants. Sans clé, le
      RMS fonctionne déjà avec les données réseau (first-party) et l'open data.
    </Alert>
  );

  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={marketDataConnectionApi as ApiKeyConnectionApi<MarketDataProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      bodyAlert={bodyAlert}
      scaffoldingNote={`La connexion ${meta.label} enregistre la clé (chiffrée) et réveille l'adaptateur au prochain cycle d'ingestion. Le schéma de réponse du fournisseur sera confirmé au premier appel réel.`}
    />
  );
};

export default MarketDataProviderCard;
