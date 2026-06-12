import React from 'react';
import { Alert, Box } from '@mui/material';
import {
  complianceConnectionApi,
  COMPLIANCE_PROVIDER_META,
  type ComplianceProvider,
} from '../../../services/api/complianceConnectionApi';
import ApiKeyConnectionCard, { type ApiKeyConnectionApi } from './ApiKeyConnectionCard';

/**
 * Wrapper Compliance autour du composant generique {@link ApiKeyConnectionCard}.
 * Ajoute deux slots specifiques au domaine :
 *   - {@code headerChip} : code pays (FR / MA / SA) avec drapeau
 *   - {@code bodyAlert} : rappel de l'obligation legale (severity warning)
 */
interface Props {
  provider: ComplianceProvider;
  onStatusChange?: (connected: boolean) => void;
}

const NEUTRAL = 'var(--muted)';

const ComplianceProviderCard: React.FC<Props> = ({ provider, onStatusChange }) => {
  const meta = COMPLIANCE_PROVIDER_META[provider];
  const countryFlag =
    meta.countryCode === 'FR' ? '🇫🇷' : meta.countryCode === 'MA' ? '🇲🇦' : '🇸🇦';

  const headerChip = (
    <Box
      component="span"
      sx={{
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: NEUTRAL,
        backgroundColor: `color-mix(in srgb, ${NEUTRAL} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${NEUTRAL} 20%, transparent)`,
        borderRadius: '4px',
        px: 0.5,
        py: 0.125,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
      }}
    >
      {meta.countryCode}
      <span aria-hidden="true" style={{ fontSize: '0.85em' }}>{countryFlag}</span>
    </Box>
  );

  const bodyAlert = (
    <Alert
      severity="warning"
      variant="outlined"
      sx={{
        borderRadius: '8px',
        fontSize: '0.74rem',
        py: 0.5,
        '& .MuiAlert-message': { padding: '4px 0' },
      }}
    >
      <strong>Obligation légale :</strong> {meta.legalNote}
    </Alert>
  );

  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={complianceConnectionApi as ApiKeyConnectionApi<ComplianceProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      headerChip={headerChip}
      bodyAlert={bodyAlert}
      scaffoldingNote={`L'intégration ${meta.label} est en cours de scaffolding. La connexion enregistre vos credentials ; les appels de déclaration automatique seront ajoutés prochainement.`}
    />
  );
};

export default ComplianceProviderCard;
