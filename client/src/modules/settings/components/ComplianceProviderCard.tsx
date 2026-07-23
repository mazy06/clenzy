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

  // Chekin dispose d'une API publique : la connexion valide la clé par un appel réel
  // et les fiches de police sont transmises automatiquement. Les providers
  // gouvernementaux (DGSN / Absher) attendent un partenariat officiel : la connexion
  // enregistre les credentials mais aucune transmission n'a lieu.
  const scaffoldingNote =
    provider === 'CHEKIN'
      ? 'Votre clé API est validée par un appel réel à Chekin lors de la connexion. Les fiches de police des voyageurs sont ensuite transmises automatiquement dès que le check-in en ligne est complété.'
      : `L'intégration ${meta.label} nécessite un accès officiel de l'autorité concernée (pas d'API publique). Vos credentials sont enregistrés dès maintenant ; la transmission automatique sera activée dès que le partenariat sera établi.`;

  return (
    <ApiKeyConnectionCard
      provider={provider}
      api={complianceConnectionApi as ApiKeyConnectionApi<ComplianceProvider>}
      meta={meta}
      logoId={provider}
      onStatusChange={onStatusChange}
      headerChip={headerChip}
      bodyAlert={bodyAlert}
      scaffoldingNote={scaffoldingNote}
    />
  );
};

export default ComplianceProviderCard;
