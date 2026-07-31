import React from 'react';
import { Paper, Alert } from '@mui/material';
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
    <div className="flex items-center gap-1.5 mb-2">
      <img className="h-[18px]" src={airbnbLogoSmall} alt="Airbnb" />
      <p className="cn-text-body1 text-[0.875rem] font-bold">
        {t('channels.airbnb.connectedSince')}
      </p>
    </div>
    <div className="flex gap-4 flex-wrap">
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
    </div>
  </Paper>
);

export default AirbnbConnectionDetails;

// ─── Sub-components ──────────────────────────────────────────────────────────

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] font-bold uppercase tracking-[0.06em]">
        {label}
      </p>
      <p className="cn-text-body1 text-[0.8125rem] font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
