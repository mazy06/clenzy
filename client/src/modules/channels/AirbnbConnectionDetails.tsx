import React from 'react';
import { Box, Paper, Typography, Alert } from '@mui/material';
import type { AirbnbConnectionStatus } from '../../services/api/airbnbApi';
import { CARD_SX } from './channelsPageConstants';

// Logo import (utilise dans la section "connecte" Airbnb)
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.svg';

interface AirbnbConnectionDetailsProps {
  connectionStatus: AirbnbConnectionStatus;
  dateLocale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/** Panneau de détails de connexion Airbnb (affiché quand connecté). */
const AirbnbConnectionDetails: React.FC<AirbnbConnectionDetailsProps> = ({
  connectionStatus,
  dateLocale,
  t,
}) => (
  <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
      <Box
        component="img"
        src={airbnbLogoSmall}
        alt="Airbnb"
        sx={{ height: 18 }}
      />
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
        {t('channels.airbnb.connectedSince')}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      <DetailItem label={t('channels.airbnb.userId')} value={connectionStatus.airbnbUserId ?? '—'} />
      <DetailItem
        label={t('channels.airbnb.connectedSince')}
        value={connectionStatus.connectedAt ? new Date(connectionStatus.connectedAt).toLocaleDateString(dateLocale) : '—'}
      />
      <DetailItem
        label={t('channels.airbnb.lastSync')}
        value={connectionStatus.lastSyncAt ? new Date(connectionStatus.lastSyncAt).toLocaleString(dateLocale) : '—'}
      />
      <DetailItem
        label={t('channels.airbnb.linkedListings')}
        value={String(connectionStatus.linkedListingsCount)}
      />
      {connectionStatus.errorMessage && (
        <Alert severity="warning" sx={{ fontSize: '0.75rem', py: 0, width: '100%' }}>
          {connectionStatus.errorMessage}
        </Alert>
      )}
    </Box>
  </Paper>
);

export default AirbnbConnectionDetails;

// ─── Sub-components ──────────────────────────────────────────────────────────

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '10.5px', color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}
